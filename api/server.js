const { Redis } = require('@upstash/redis');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url ? req.url.split('?')[0] : '/';

  try {
    // REGISTER
    if (req.method === 'POST' && url === '/api/register') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { username, email, password } = body;
      if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

      const existingEmail = await redis.get(`email:${email}`);
      if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

      const existingUser = await redis.get(`username:${username.toLowerCase()}`);
      if (existingUser) return res.status(400).json({ error: 'Username already taken' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const user = {
        id: userId,
        username,
        email,
        password: hashedPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        bio: '',
        createdAt: new Date().toISOString(),
        online: false
      };

      await redis.set(`user:${userId}`, JSON.stringify(user));
      await redis.set(`email:${email}`, userId);
      await redis.set(`username:${username.toLowerCase()}`, userId);

      return res.status(200).json({ message: 'Account created', userId, username: user.username, avatar: user.avatar });
    }

    // LOGIN (email OR username)
    if (req.method === 'POST' && url === '/api/login') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { login, password } = body;

      let userId;
      if (login.includes('@')) {
        userId = await redis.get(`email:${login}`);
      } else {
        userId = await redis.get(`username:${login.toLowerCase()}`);
      }
      if (!userId) return res.status(401).json({ error: 'Invalid credentials' });

      const userData = await redis.get(`user:${userId}`);
      if (!userData) return res.status(401).json({ error: 'Invalid credentials' });

      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });

      user.online = true;
      await redis.set(`user:${userId}`, JSON.stringify(user));

      return res.status(200).json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar });
    }

    // USERS LIST
    if (req.method === 'GET' && url === '/api/users') {
      const keys = await redis.keys('user:*');
      const users = [];
      for (const key of keys) {
        const userData = await redis.get(key);
        if (userData) {
          const u = typeof userData === 'string' ? JSON.parse(userData) : userData;
          users.push({ id: u.id, username: u.username, avatar: u.avatar, online: u.online, bio: u.bio || '' });
        }
      }
      return res.status(200).json(users);
    }

    // GET USER PROFILE
    if (req.method === 'GET' && url.startsWith('/api/user/')) {
      const userId = url.split('/api/user/')[1];
      const userData = await redis.get(`user:${userId}`);
      if (!userData) return res.status(404).json({ error: 'User not found' });
      const u = typeof userData === 'string' ? JSON.parse(userData) : userData;
      return res.status(200).json({ id: u.id, username: u.username, avatar: u.avatar, online: u.online, bio: u.bio || '', email: u.email });
    }

    // UPDATE PROFILE
    if (req.method === 'POST' && url === '/api/update-profile') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId, username, bio, avatar } = body;

      const userData = await redis.get(`user:${userId}`);
      if (!userData) return res.status(404).json({ error: 'User not found' });

      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

      if (username && username !== user.username) {
        const taken = await redis.get(`username:${username.toLowerCase()}`);
        if (taken && taken !== userId) return res.status(400).json({ error: 'Username already taken' });
        await redis.del(`username:${user.username.toLowerCase()}`);
        user.username = username;
        await redis.set(`username:${username.toLowerCase()}`, userId);
      }

      if (bio !== undefined) user.bio = bio;
      if (avatar) user.avatar = avatar;

      await redis.set(`user:${userId}`, JSON.stringify(user));
      return res.status(200).json({ message: 'Profile updated', username: user.username, avatar: user.avatar, bio: user.bio });
    }

    // MESSAGES
    if (req.method === 'GET' && url.startsWith('/api/messages')) {
      const params = new URL(req.url, 'http://x').searchParams;
      const user1 = params.get('user1');
      const user2 = params.get('user2');
      const after = params.get('after');

      const chatKey = [user1, user2].sort().join(':');
      const msgData = await redis.get(`chat:${chatKey}`);
      let chat = msgData ? (typeof msgData === 'string' ? JSON.parse(msgData) : msgData) : [];
      if (after) chat = chat.filter(m => m.timestamp > after);
      return res.status(200).json(chat);
    }

    // SEND MESSAGE
    if (req.method === 'POST' && url === '/api/messages') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { senderId, senderName, senderAvatar, receiverId, content, type } = body;
      const msg = {
        id: uuidv4(),
        senderId, senderName, senderAvatar, receiverId,
        content,
        type: type || 'text',
        timestamp: new Date().toISOString()
      };

      const chatKey = [senderId, receiverId].sort().join(':');
      const existing = await redis.get(`chat:${chatKey}`);
      let messages = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : [];
      messages.push(msg);
      if (messages.length > 500) messages = messages.slice(-300);
      await redis.set(`chat:${chatKey}`, JSON.stringify(messages));

      return res.status(200).json(msg);
    }

    // EDIT MESSAGE
    if (req.method === 'POST' && url === '/api/messages/edit') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { messageId, senderId, user1, user2, newContent } = body;
      if (!messageId || !senderId || !user1 || !user2 || !newContent) {
        return res.status(400).json({ error: 'Missing fields' });
      }
      const chatKey = [user1, user2].sort().join(':');
      const existing = await redis.get(`chat:${chatKey}`);
      if (!existing) return res.status(404).json({ error: 'Chat not found' });
      let messages = typeof existing === 'string' ? JSON.parse(existing) : existing;
      const idx = messages.findIndex(m => m.id === messageId);
      if (idx === -1) return res.status(404).json({ error: 'Message not found' });
      if (messages[idx].senderId !== senderId) return res.status(403).json({ error: 'Not your message' });
      messages[idx].content = newContent;
      messages[idx].edited = true;
      messages[idx].editedAt = new Date().toISOString();
      await redis.set(`chat:${chatKey}`, JSON.stringify(messages));
      return res.status(200).json(messages[idx]);
    }

    // DELETE MESSAGE
    if (req.method === 'POST' && url === '/api/messages/delete') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { messageId, senderId, user1, user2 } = body;
      if (!messageId || !senderId || !user1 || !user2) {
        return res.status(400).json({ error: 'Missing fields' });
      }
      const chatKey = [user1, user2].sort().join(':');
      const existing = await redis.get(`chat:${chatKey}`);
      if (!existing) return res.status(404).json({ error: 'Chat not found' });
      let messages = typeof existing === 'string' ? JSON.parse(existing) : existing;
      const msg = messages.find(m => m.id === messageId);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      if (msg.senderId !== senderId) return res.status(403).json({ error: 'Not your message' });
      messages = messages.filter(m => m.id !== messageId);
      await redis.set(`chat:${chatKey}`, JSON.stringify(messages));
      return res.status(200).json({ ok: true, deletedId: messageId });
    }

    // STORIES
    if (req.method === 'GET' && url === '/api/stories') {
      const keys = await redis.keys('stories:*');
      const allStories = [];
      for (const key of keys) {
        const storyData = await redis.get(key);
        if (storyData) {
          const stories = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
          const valid = stories.filter(s => new Date(s.expiresAt) > new Date());
          if (valid.length > 0) {
            await redis.set(key, JSON.stringify(valid));
            allStories.push(...valid);
          } else {
            await redis.del(key);
          }
        }
      }
      return res.status(200).json(allStories);
    }

    // POST STORY
    if (req.method === 'POST' && url === '/api/stories') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId, username, avatar, content, mediaUrl, type } = body;

      const story = {
        id: uuidv4(),
        userId, username, avatar,
        content: content || '',
        mediaUrl: mediaUrl || '',
        type: type || 'text',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const key = `stories:${userId}`;
      const existing = await redis.get(key);
      let stories = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : [];
      stories.push(story);
      await redis.set(key, JSON.stringify(stories));

      return res.status(200).json(story);
    }

    // ONLINE / OFFLINE
    if (req.method === 'POST' && url === '/api/online') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId } = body;
      const userData = await redis.get(`user:${userId}`);
      if (userData) {
        const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
        user.online = true;
        await redis.set(`user:${userId}`, JSON.stringify(user));
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && url === '/api/offline') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId } = body;
      const userData = await redis.get(`user:${userId}`);
      if (userData) {
        const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
        user.online = false;
        await redis.set(`user:${userId}`, JSON.stringify(user));
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Not found: ' + url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
