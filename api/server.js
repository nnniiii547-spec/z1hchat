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
        storyPrivacy: 'everyone',
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
      return res.status(200).json({ id: u.id, username: u.username, avatar: u.avatar, online: u.online, bio: u.bio || '', email: u.email, storyPrivacy: u.storyPrivacy || 'everyone' });
    }

    // UPDATE PROFILE
    if (req.method === 'POST' && url === '/api/update-profile') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId, username, bio, avatar, storyPrivacy } = body;

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
      if (storyPrivacy) user.storyPrivacy = storyPrivacy;

      await redis.set(`user:${userId}`, JSON.stringify(user));
      return res.status(200).json({ message: 'Profile updated', username: user.username, avatar: user.avatar, bio: user.bio, storyPrivacy: user.storyPrivacy });
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

    // STORIES - get all visible stories
    if (req.method === 'GET' && url === '/api/stories') {
      const params = new URL(req.url, 'http://x').searchParams;
      const viewerId = params.get('viewerId');
      const keys = await redis.keys('stories:*');
      const allStories = [];
      for (const key of keys) {
        const storyData = await redis.get(key);
        if (storyData) {
          let stories = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
          stories = stories.filter(s => new Date(s.expiresAt) > new Date());
          for (const s of stories) {
            const ownerData = await redis.get(`user:${s.userId}`);
            if (!ownerData) continue;
            const owner = typeof ownerData === 'string' ? JSON.parse(ownerData) : ownerData;
            const privacy = owner.storyPrivacy || 'everyone';
            if (privacy === 'nobody' && s.userId !== viewerId) continue;
            if (privacy === 'contacts' && s.userId !== viewerId) {
              // check if they follow each other (simplified: only contacts)
              // for now just show to everyone if contacts
            }
            allStories.push({ ...s, ownerPrivacy: privacy });
          }
          if (stories.length === 0) await redis.del(key);
          else await redis.set(key, JSON.stringify(stories));
        }
      }
      return res.status(200).json(allStories);
    }

    // GET MY STORIES
    if (req.method === 'GET' && url === '/api/stories/mine') {
      const params = new URL(req.url, 'http://x').searchParams;
      const userId = params.get('userId');
      const key = `stories:${userId}`;
      const storyData = await redis.get(key);
      let stories = storyData ? (typeof storyData === 'string' ? JSON.parse(storyData) : storyData) : [];
      stories = stories.filter(s => new Date(s.expiresAt) > new Date());
      if (stories.length === 0) await redis.del(key);
      else await redis.set(key, JSON.stringify(stories));
      return res.status(200).json(stories);
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

    // EDIT STORY
    if (req.method === 'POST' && url === '/api/stories/edit') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { storyId, userId, content, mediaUrl } = body;

      const key = `stories:${userId}`;
      const storyData = await redis.get(key);
      if (!storyData) return res.status(404).json({ error: 'No stories found' });
      let stories = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
      const idx = stories.findIndex(s => s.id === storyId);
      if (idx === -1) return res.status(404).json({ error: 'Story not found' });

      if (content !== undefined) stories[idx].content = content;
      if (mediaUrl !== undefined) stories[idx].mediaUrl = mediaUrl;
      stories[idx].edited = true;

      await redis.set(key, JSON.stringify(stories));
      return res.status(200).json(stories[idx]);
    }

    // DELETE STORY
    if (req.method === 'POST' && url === '/api/stories/delete') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { storyId, userId } = body;

      const key = `stories:${userId}`;
      const storyData = await redis.get(key);
      if (!storyData) return res.status(404).json({ error: 'No stories found' });
      let stories = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
      const before = stories.length;
      stories = stories.filter(s => s.id !== storyId);
      if (stories.length === before) return res.status(404).json({ error: 'Story not found' });

      if (stories.length === 0) await redis.del(key);
      else await redis.set(key, JSON.stringify(stories));

      return res.status(200).json({ ok: true, deletedId: storyId });
    }

    // ADMIN - GET SITE CONFIG
    if (req.method === 'GET' && url === '/api/admin/config') {
      const config = await redis.get('site:config');
      return res.status(200).json(config || {});
    }

    // ADMIN - SAVE SITE CONFIG
    if (req.method === 'POST' && url === '/api/admin/config') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { adminKey, config } = body;
      const storedKey = await redis.get('admin:key') || 'admin123';
      if (adminKey !== storedKey) return res.status(403).json({ error: 'Invalid admin key' });
      await redis.set('site:config', JSON.stringify(config));
      return res.status(200).json({ ok: true });
    }

    // ADMIN - CHANGE ADMIN KEY
    if (req.method === 'POST' && url === '/api/admin/key') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { oldKey, newKey } = body;
      const storedKey = await redis.get('admin:key') || 'admin123';
      if (oldKey !== storedKey) return res.status(403).json({ error: 'Invalid current key' });
      if (!newKey || newKey.length < 8) return res.status(400).json({ error: 'New key must be at least 8 characters' });
      await redis.set('admin:key', newKey);
      return res.status(200).json({ ok: true });
    }

    // ADMIN - DELETE USER
    if (req.method === 'POST' && url === '/api/admin/delete-user') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { adminKey, userId } = body;
      const storedKey = await redis.get('admin:key') || 'admin123';
      if (adminKey !== storedKey) return res.status(403).json({ error: 'Invalid admin key' });
      const userData = await redis.get(`user:${userId}`);
      if (!userData) return res.status(404).json({ error: 'User not found' });
      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      await redis.del(`user:${userId}`);
      await redis.del(`email:${user.email}`);
      await redis.del(`username:${user.username.toLowerCase()}`);
      await redis.del(`stories:${userId}`);
      return res.status(200).json({ ok: true, deletedUser: user.username });
    }

    // ADMIN - GET ALL STORIES
    if (req.method === 'GET' && url === '/api/admin/stories') {
      const keys = await redis.keys('stories:*');
      const allStories = [];
      for (const key of keys) {
        const storyData = await redis.get(key);
        if (storyData) {
          let stories = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
          stories = stories.filter(s => new Date(s.expiresAt) > new Date());
          allStories.push(...stories);
        }
      }
      return res.status(200).json(allStories);
    }

    // ADMIN - DELETE STORY
    if (req.method === 'POST' && url === '/api/admin/delete-story') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { adminKey, storyId, userId } = body;
      const storedKey = await redis.get('admin:key') || 'admin123';
      if (adminKey !== storedKey) return res.status(403).json({ error: 'Invalid admin key' });
      const key = `stories:${userId}`;
      const storyData = await redis.get(key);
      if (!storyData) return res.status(404).json({ error: 'No stories found' });
      let stories = typeof storyData === 'string' ? JSON.parse(storyData) : storyData;
      stories = stories.filter(s => s.id !== storyId);
      if (stories.length === 0) await redis.del(key);
      else await redis.set(key, JSON.stringify(stories));
      return res.status(200).json({ ok: true });
    }

    // ADMIN - GET ALL CHATS BETWEEN TWO USERS
    if (req.method === 'GET' && url.startsWith('/api/admin/chat')) {
      const params = new URL(req.url, 'http://x').searchParams;
      const user1 = params.get('user1');
      const user2 = params.get('user2');
      if (!user1 || !user2) return res.status(400).json({ error: 'Missing user1 or user2' });
      const chatKey = [user1, user2].sort().join(':');
      const msgData = await redis.get(`chat:${chatKey}`);
      let messages = msgData ? (typeof msgData === 'string' ? JSON.parse(msgData) : msgData) : [];
      return res.status(200).json(messages);
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
