const { Redis } = require('@upstash/redis');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url ? req.url.split('?')[0] : '/';

  try {
    if (req.method === 'POST' && url === '/api/register') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { username, email, password } = body;
      if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

      const existingEmail = await redis.get(`email:${email}`);
      if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

      const existingUser = await redis.get(`username:${username}`);
      if (existingUser) return res.status(400).json({ error: 'Username already taken' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      const user = {
        id: userId,
        username,
        email,
        password: hashedPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        createdAt: new Date().toISOString(),
        online: false
      };

      await redis.set(`user:${userId}`, JSON.stringify(user));
      await redis.set(`email:${email}`, userId);
      await redis.set(`username:${username}`, userId);

      return res.status(200).json({ message: 'Account created', userId, username, avatar: user.avatar });
    }

    if (req.method === 'POST' && url === '/api/login') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { email, password } = body;

      const userId = await redis.get(`email:${email}`);
      if (!userId) return res.status(401).json({ error: 'Invalid email or password' });

      const userData = await redis.get(`user:${userId}`);
      if (!userData) return res.status(401).json({ error: 'Invalid email or password' });

      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid email or password' });

      user.online = true;
      await redis.set(`user:${userId}`, JSON.stringify(user));

      return res.status(200).json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar });
    }

    if (req.method === 'GET' && url === '/api/users') {
      const keys = await redis.keys('user:*');
      const users = [];
      for (const key of keys) {
        const userData = await redis.get(key);
        if (userData) {
          const u = typeof userData === 'string' ? JSON.parse(userData) : userData;
          users.push({ id: u.id, username: u.username, avatar: u.avatar, online: u.online });
        }
      }
      return res.status(200).json(users);
    }

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

    if (req.method === 'POST' && url === '/api/messages') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { senderId, senderName, senderAvatar, receiverId, content } = body;
      const msg = { id: uuidv4(), senderId, senderName, senderAvatar, receiverId, content, timestamp: new Date().toISOString() };

      const chatKey = [senderId, receiverId].sort().join(':');
      const existing = await redis.get(`chat:${chatKey}`);
      let messages = existing ? (typeof existing === 'string' ? JSON.parse(existing) : existing) : [];
      messages.push(msg);
      if (messages.length > 500) messages = messages.slice(-300);
      await redis.set(`chat:${chatKey}`, JSON.stringify(messages));

      return res.status(200).json(msg);
    }

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
