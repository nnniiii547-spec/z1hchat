const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
app.use(express.json());

const users = [];
const messages = [];

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username already taken' });
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), username, email, password: hashedPassword, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, createdAt: new Date().toISOString(), online: true };
  users.push(user);
  res.json({ message: 'Account created', userId: user.id, username: user.username, avatar: user.avatar });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid email or password' });
  user.online = true;
  res.json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar });
});

app.get('/api/users', (req, res) => {
  res.json(users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, online: u.online })));
});

app.get('/api/messages', (req, res) => {
  const { user1, user2, after } = req.query;
  let chat = messages.filter(m =>
    (m.senderId === user1 && m.receiverId === user2) ||
    (m.senderId === user2 && m.receiverId === user1)
  );
  if (after) chat = chat.filter(m => m.timestamp > after);
  res.json(chat);
});

app.post('/api/messages', (req, res) => {
  const { senderId, senderName, senderAvatar, receiverId, content } = req.body;
  const msg = { id: uuidv4(), senderId, senderName, senderAvatar, receiverId, content, timestamp: new Date().toISOString() };
  messages.push(msg);
  res.json(msg);
});

app.post('/api/online', (req, res) => {
  const { userId } = req.body;
  const user = users.find(u => u.id === userId);
  if (user) user.online = true;
  res.json({ ok: true });
});

app.post('/api/offline', (req, res) => {
  const { userId } = req.body;
  const user = users.find(u => u.id === userId);
  if (user) user.online = false;
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
