const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const users = [];
const messages = [];

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
      if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
      if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username already taken' });
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = { id: uuidv4(), username, email, password: hashedPassword, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, createdAt: new Date().toISOString(), online: true };
      users.push(user);
      return res.status(200).json({ message: 'Account created', userId: user.id, username: user.username, avatar: user.avatar });
    }

    if (req.method === 'POST' && url === '/api/login') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { email, password } = body;
      const user = users.find(u => u.email === email);
      if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid email or password' });
      user.online = true;
      return res.status(200).json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar });
    }

    if (req.method === 'GET' && url === '/api/users') {
      return res.status(200).json(users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, online: u.online })));
    }

    if (req.method === 'GET' && url.startsWith('/api/messages')) {
      const params = new URL(req.url, 'http://x').searchParams;
      const user1 = params.get('user1');
      const user2 = params.get('user2');
      const after = params.get('after');
      let chat = messages.filter(m =>
        (m.senderId === user1 && m.receiverId === user2) ||
        (m.senderId === user2 && m.receiverId === user1)
      );
      if (after) chat = chat.filter(m => m.timestamp > after);
      return res.status(200).json(chat);
    }

    if (req.method === 'POST' && url === '/api/messages') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { senderId, senderName, senderAvatar, receiverId, content } = body;
      const msg = { id: uuidv4(), senderId, senderName, senderAvatar, receiverId, content, timestamp: new Date().toISOString() };
      messages.push(msg);
      return res.status(200).json(msg);
    }

    if (req.method === 'POST' && url === '/api/online') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId } = body;
      const user = users.find(u => u.id === userId);
      if (user) user.online = true;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && url === '/api/offline') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { userId } = body;
      const user = users.find(u => u.id === userId);
      if (user) user.online = false;
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Not found: ' + url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
