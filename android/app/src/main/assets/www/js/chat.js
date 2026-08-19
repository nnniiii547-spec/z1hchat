const user = JSON.parse(localStorage.getItem('user'));
if (!user) {
  window.location.href = 'login.html';
}

const socket = io();

document.getElementById('myAvatar').src = user.avatar;
document.getElementById('myUsername').textContent = user.username;

socket.emit('user-online', user.id);

let currentChat = null;
let typingTimeout = null;

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    renderUsers(users.filter(u => u.id !== user.id));
  } catch (e) {
    console.error('Failed to load users:', e);
  }
}

function renderUsers(users) {
  const list = document.getElementById('usersList');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filtered = users.filter(u => u.username.toLowerCase().includes(search));

  const onlineUsers = filtered.filter(u => u.online);
  const offlineUsers = filtered.filter(u => !u.online);

  list.innerHTML = `
    <div class="section-title">Online (${onlineUsers.length})</div>
    ${onlineUsers.map(u => userItem(u)).join('')}
    ${offlineUsers.length > 0 ? `<div class="section-title">Offline (${offlineUsers.length})</div>` : ''}
    ${offlineUsers.map(u => userItem(u)).join('')}
  `;

  list.querySelectorAll('.user-item').forEach(item => {
    item.addEventListener('click', () => {
      const userId = item.dataset.userId;
      const username = item.dataset.username;
      const avatar = item.dataset.avatar;
      openChat(userId, username, avatar);
    });
  });
}

function userItem(u) {
  return `
    <div class="user-item ${currentChat && currentChat.id === u.id ? 'active' : ''}"
         data-user-id="${u.id}"
         data-username="${u.username}"
         data-avatar="${u.avatar}">
      <div class="avatar" style="position:relative;">
        <img src="${u.avatar}" alt="${u.username}" style="width:40px;height:40px;border-radius:50%;">
        <span class="status-dot ${u.online ? 'online' : 'offline'}"></span>
      </div>
      <span class="username">${u.username}</span>
    </div>
  `;
}

function openChat(userId, username, avatar) {
  currentChat = { id: userId, username, avatar };

  document.getElementById('chatPlaceholder').style.display = 'none';
  document.getElementById('chatActive').style.display = 'flex';
  document.getElementById('chatAvatar').src = avatar;
  document.getElementById('chatUsername').textContent = username;

  document.getElementById('typingIndicator').style.display = 'none';

  socket.emit('get-messages', { userId: user.id, chatWithId: userId });

  loadUsers();
}

socket.on('chat-messages', (messages) => {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';
  messages.forEach(msg => appendMessage(msg));
  container.scrollTop = container.scrollHeight;
});

function appendMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  const isSent = msg.senderId === user.id;
  div.className = `message ${isSent ? 'sent' : 'received'}`;

  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    ${msg.content}
    <span class="message-time">${time}</span>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

socket.on('message-sent', (msg) => {
  if (currentChat && msg.receiverId === currentChat.id) {
    appendMessage(msg);
  }
});

socket.on('receive-message', (msg) => {
  if (currentChat && msg.senderId === currentChat.id) {
    appendMessage(msg);
  }
});

socket.on('user-status', (data) => {
  loadUsers();
  if (currentChat && data.userId === currentChat.id) {
    document.getElementById('chatStatus').textContent = data.online ? 'Online' : 'Offline';
    document.getElementById('chatStatus').className = `status-text ${data.online ? 'online' : ''}`;
  }
});

socket.on('user-typing', (data) => {
  if (currentChat && data.senderId === currentChat.id) {
    const indicator = document.getElementById('typingIndicator');
    indicator.style.display = 'flex';
    document.getElementById('typingText').textContent = `${data.senderName} is typing...`;
  }
});

socket.on('user-stop-typing', (data) => {
  if (currentChat && data.senderId === currentChat.id) {
    document.getElementById('typingIndicator').style.display = 'none';
  }
});

document.getElementById('messageForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentChat) return;

  socket.emit('send-message', {
    senderId: user.id,
    senderName: user.username,
    senderAvatar: user.avatar,
    receiverId: currentChat.id,
    content
  });

  input.value = '';
  socket.emit('stop-typing', { senderId: user.id, receiverId: currentChat.id });
});

document.getElementById('messageInput').addEventListener('input', (e) => {
  if (!currentChat) return;
  socket.emit('typing', { senderId: user.id, receiverId: currentChat.id, senderName: user.username });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop-typing', { senderId: user.id, receiverId: currentChat.id });
  }, 2000);
});

document.getElementById('searchInput').addEventListener('input', loadUsers);

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('user');
  socket.disconnect();
  window.location.href = 'index.html';
});

loadUsers();
setInterval(loadUsers, 10000);
