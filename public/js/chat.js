const user = JSON.parse(localStorage.getItem('user'));
if (!user) window.location.href = 'login.html';

let currentChat = null;
let lastMessageTime = null;
let pollInterval = null;
const isMobile = () => window.innerWidth <= 768;

document.getElementById('myAvatar').src = user.avatar;
document.getElementById('myUsername').textContent = user.username;

const sidebar = document.getElementById('sidebar');

fetch('/api/online', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id })
});

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const users = await res.json();
    renderUsers(users.filter(u => u.id !== user.id));
  } catch (e) {}
}

function renderUsers(users) {
  const list = document.getElementById('usersList');
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filtered = users.filter(u => u.username.toLowerCase().includes(search));
  const online = filtered.filter(u => u.online);
  const offline = filtered.filter(u => !u.online);

  list.innerHTML = `
    <div class="section-title">Online (${online.length})</div>
    ${online.map(u => userItem(u)).join('')}
    ${offline.length ? `<div class="section-title">Offline (${offline.length})</div>` : ''}
    ${offline.map(u => userItem(u)).join('')}
  `;

  list.querySelectorAll('.user-item').forEach(item => {
    item.addEventListener('click', () => {
      openChat(item.dataset.userId, item.dataset.username, item.dataset.avatar);
    });
  });
}

function userItem(u) {
  return `
    <div class="user-item ${currentChat && currentChat.id === u.id ? 'active' : ''}"
         data-user-id="${u.id}" data-username="${u.username}" data-avatar="${u.avatar}">
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
  lastMessageTime = null;
  document.getElementById('chatPlaceholder').style.display = 'none';
  document.getElementById('chatActive').style.display = 'flex';
  document.getElementById('chatAvatar').src = avatar;
  document.getElementById('chatUsername').textContent = username;
  document.getElementById('typingIndicator').style.display = 'none';
  document.getElementById('messagesContainer').innerHTML = '';

  if (pollInterval) clearInterval(pollInterval);
  pollMessages();
  pollInterval = setInterval(pollMessages, 2000);
  loadUsers();

  if (isMobile()) {
    sidebar.classList.add('hidden');
  }
}

document.getElementById('backBtn').addEventListener('click', () => {
  sidebar.classList.remove('hidden');
  if (isMobile()) {
    document.getElementById('chatPlaceholder').style.display = 'flex';
    document.getElementById('chatActive').style.display = 'none';
    currentChat = null;
  }
});

async function pollMessages() {
  if (!currentChat) return;
  try {
    let url = `/api/messages?user1=${user.id}&user2=${currentChat.id}`;
    if (lastMessageTime) url += `&after=${encodeURIComponent(lastMessageTime)}`;
    const res = await fetch(url);
    const msgs = await res.json();
    if (msgs.length > 0) {
      msgs.forEach(msg => appendMessage(msg));
      lastMessageTime = msgs[msgs.length - 1].timestamp;
    }
  } catch (e) {}
}

function appendMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  const isSent = msg.senderId === user.id;
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `${msg.content}<span class="message-time">${time}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

document.getElementById('messageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentChat) return;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: user.id,
        senderName: user.username,
        senderAvatar: user.avatar,
        receiverId: currentChat.id,
        content
      })
    });
    const msg = await res.json();
    appendMessage(msg);
    lastMessageTime = msg.timestamp;
  } catch (e) {}
  input.value = '';
});

document.getElementById('searchInput').addEventListener('input', loadUsers);

document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (pollInterval) clearInterval(pollInterval);
  await fetch('/api/offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  });
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
  });
}

loadUsers();
setInterval(loadUsers, 5000);
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/offline', new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' }));
});
