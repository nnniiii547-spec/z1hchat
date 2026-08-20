const user = JSON.parse(localStorage.getItem('user'));
if (!user) window.location.href = 'login.html';

let currentChat = null;
let lastMessageTime = null;
let pollInterval = null;
let allMessages = [];
let currentViewingStory = null;
let storyTimeout = null;
const isMobile = () => window.innerWidth <= 768;

const sidebar = document.getElementById('sidebar');

document.getElementById('myAvatar').src = user.avatar;
document.getElementById('myUsername').textContent = user.username;

// --- NAV PANEL SWITCHING ---
document.getElementById('navAvatar').src = user.avatar;
var navBtns = document.querySelectorAll('.nav-btn[data-panel]');
navBtns.forEach(function(btn) {
  btn.addEventListener('click', function() {
    var panel = btn.dataset.panel;
    navBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById('panel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (target) target.classList.add('active');
    if (panel === 'stories') loadStoryFeed();
    if (panel === 'profile') loadProfilePanel();
  });
});

function loadProfilePanel() {
  document.getElementById('profileAvatar').src = user.avatar;
  document.getElementById('profileName').textContent = user.username;
  document.getElementById('profileBio').textContent = user.bio || 'No bio yet';
}

async function loadStoryFeed() {
  var list = document.getElementById('storyFeedList');
  list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Loading...</p>';
  try {
    var res = await fetch('/api/stories?viewerId=' + user.id);
    var stories = await res.json();
    if (stories.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">No stories yet</p>';
      return;
    }
    list.innerHTML = stories.map(function(s) {
      var timeLeft = Math.max(0, Math.floor((new Date(s.expiresAt) - new Date()) / (1000 * 60 * 60)));
      var isMine = s.userId === user.id;
      return '<div class="feed-story-item" data-story=\'' + JSON.stringify(s).replace(/'/g, '&apos;') + '\'>' +
        '<img src="' + s.avatar + '" class="feed-story-avatar" alt="">' +
        '<div class="feed-story-info">' +
          '<span class="feed-story-name">' + s.username + (isMine ? ' (You)' : '') + '</span>' +
          '<span class="feed-story-time">' + timeLeft + 'h left</span>' +
        '</div>' +
        (isMine ? '<button class="feed-story-delete" data-id="' + s.id + '">\u2715</button>' : '') +
      '</div>';
    }).join('');

    list.querySelectorAll('.feed-story-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.classList.contains('feed-story-delete')) return;
        showStory(JSON.parse(el.dataset.story));
      });
    });

    list.querySelectorAll('.feed-story-delete').forEach(function(btn) {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        if (!confirm('Delete this story?')) return;
        await fetch('/api/stories/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId: btn.dataset.id, userId: user.id })
        });
        loadStories();
        loadStoryFeed();
      });
    });
  } catch(e) {
    list.innerHTML = '<p style="color:var(--danger);text-align:center;padding:20px;">Error loading stories</p>';
  }
}

document.getElementById('storyFeedBtn').addEventListener('click', function() {
  document.querySelector('.nav-btn[data-panel="stories"]').click();
});

fetch('/api/online', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id })
});

// --- STORIES ---
async function loadStories() {
  try {
    const res = await fetch('/api/stories?viewerId=' + user.id);
    const stories = await res.json();
    const bar = document.getElementById('storiesBar');
    if (!bar) return;
    if (stories.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = stories.map(s =>
      '<div class="story-item" data-story=\'' + JSON.stringify(s).replace(/'/g, '&apos;') + '\'>' +
        '<img src="' + s.avatar + '" class="story-avatar" alt="">' +
        '<span class="story-name">' + s.username + '</span>' +
      '</div>'
    ).join('');
    bar.querySelectorAll('.story-item').forEach(el => {
      el.onclick = () => showStory(JSON.parse(el.dataset.story));
    });
  } catch(e) {}
}

function showStory(story) {
  currentViewingStory = story;
  const overlay = document.getElementById('storyOverlay');
  overlay.style.display = 'flex';
  document.getElementById('storyViewContent').innerHTML = story.mediaUrl
    ? '<img src="' + story.mediaUrl + '" style="max-width:90%;max-height:70vh;border-radius:12px;">'
    : '<div style="background:var(--gradient);padding:40px;border-radius:16px;max-width:300px;text-align:center;font-size:20px;">' + story.content + '</div>';
  document.getElementById('storyAuthor').textContent = story.username;

  const actions = document.getElementById('storyViewActions');
  actions.style.display = story.userId === user.id ? 'flex' : 'none';

  if (storyTimeout) clearTimeout(storyTimeout);
  storyTimeout = setTimeout(() => { overlay.style.display = 'none'; }, 5000);
}

document.getElementById('storyCloseBtn').addEventListener('click', () => {
  document.getElementById('storyOverlay').style.display = 'none';
  if (storyTimeout) { clearTimeout(storyTimeout); storyTimeout = null; }
});

document.getElementById('storyOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('storyOverlay')) {
    document.getElementById('storyOverlay').style.display = 'none';
    if (storyTimeout) { clearTimeout(storyTimeout); storyTimeout = null; }
  }
});

// --- DELETE STORY ---
document.getElementById('storyDeleteBtn').addEventListener('click', async () => {
  if (!currentViewingStory) return;
  if (!confirm('Delete this story?')) return;
  try {
    const res = await fetch('/api/stories/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: currentViewingStory.id, userId: user.id })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    document.getElementById('storyOverlay').style.display = 'none';
    if (storyTimeout) { clearTimeout(storyTimeout); storyTimeout = null; }
    loadStories();
  } catch(e) { alert('Error deleting story'); }
});

// --- EDIT STORY ---
document.getElementById('storyEditBtn').addEventListener('click', () => {
  if (!currentViewingStory) return;
  document.getElementById('storyOverlay').style.display = 'none';
  if (storyTimeout) { clearTimeout(storyTimeout); storyTimeout = null; }
  document.getElementById('editStoryOverlay').style.display = 'flex';
  document.getElementById('editStoryText').value = currentViewingStory.content || '';
  document.getElementById('editStoryFile').value = '';
  var lbl = document.querySelector('label[for="editStoryFile"] .file-upload-label');
  if (lbl) lbl.textContent = 'Choose new image';
});

document.getElementById('editStoryOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('editStoryOverlay')) {
    document.getElementById('editStoryOverlay').style.display = 'none';
  }
});

document.getElementById('editStoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentViewingStory) return;
  var content = document.getElementById('editStoryText').value.trim();
  var fileInput = document.getElementById('editStoryFile');
  var mediaUrl = currentViewingStory.mediaUrl;

  if (fileInput.files.length > 0) {
    var file = fileInput.files[0];
    mediaUrl = await new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(reader.result); };
      reader.readAsDataURL(file);
    });
  }

  if (!content && !mediaUrl) return;

  try {
    var res = await fetch('/api/stories/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: currentViewingStory.id, userId: user.id, content: content, mediaUrl: mediaUrl })
    });
    var data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    document.getElementById('editStoryOverlay').style.display = 'none';
    loadStories();
  } catch(e) { alert('Error editing story'); }
});

// --- USERS ---
async function loadUsers() {
  try {
    var res = await fetch('/api/users');
    var users = await res.json();
    renderUsers(users.filter(function(u) { return u.id !== user.id; }));
  } catch (e) {}
}

function renderUsers(users) {
  var list = document.getElementById('usersList');
  var search = document.getElementById('searchInput').value.toLowerCase();
  var filtered = users.filter(function(u) { return u.username.toLowerCase().includes(search); });
  var online = filtered.filter(function(u) { return u.online; });
  var offline = filtered.filter(function(u) { return !u.online; });

  list.innerHTML =
    '<div class="section-title">Online (' + online.length + ')</div>' +
    online.map(userItem).join('') +
    (offline.length ? '<div class="section-title">Offline (' + offline.length + ')</div>' : '') +
    offline.map(userItem).join('');

  list.querySelectorAll('.user-item').forEach(function(item) {
    item.addEventListener('click', function() {
      openChat(item.dataset.userId, item.dataset.username, item.dataset.avatar);
    });
  });
}

function userItem(u) {
  var active = currentChat && currentChat.id === u.id ? ' active' : '';
  return '<div class="user-item' + active + '" data-user-id="' + u.id + '" data-username="' + u.username + '" data-avatar="' + u.avatar + '">' +
    '<div class="avatar" style="position:relative;">' +
      '<img src="' + u.avatar + '" alt="' + u.username + '" style="width:40px;height:40px;border-radius:50%;">' +
      '<span class="status-dot ' + (u.online ? 'online' : 'offline') + '"></span>' +
    '</div>' +
    '<span class="username">' + u.username + '</span>' +
  '</div>';
}

function openChat(userId, username, avatar) {
  currentChat = { id: userId, username: username, avatar: avatar };
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

document.getElementById('backBtn').addEventListener('click', function() {
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
    var url = '/api/messages?user1=' + user.id + '&user2=' + currentChat.id;
    if (lastMessageTime) url += '&after=' + encodeURIComponent(lastMessageTime);
    var res = await fetch(url);
    var msgs = await res.json();
    if (msgs.length > 0) {
      msgs.forEach(function(msg) {
        allMessages.push(msg);
        appendMessage(msg);
      });
      lastMessageTime = msgs[msgs.length - 1].timestamp;
    }
  } catch (e) {}
}

function appendMessage(msg) {
  var container = document.getElementById('messagesContainer');
  var div = document.createElement('div');
  var isSent = msg.senderId === user.id;
  div.className = 'message ' + (isSent ? 'sent' : 'received');
  div.dataset.id = msg.id;
  div.dataset.sender = msg.senderId;
  div.dataset.content = msg.content || '';
  var time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var editedTag = msg.edited ? ' <em>(edited)</em>' : '';

  if (msg.type === 'voice') {
    div.innerHTML = '<audio controls src="' + msg.content + '" style="max-width:200px;height:36px;"></audio><span class="message-time">' + time + editedTag + '</span>';
  } else {
    div.innerHTML = '<span class="msg-text">' + msg.content + '</span><span class="message-time">' + time + editedTag + '</span>';
  }

  if (isSent) {
    div.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      showContextMenu(e, msg);
    });
    var touchTimer;
    div.addEventListener('touchstart', function(e) {
      touchTimer = setTimeout(function() {
        e.preventDefault();
        showContextMenu(e, msg);
      }, 500);
    }, { passive: false });
    div.addEventListener('touchend', function() { clearTimeout(touchTimer); });
    div.addEventListener('touchmove', function() { clearTimeout(touchTimer); });
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// --- CONTEXT MENU ---
var ctxMenu = document.getElementById('contextMenu');
var ctxOverlay = document.getElementById('ctxOverlay');

function showContextMenu(e, msg) {
  hideContextMenu();
  var x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  var y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

  ctxMenu.style.display = 'block';
  ctxOverlay.style.display = 'block';
  ctxMenu.dataset.msgId = msg.id;
  ctxMenu.dataset.content = msg.content;

  var left = x;
  var top = y;
  if (left + 140 > window.innerWidth) left = window.innerWidth - 150;
  if (top + 90 > window.innerHeight) top = window.innerHeight - 100;
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

document.getElementById('ctxEdit').addEventListener('click', function() {
  var content = ctxMenu.dataset.content;
  var input = document.getElementById('messageInput');
  input.value = content;
  input.dataset.editId = ctxMenu.dataset.msgId;
  input.placeholder = 'Edit message...';
  input.focus();
  hideContextMenu();
});

document.getElementById('ctxDelete').addEventListener('click', async function() {
  var messageId = ctxMenu.dataset.msgId;
  hideContextMenu();
  try {
    var res = await fetch('/api/messages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: messageId, senderId: user.id, user1: user.id, user2: currentChat.id })
    });
    var data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    var el = document.querySelector('.message[data-id="' + messageId + '"]');
    if (el) el.remove();
    allMessages = allMessages.filter(function(m) { return m.id !== messageId; });
  } catch (e) {}
});

async function sendMessage(content, type) {
  type = type || 'text';
  if (!content || !currentChat) return;
  try {
    var res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: user.id, senderName: user.username, senderAvatar: user.avatar,
        receiverId: currentChat.id, content: content, type: type
      })
    });
    var msg = await res.json();
    appendMessage(msg);
    allMessages.push(msg);
    lastMessageTime = msg.timestamp;
  } catch (e) {}
}

// --- TEXT MESSAGE / EDIT ---
document.getElementById('messageForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var input = document.getElementById('messageInput');
  var content = input.value.trim();
  if (!content) return;

  var editId = input.dataset.editId;
  if (editId) {
    try {
      var res = await fetch('/api/messages/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: editId, senderId: user.id, user1: user.id, user2: currentChat.id, newContent: content
        })
      });
      var data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      var el = document.querySelector('.message[data-id="' + editId + '"]');
      if (el) {
        el.dataset.content = content;
        var txt = el.querySelector('.msg-text');
        if (txt) txt.textContent = content;
        var timeEl = el.querySelector('.message-time');
        if (timeEl && timeEl.textContent.indexOf('(edited)') === -1) timeEl.textContent += ' (edited)';
      }
      var stored = allMessages.find(function(m) { return m.id === editId; });
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
var mediaRecorder = null;
var audioChunks = [];

document.getElementById('voiceBtn').addEventListener('mousedown', startRecording);
document.getElementById('voiceBtn').addEventListener('mouseup', stopRecording);
document.getElementById('voiceBtn').addEventListener('touchstart', function(e) { e.preventDefault(); startRecording(); });
document.getElementById('voiceBtn').addEventListener('touchend', function(e) { e.preventDefault(); stopRecording(); });

async function startRecording() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
    mediaRecorder.onstop = function() {
      var blob = new Blob(audioChunks, { type: 'audio/webm' });
      var reader = new FileReader();
      reader.onloadend = function() { sendMessage(reader.result, 'voice'); };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(function(t) { t.stop(); });
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
document.getElementById('logoutBtn').addEventListener('click', async function() {
  if (pollInterval) clearInterval(pollInterval);
  await fetch('/api/offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  });
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});

document.getElementById('navLogout').addEventListener('click', async function() {
  if (pollInterval) clearInterval(pollInterval);
  await fetch('/api/offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  });
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});

document.getElementById('settingsLogout').addEventListener('click', async function() {
  if (pollInterval) clearInterval(pollInterval);
  await fetch('/api/offline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  });
  localStorage.removeItem('user');
  window.location.href = 'index.html';
});

document.getElementById('settingsStoryPrivacy').addEventListener('change', async function(e) {
  var privacy = e.target.value;
  try {
    var res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, storyPrivacy: privacy })
    });
    var data = await res.json();
    if (res.ok) {
      user.storyPrivacy = data.storyPrivacy;
      localStorage.setItem('user', JSON.stringify(user));
      document.getElementById('editStoryPrivacy').value = privacy;
    }
  } catch(e) {}
});

// Set initial privacy value
if (user.storyPrivacy) {
  var sp = document.getElementById('settingsStoryPrivacy');
  if (sp) sp.value = user.storyPrivacy;
}

// --- EDIT PROFILE ---
document.getElementById('editProfileBtn').addEventListener('click', function() {
  document.getElementById('editOverlay').style.display = 'flex';
  document.getElementById('editName').value = user.username;
  document.getElementById('editBio').value = user.bio || '';
  document.getElementById('editAvatarUrl').value = user.avatar;
  if (user.storyPrivacy) document.getElementById('editStoryPrivacy').value = user.storyPrivacy;
});

document.getElementById('editOverlay').addEventListener('click', function(e) {
  if (e.target === document.getElementById('editOverlay')) {
    document.getElementById('editOverlay').style.display = 'none';
  }
});

document.getElementById('editProfileForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var username = document.getElementById('editName').value.trim();
  var bio = document.getElementById('editBio').value.trim();
  var avatar = document.getElementById('editAvatarUrl').value.trim();
  var storyPrivacy = document.getElementById('editStoryPrivacy').value;

  var fileInput = document.getElementById('editAvatarFile');
  var finalAvatar = avatar;

  if (fileInput.files.length > 0) {
    var file = fileInput.files[0];
    finalAvatar = await new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(reader.result); };
      reader.readAsDataURL(file);
    });
  }

  try {
    var res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, username: username, bio: bio, avatar: finalAvatar, storyPrivacy: storyPrivacy })
    });
    var data = await res.json();
    if (!res.ok) { alert(data.error); return; }
    user.username = data.username;
    user.avatar = data.avatar;
    user.storyPrivacy = data.storyPrivacy;
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
document.getElementById('storyBtn').addEventListener('click', function() {
  document.getElementById('storyOverlay2').style.display = 'flex';
  if (user.storyPrivacy) document.getElementById('storyVisibility').value = user.storyPrivacy;
});

document.getElementById('storyBtnPanel').addEventListener('click', function() {
  document.getElementById('storyOverlay2').style.display = 'flex';
  if (user.storyPrivacy) document.getElementById('storyVisibility').value = user.storyPrivacy;
});

document.getElementById('storyPostBtn').addEventListener('click', function() {
  document.getElementById('storyOverlay2').style.display = 'flex';
  if (user.storyPrivacy) document.getElementById('storyVisibility').value = user.storyPrivacy;
});

document.getElementById('storyOverlay2').addEventListener('click', function(e) {
  if (e.target === document.getElementById('storyOverlay2')) {
    document.getElementById('storyOverlay2').style.display = 'none';
  }
});

document.getElementById('storyForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var content = document.getElementById('storyText').value.trim();
  var fileInput = document.getElementById('storyFile');
  var mediaUrl = '';

  if (fileInput.files.length > 0) {
    var file = fileInput.files[0];
    mediaUrl = await new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(reader.result); };
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
        content: content, mediaUrl: mediaUrl, type: mediaUrl ? 'image' : 'text'
      })
    });
    document.getElementById('storyText').value = '';
    document.getElementById('storyOverlay2').style.display = 'none';
    loadStories();
  } catch (e) {}
});

// --- FILE UPLOAD LABELS ---
document.getElementById('editAvatarFile').addEventListener('change', function(e) {
  var label = document.querySelector('label[for="editAvatarFile"] .file-upload-label');
  if (label) label.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'Choose image from gallery';
});

document.getElementById('storyFile').addEventListener('change', function(e) {
  var label = document.querySelector('label[for="storyFile"] .file-upload-label');
  if (label) label.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'Choose image from gallery';
});

document.getElementById('editStoryFile').addEventListener('change', function(e) {
  var label = document.querySelector('label[for="editStoryFile"] .file-upload-label');
  if (label) label.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'Choose new image';
});

// --- KEYBOARD FIX ---
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function() {
    var container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
  });
}

// --- INIT ---
loadUsers();
loadStories();
setInterval(loadUsers, 5000);
setInterval(loadStories, 10000);
window.addEventListener('beforeunload', function() {
  navigator.sendBeacon('/api/offline', new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' }));
});
