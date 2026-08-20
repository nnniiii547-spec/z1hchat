const user = JSON.parse(localStorage.getItem('user'));
if (!user) window.location.href = 'login.html';

let currentChat = null;
let lastMessageTime = null;
let pollInterval = null;
let allMessages = [];
const isMobile = () => window.innerWidth <= 768;

const sidebar = document.getElementById('sidebar');

document.getElementById('myAvatar').src = user.avatar;
document.getElementById('myUsername').textContent = user.username;

fetch('/api/online', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id })
});

// --- STORIES ---
async function loadStories() {
  try {
    const res = await fetch('/api/stories');
    const stories = await res.json();
    const bar = document.getElementById('storiesBar');
    if (!bar) return;
    if (stories.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = stories.map(s => `
      <div class="story-item" data-story='${JSON.stringify(s).replace(/'/g,"&apos;")}'>
        <img src="${s.avatar}" class="story-avatar" alt="">
        <span class="story-name">${s.username}</span>
      </div>
    `).join('');
    bar.querySelectorAll('.story-item').forEach(el => {
      el.onclick = () => showStory(JSON.parse(el.dataset.story));
    });
  } catch(e) {}
}

function showStory(story) {
  const overlay = document.getElementById('storyOverlay');
  overlay.style.display = 'flex';
  overlay.querySelector('.story-content').innerHTML = story.mediaUrl
    ? `<img src="${story.mediaUrl}" style="max-width:90%;max-height:80vh;border-radius:12px;">`
    : `<div style="background:var(--gradient);padding:40px;border-radius:16px;max-width:300px;text-align:center;font-size:20px;">${story.content}</div>`;
  overlay.querySelector('.story-author').textContent = story.username;
  setTimeout(() => { overlay.style.display = 'none'; }, 5000);
}

// --- USERS ---
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
  allMessages = [];
  document.getElementById('chatPlaceholder').style.display = 'none';
  document.getElementById('chatActive').style.display = 'flex';
  document.getElementById('chatAvatar').src = avatar;
  document.getElementById('chatUsername').textContent = username;
  document.getElementById('typingIndicator').style.display = 'none';
  document.getElementById('messagesContainer').innerHTML = '';
  hideContextMenu();

  if (pollInterval) clearInterval(pollInterval);
  pollMessages();
  pollInterval = setInterval(pollMessages, 2000);
  loadUsers();

  if (isMobile()) sidebar.classList.add('hidden');
}

document.getElementById('backBtn').addEventListener('click', () => {
  sidebar.classList.remove('hidden');
  if (isMobile()) {
    document.getElementById('chatPlaceholder').style.display = 'flex';
    document.getElementById('chatActive').style.display = 'none';
    currentChat = null;
    hideContextMenu();
  }
});

// --- MESSAGES ---
async function pollMessages() {
  if (!currentChat) return;
  try {
    let url = `/api/messages?user1=${user.id}&user2=${currentChat.id}`;
    if (lastMessageTime) url += `&after=${encodeURIComponent(lastMessageTime)}`;
    const res = await fetch(url);
    const msgs = await res.json();
    if (msgs.length > 0) {
      msgs.forEach(msg => {
        allMessages.push(msg);
        appendMessage(msg);
      });
      lastMessageTime = msgs[msgs.length - 1].timestamp;
    }
  } catch (e) {}
}

function appendMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  const isSent = msg.senderId === user.id;
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.dataset.id = msg.id;
  div.dataset.sender = msg.senderId;
  div.dataset.content = msg.content || '';
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const editedTag = msg.edited ? ' <em>(edited)</em>' : '';

  if (msg.type === 'voice') {
    div.innerHTML = `<audio controls src="${msg.content}" style="max-width:200px;height:36px;"></audio><span class="message-time">${time}${editedTag}</span>`;
  } else {
    div.innerHTML = `<span class="msg-text">${msg.content}</span><span class="message-time">${time}${editedTag}</span>`;
  }

  // Right-click / long-press menu (only on own messages)
  if (isSent) {
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, msg);
    });
    let touchTimer;
    div.addEventListener('touchstart', (e) => {
      touchTimer = setTimeout(() => {
        e.preventDefault();
        showContextMenu(e, msg);
      }, 500);
    }, { passive: false });
    div.addEventListener('touchend', () => clearTimeout(touchTimer));
    div.addEventListener('touchmove', () => clearTimeout(touchTimer));
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// --- CONTEXT MENU ---
const ctxMenu = document.getElementById('contextMenu');
const ctxOverlay = document.getElementById('ctxOverlay');

function showContextMenu(e, msg) {
  hideContextMenu();
  const rect = (e.target || e.touches?.[0]?.target).getBoundingClientRect();
  const x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left);
  const y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : rect.top);

  ctxMenu.style.display = 'block';
  ctxOverlay.style.display = 'block';
  ctxMenu.dataset.msgId = msg.id;
  ctxMenu.dataset.content = msg.content;

  const menuW = 140;
  const menuH = 90;
  let left = x;
  let top = y;
  if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 10;
  if (top + menuH > window.innerHeight) top = window.innerHeight - menuH - 10;
  if (top < 10) top = 10;
  if (left < 10) left = 10;

  ctxMenu.style.left = left + 'px';
  ctxMenu.style.top = top + 'px';
}

function hideContextMenu() {
  if (ctxMenu) ctxMenu.style.display = 'none';
  if (ctxOverlay) ctxOverlay.style.display = 'none';
}

if (ctxOverlay) ctxOverlay.addEventListener('click', hideContextMenu);

document.getElementById('ctxEdit')?.addEventListener('click', () => {
  const content = ctxMenu.dataset.content;
  const input = document.getElementById('messageInput');
  input.value = content;
  input.dataset.editId = ctxMenu.dataset.msgId;
  input.placeholder = 'Edit message...';
  input.focus();
  hideContextMenu();
});

document.getElementById('ctxDelete')?.addEventListener('click', async () => {
  const messageId = ctxMenu.dataset.msgId;
  hideContextMenu();
  try {
    const res = await fetch('/api/messages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId,
        senderId: user.id,
        user1: user.id,
        user2: currentChat.id
      })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    const el = document.querySelector(`.message[data-id="${messageId}"]`);
    if (el) el.remove();
    allMessages = allMessages.filter(m => m.id !== messageId);
  } catch (e) {}
});

async function sendMessage(content, type = 'text') {
  if (!content || !currentChat) return;
  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: user.id, senderName: user.username, senderAvatar: user.avatar,
        receiverId: currentChat.id, content, type
      })
    });
    const msg = await res.json();
    appendMessage(msg);
    allMessages.push(msg);
    lastMessageTime = msg.timestamp;
  } catch (e) {}
}

// --- TEXT MESSAGE / EDIT ---
document.getElementById('messageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  const editId = input.dataset.editId;
  if (editId) {
    // Edit existing message
    try {
      const res = await fetch('/api/messages/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: editId,
          senderId: user.id,
          user1: user.id,
          user2: currentChat.id,
          newContent: content
        })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      const el = document.querySelector(`.message[data-id="${editId}"]`);
      if (el) {
        el.dataset.content = content;
        const txt = el.querySelector('.msg-text');
        if (txt) txt.textContent = content;
        const time = el.querySelector('.message-time');
        if (time && !time.textContent.includes('(edited)')) {
          time.textContent += ' (edited)';
        }
      }
      const stored = allMessages.find(m => m.id === editId);
      if (stored) { stored.content = content; stored.edited = true; }
      delete input.dataset.editId;
      input.placeholder = 'Type a message...';
    } catch (e) {}
  } else {
    await sendMessage(content, 'text');
  }
  input.value = '';
});

// --- VOICE MESSAGE ---
let mediaRecorder = null;
let audioChunks = [];

document.getElementById('voiceBtn').addEventListener('mousedown', startRecording);
document.getElementById('voiceBtn').addEventListener('mouseup', stopRecording);
document.getElementById('voiceBtn').addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
document.getElementById('voiceBtn').addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        sendMessage(reader.result, 'voice');
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    document.getElementById('voiceBtn').classList.add('recording');
  } catch (e) {
    alert('Microphone access denied');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    document.getElementById('voiceBtn').classList.remove('recording');
  }
}

// --- SEARCH ---
document.getElementById('searchInput').addEventListener('input', loadUsers);

// --- LOGOUT ---
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

// --- EDIT PROFILE ---
document.getElementById('editProfileBtn').addEventListener('click', () => {
  document.getElementById('editOverlay').style.display = 'flex';
  document.getElementById('editName').value = user.username;
  document.getElementById('editBio').value = '';
  document.getElementById('editAvatarUrl').value = user.avatar;
});

document.getElementById('editOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('editOverlay')) {
    document.getElementById('editOverlay').style.display = 'none';
  }
});

document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('editName').value.trim();
  const bio = document.getElementById('editBio').value.trim();
  const avatar = document.getElementById('editAvatarUrl').value.trim();

  const fileInput = document.getElementById('editAvatarFile');
  let finalAvatar = avatar;

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    finalAvatar = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  try {
    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, username, bio, avatar: finalAvatar })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    user.username = data.username;
    user.avatar = data.avatar;
    localStorage.setItem('user', JSON.stringify(user));
    document.getElementById('myAvatar').src = user.avatar;
    document.getElementById('myUsername').textContent = user.username;
    document.getElementById('editOverlay').style.display = 'none';
    loadUsers();
  } catch (e) {
    alert('Error updating profile');
  }
});

// --- POST STORY ---
document.getElementById('storyBtn').addEventListener('click', () => {
  document.getElementById('storyOverlay2').style.display = 'flex';
});

document.getElementById('storyOverlay2').addEventListener('click', (e) => {
  if (e.target === document.getElementById('storyOverlay2')) {
    document.getElementById('storyOverlay2').style.display = 'none';
  }
});

document.getElementById('storyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = document.getElementById('storyText').value.trim();
  const fileInput = document.getElementById('storyFile');
  let mediaUrl = '';

  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    mediaUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  if (!content && !mediaUrl) return;

  try {
    await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id, username: user.username, avatar: user.avatar,
        content, mediaUrl, type: mediaUrl ? 'image' : 'text'
      })
    });
    document.getElementById('storyText').value = '';
    document.getElementById('storyOverlay2').style.display = 'none';
    loadStories();
  } catch (e) {}
});

// --- KEYBOARD FIX ---
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
  });
}

// --- INIT ---
loadUsers();
loadStories();
setInterval(loadUsers, 5000);
setInterval(loadStories, 10000);
window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/offline', new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' }));
});
