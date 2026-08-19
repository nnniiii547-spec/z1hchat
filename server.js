const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    createdAt: new Date().toISOString(),
    online: false
  };
  users.push(user);
  writeJSON(USERS_FILE, users);
  res.json({ message: 'Account created successfully', userId: user.id, username: user.username, avatar: user.avatar });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ message: 'Login successful', userId: user.id, username: user.username, avatar: user.avatar });
});

app.get('/api/users/:id', (req, res) => {
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, avatar: user.avatar, online: user.online });
});

app.get('/api/users', (req, res) => {
  const users = readJSON(USERS_FILE);
  res.json(users.map(u => ({ id: u.id, username: u.username, avatar: u.avatar, online: u.online })));
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.id === userId);
    if (user) {
      user.online = true;
      writeJSON(USERS_FILE, users);
    }
    io.emit('user-status', { userId, online: true });
  });

  socket.on('send-message', (data) => {
    const messages = readJSON(MESSAGES_FILE);
    const message = {
      id: uuidv4(),
      senderId: data.senderId,
      senderName: data.senderName,
      senderAvatar: data.senderAvatar,
      receiverId: data.receiverId,
      content: data.content,
      timestamp: new Date().toISOString()
    };
    messages.push(message);
    writeJSON(MESSAGES_FILE, messages);

    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('receive-message', message);
    }
    socket.emit('message-sent', message);
  });

  socket.on('typing', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('user-typing', { senderId: data.senderId, senderName: data.senderName });
    }
  });

  socket.on('stop-typing', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('user-stop-typing', { senderId: data.senderId });
    }
  });

  socket.on('get-messages', (data) => {
    const messages = readJSON(MESSAGES_FILE);
    const chatMessages = messages.filter(m =>
      (m.senderId === data.userId && m.receiverId === data.chatWithId) ||
      (m.senderId === data.chatWithId && m.receiverId === data.userId)
    );
    socket.emit('chat-messages', chatMessages);
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.id === userId);
        if (user) {
          user.online = false;
          writeJSON(USERS_FILE, users);
        }
        io.emit('user-status', { userId, online: false });
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Z1HCHAT running on port ${PORT}`);
});
