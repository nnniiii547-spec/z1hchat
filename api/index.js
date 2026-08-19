const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

let users = [];
let messages = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { method, url } = req;

  // POST /api/register
  if (method === 'POST' && url === '/api/register') {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username already taken' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), username, email, password: hashedPassword, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, createdAt: new Date().toISOString(), online: true };
    users.push(user);
    return res.json({ message: 'Account created', userId: user.id, username: user.username, avatar: user.avatar });
  }

  // POST /api/login
  if (method === 'POST' && url === '/api/login') {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid email or password' });
    user.online = true;
    return res.json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar });
  }

  // GET /api/users
  if (method === 'GET' && url === '/api/users') {
    return res.json(users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, online: u.online })));
  }

  // GET /api/messages?user1=xxx&user2=yyy
  if (method === 'GET' && url.startsWith('/api/messages')) {
    const params = new URL(url, 'http://x').searchParams;
    const user1 = params.get('user1');
    const user2 = params.get('user2');
    const after = params.get('after');
    let chat = messages.filter(m =>
      (m.senderId === user1 && m.receiverId === user2) ||
      (m.senderId === user2 && m.receiverId === user1)
    );
    if (after) chat = chat.filter(m => m.timestamp > after);
    return res.json(chat);
  }

  // POST /api/messages
  if (method === 'POST' && url === '/api/messages') {
    const { senderId, senderName, senderAvatar, receiverId, content } = req.body;
    const msg = { id: uuidv4(), senderId, senderName, senderAvatar, receiverId, content, timestamp: new Date().toISOString() };
    messages.push(msg);
    if (messages.length > 1000) messages = messages.slice(-500);
    return res.json(msg);
  }

  // POST /api/online
  if (method === 'POST' && url === '/api/online') {
    const { userId } = req.body;
    const user = users.find(u => u.id === userId);
    if (user) user.online = true;
    return res.json({ ok: true });
  }

  // POST /api/offline
  if (method === 'POST' && url === '/api/offline') {
    const { userId } = req.body;
    const user = users.find(u => u.id === userId);
    if (user) user.online = false;
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: 'Not found' });
};
