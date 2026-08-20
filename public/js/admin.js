/* ==================== Z1HCHAT ADMIN PANEL ==================== */

var ADMIN_KEY_KEY = 'z1h_admin_key';
var SITE_CONFIG_KEY = 'z1h_site_config';

var defaultConfig = {
  colors: {
    primary: '#667eea',
    primaryDark: '#5a67d8',
    secondary: '#764ba2',
    bgDark: '#0f0f1a',
    bgCard: '#1a1a2e',
    bgInput: '#25253e',
    textPrimary: '#e8e8f0',
    textSecondary: '#9898b0',
    border: '#2a2a45',
    success: '#48bb78',
    danger: '#f56565'
  },
  content: {
    title: 'Z1HCHAT',
    tagline: 'Connect with people from every corner of the world',
    features: [
      { icon: '\u{1F4AC}', title: 'Real-Time Chat', desc: 'Instant messaging with live typing indicators' },
      { icon: '\u{1F310}', title: 'Global Network', desc: 'Meet and talk with people worldwide' },
      { icon: '\u{1F512}', title: 'Secure', desc: 'Your conversations are private and safe' }
    ],
    cta: [
      { text: 'Create Account', url: 'register.html', style: 'btn-primary' },
      { text: 'Sign In', url: 'login.html', style: 'btn-secondary' },
      { text: 'Download App', url: 'download.html', style: 'btn-download' }
    ],
    dlTitle: 'Z1HCHAT',
    dlDesc: 'Chat with people around the world',
    dlApkUrl: '/downloads/Z1HCHAT.apk',
    dlVersion: '1.0.0',
    logoUrl: ''
  },
  pages: {
    registerEnabled: true,
    downloadEnabled: true,
    storiesEnabled: true,
    voiceEnabled: true,
    navLinks: [
      { label: 'Sign In', url: 'login.html', visible: true },
      { label: 'Create Account', url: 'register.html', visible: true },
      { label: 'Download', url: 'download.html', visible: true }
    ]
  },
  settings: {
    maintenanceMode: false,
    maintenanceMsg: 'We are currently performing maintenance. Please check back later.',
    announcementText: '',
    announcementColor: '#48bb78',
    customCss: '',
    customJs: '',
    metaDescription: '',
    footerText: ''
  }
};

function getConfig() {
  try {
    var raw = localStorage.getItem(SITE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return JSON.parse(JSON.stringify(defaultConfig));
}

function saveConfig(cfg) {
  localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(cfg));
  applyConfig(cfg);
  saveServerConfig(cfg);
  showToast('Settings saved successfully!');
}

function applyConfig(cfg) {
  if (!cfg) return;
  var c = cfg.colors || defaultConfig.colors;
  var r = document.documentElement;
  r.style.setProperty('--primary', c.primary);
  r.style.setProperty('--primary-dark', c.primaryDark);
  r.style.setProperty('--secondary', c.secondary);
  r.style.setProperty('--bg-dark', c.bgDark);
  r.style.setProperty('--bg-card', c.bgCard);
  r.style.setProperty('--bg-sidebar', c.bgCard);
  r.style.setProperty('--bg-input', c.bgInput);
  r.style.setProperty('--text-primary', c.textPrimary);
  r.style.setProperty('--text-secondary', c.textSecondary);
  r.style.setProperty('--border', c.border);
  r.style.setProperty('--success', c.success);
  r.style.setProperty('--danger', c.danger);
  r.style.setProperty('--gradient', 'linear-gradient(135deg, ' + c.primary + ' 0%, ' + c.secondary + ' 100%)');
}

function showToast(msg, isError) {
  var t = document.getElementById('adminToast');
  t.textContent = msg;
  t.className = 'admin-toast show' + (isError ? ' error' : '');
  setTimeout(function() { t.className = 'admin-toast'; }, 3000);
}

/* TAB SWITCHING */
function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.admin-nav-btn[data-tab]').forEach(function(b) { b.classList.remove('active'); });
  var tabEl = document.getElementById('tab-' + tab);
  if (tabEl) tabEl.classList.add('active');
  var btn = document.querySelector('.admin-nav-btn[data-tab="' + tab + '"]');
  if (btn) btn.classList.add('active');
  closeAdminSidebar();
  if (tab === 'users') loadAdminUsers();
  if (tab === 'stories') loadAdminStories();
  if (tab === 'messages') loadAdminUsersForChat();
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'ai' && aiChatInput) setTimeout(function() { aiChatInput.focus(); }, 100);
}

/* SIDEBAR TOGGLE */
function toggleAdminSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
}

function closeAdminSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
}

/* ADMIN LOGIN */
document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var key = document.getElementById('adminKey').value;
  var stored = localStorage.getItem(ADMIN_KEY_KEY);
  if (!stored) stored = 'admin123';
  if (key === stored) {
    sessionStorage.setItem('z1h_admin_auth', '1');
    sessionStorage.setItem('z1h_admin_auth_key', key);
    loadServerConfig(function() { showDashboard(); });
  } else {
    document.getElementById('adminLoginError').textContent = 'Invalid admin key';
  }
});

function showDashboard() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  loadConfigToUI();
  loadDashboard();
}

function adminLogout() {
  sessionStorage.removeItem('z1h_admin_auth');
  document.getElementById('adminLogin').style.display = 'flex';
  document.getElementById('adminDashboard').style.display = 'none';
}

/* SERVER CONFIG SYNC */
function loadServerConfig(callback) {
  fetch('/api/admin/config').then(function(r) { return r.json(); }).then(function(serverCfg) {
    if (serverCfg && serverCfg.colors) {
      localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(serverCfg));
      applyConfig(serverCfg);
    }
    if (callback) callback();
  }).catch(function() {
    if (callback) callback();
  });
}

function saveServerConfig(cfg) {
  var adminKey = sessionStorage.getItem('z1h_admin_auth_key') || '';
  fetch('/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: adminKey, config: cfg })
  }).then(function(r) { return r.json(); }).then(function() {}).catch(function() {});
}

/* INIT */
(function() {
  loadServerConfig(function() {
    if (sessionStorage.getItem('z1h_admin_auth')) {
      showDashboard();
    }
  });
  var cfg = getConfig();
  applyConfig(cfg);
})();

/* LOAD CONFIG TO UI */
function loadConfigToUI() {
  var cfg = getConfig();
  var c = cfg.colors;
  var co = cfg.content;
  var p = cfg.pages;
  var s = cfg.settings;

  // Colors
  var colorMap = {
    'colorPrimary': 'primary', 'colorPrimaryDark': 'primaryDark', 'colorSecondary': 'secondary',
    'colorBgDark': 'bgDark', 'colorBgCard': 'bgCard', 'colorBgInput': 'bgInput',
    'colorTextPrimary': 'textPrimary', 'colorTextSecondary': 'textSecondary',
    'colorBorder': 'border', 'colorSuccess': 'success', 'colorDanger': 'danger'
  };
  Object.keys(colorMap).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.value = c[colorMap[id]];
      var hex = document.getElementById(id + 'Hex');
      if (hex) hex.value = c[colorMap[id]];
    }
  });

  // Sync color inputs
  document.querySelectorAll('input[type="color"]').forEach(function(ci) {
    ci.addEventListener('input', function() {
      var hexInput = document.getElementById(ci.id + 'Hex');
      if (hexInput) hexInput.value = ci.value;
      applyColorsFromUI();
    });
  });
  document.querySelectorAll('.admin-hex-input').forEach(function(hi) {
    hi.addEventListener('input', function() {
      var colorId = hi.id.replace('Hex', '');
      var colorInput = document.getElementById(colorId);
      if (colorInput && /^#[0-9A-Fa-f]{6}$/.test(hi.value)) {
        colorInput.value = hi.value;
        applyColorsFromUI();
      }
    });
  });

  // Content
  document.getElementById('siteTitle').value = co.title || '';
  document.getElementById('siteTagline').value = co.tagline || '';
  document.getElementById('dlTitle').value = co.dlTitle || '';
  document.getElementById('dlDesc').value = co.dlDesc || '';
  document.getElementById('dlApkUrl').value = co.dlApkUrl || '';
  document.getElementById('dlVersion').value = co.dlVersion || '';
  document.getElementById('customLogoUrl').value = co.logoUrl || '';

  // Features
  var featCards = document.querySelectorAll('.admin-feature-card');
  featCards.forEach(function(card, i) {
    if (co.features[i]) {
      card.querySelector('.feature-icon').value = co.features[i].icon;
      card.querySelector('.feature-title').value = co.features[i].title;
      card.querySelector('.feature-desc').value = co.features[i].desc;
    }
  });

  // CTAs
  var ctaItems = document.querySelectorAll('.admin-cta-item');
  ctaItems.forEach(function(item, i) {
    if (co.cta[i]) {
      item.querySelector('.cta-text').value = co.cta[i].text;
      item.querySelector('.cta-url').value = co.cta[i].url;
      item.querySelector('.cta-style').value = co.cta[i].style;
    }
  });

  // Pages
  document.getElementById('toggleRegister').checked = p.registerEnabled;
  document.getElementById('toggleDownload').checked = p.downloadEnabled;
  document.getElementById('toggleStories').checked = p.storiesEnabled;
  document.getElementById('toggleVoice').checked = p.voiceEnabled;

  // Nav links
  var navItems = document.querySelectorAll('.admin-navlink-item');
  navItems.forEach(function(item, i) {
    if (p.navLinks[i]) {
      item.querySelector('.navlink-label').value = p.navLinks[i].label;
      item.querySelector('.navlink-url').value = p.navLinks[i].url;
      item.querySelector('.navlink-visible').value = p.navLinks[i].visible ? 'true' : 'false';
    }
  });

  // Settings
  document.getElementById('toggleMaintenance').checked = s.maintenanceMode;
  document.getElementById('maintenanceMsg').value = s.maintenanceMsg || '';
  document.getElementById('announcementText').value = s.announcementText || '';
  document.getElementById('announcementColor').value = s.announcementColor || '#48bb78';
  var achex = document.getElementById('announcementColorHex');
  if (achex) achex.value = s.announcementColor || '#48bb78';
  document.getElementById('customCss').value = s.customCss || '';
  document.getElementById('customJs').value = s.customJs || '';
  document.getElementById('metaDescription').value = s.metaDescription || '';
  document.getElementById('footerText').value = s.footerText || '';

  // Announcement color sync
  var acInput = document.getElementById('announcementColor');
  if (acInput) {
    acInput.addEventListener('input', function() {
      achex.value = acInput.value;
    });
  }
}

function applyColorsFromUI() {
  var c = {
    primary: document.getElementById('colorPrimary').value,
    primaryDark: document.getElementById('colorPrimaryDark').value,
    secondary: document.getElementById('colorSecondary').value,
    bgDark: document.getElementById('colorBgDark').value,
    bgCard: document.getElementById('colorBgCard').value,
    bgInput: document.getElementById('colorBgInput').value,
    textPrimary: document.getElementById('colorTextPrimary').value,
    textSecondary: document.getElementById('colorTextSecondary').value,
    border: document.getElementById('colorBorder').value,
    success: document.getElementById('colorSuccess').value,
    danger: document.getElementById('colorDanger').value
  };
  var cfg = getConfig();
  cfg.colors = c;
  applyConfig(cfg);
}

/* SAVE COLORS */
function saveColors() {
  var cfg = getConfig();
  cfg.colors = {
    primary: document.getElementById('colorPrimary').value,
    primaryDark: document.getElementById('colorPrimaryDark').value,
    secondary: document.getElementById('colorSecondary').value,
    bgDark: document.getElementById('colorBgDark').value,
    bgCard: document.getElementById('colorBgCard').value,
    bgInput: document.getElementById('colorBgInput').value,
    textPrimary: document.getElementById('colorTextPrimary').value,
    textSecondary: document.getElementById('colorTextSecondary').value,
    border: document.getElementById('colorBorder').value,
    success: document.getElementById('colorSuccess').value,
    danger: document.getElementById('colorDanger').value
  };
  saveConfig(cfg);
}

function resetColors() {
  var cfg = getConfig();
  cfg.colors = JSON.parse(JSON.stringify(defaultConfig.colors));
  saveConfig(cfg);
  loadConfigToUI();
}

/* SAVE CONTENT */
function saveContent() {
  var cfg = getConfig();
  cfg.content.title = document.getElementById('siteTitle').value;
  cfg.content.tagline = document.getElementById('siteTagline').value;
  cfg.content.logoUrl = document.getElementById('customLogoUrl').value;
  cfg.content.dlTitle = document.getElementById('dlTitle').value;
  cfg.content.dlDesc = document.getElementById('dlDesc').value;
  cfg.content.dlApkUrl = document.getElementById('dlApkUrl').value;
  cfg.content.dlVersion = document.getElementById('dlVersion').value;

  cfg.content.features = [];
  document.querySelectorAll('.admin-feature-card').forEach(function(card) {
    cfg.content.features.push({
      icon: card.querySelector('.feature-icon').value,
      title: card.querySelector('.feature-title').value,
      desc: card.querySelector('.feature-desc').value
    });
  });

  cfg.content.cta = [];
  document.querySelectorAll('.admin-cta-item').forEach(function(item) {
    cfg.content.cta.push({
      text: item.querySelector('.cta-text').value,
      url: item.querySelector('.cta-url').value,
      style: item.querySelector('.cta-style').value
    });
  });

  saveConfig(cfg);
}

function addFeatureCard() {
  var container = document.getElementById('featuresEditor');
  var card = document.createElement('div');
  card.className = 'admin-feature-card';
  card.innerHTML =
    '<div class="admin-form-row">' +
      '<div class="admin-form-group"><label>Icon (emoji)</label><input type="text" class="admin-input feature-icon" placeholder="&#127380;"></div>' +
      '<div class="admin-form-group"><label>Title</label><input type="text" class="admin-input feature-title" placeholder="Feature title"></div>' +
    '</div>' +
    '<div class="admin-form-group"><label>Description</label><input type="text" class="admin-input feature-desc" placeholder="Feature description"></div>';
  container.appendChild(card);
}

function addCtaButton() {
  var container = document.getElementById('ctaEditor');
  var item = document.createElement('div');
  item.className = 'admin-cta-item';
  item.innerHTML =
    '<div class="admin-form-row">' +
      '<div class="admin-form-group"><label>Button Text</label><input type="text" class="admin-input cta-text" placeholder="Button text"></div>' +
      '<div class="admin-form-group"><label>Link URL</label><input type="text" class="admin-input cta-url" placeholder="URL"></div>' +
      '<div class="admin-form-group"><label>Style</label><select class="admin-input cta-style"><option value="btn-primary">Primary</option><option value="btn-secondary">Secondary</option><option value="btn-download">Download</option></select></div>' +
    '</div>';
  container.appendChild(item);
}

/* SAVE PAGES */
function savePages() {
  var cfg = getConfig();
  cfg.pages.registerEnabled = document.getElementById('toggleRegister').checked;
  cfg.pages.downloadEnabled = document.getElementById('toggleDownload').checked;
  cfg.pages.storiesEnabled = document.getElementById('toggleStories').checked;
  cfg.pages.voiceEnabled = document.getElementById('toggleVoice').checked;
  cfg.pages.navLinks = [];
  document.querySelectorAll('.admin-navlink-item').forEach(function(item) {
    cfg.pages.navLinks.push({
      label: item.querySelector('.navlink-label').value,
      url: item.querySelector('.navlink-url').value,
      visible: item.querySelector('.navlink-visible').value === 'true'
    });
  });
  saveConfig(cfg);
}

function addNavLink() {
  var container = document.getElementById('navLinksEditor');
  var item = document.createElement('div');
  item.className = 'admin-navlink-item';
  item.innerHTML =
    '<div class="admin-form-row">' +
      '<div class="admin-form-group"><label>Label</label><input type="text" class="admin-input navlink-label" placeholder="Label"></div>' +
      '<div class="admin-form-group"><label>URL</label><input type="text" class="admin-input navlink-url" placeholder="URL"></div>' +
      '<div class="admin-form-group"><label>Visible</label><select class="admin-input navlink-visible"><option value="true">Yes</option><option value="false">No</option></select></div>' +
    '</div>';
  container.appendChild(item);
}

/* SAVE SETTINGS */
function saveSettings() {
  var cfg = getConfig();
  cfg.settings.maintenanceMode = document.getElementById('toggleMaintenance').checked;
  cfg.settings.maintenanceMsg = document.getElementById('maintenanceMsg').value;
  cfg.settings.announcementText = document.getElementById('announcementText').value;
  cfg.settings.announcementColor = document.getElementById('announcementColor').value;
  cfg.settings.customCss = document.getElementById('customCss').value;
  cfg.settings.customJs = document.getElementById('customJs').value;
  cfg.settings.metaDescription = document.getElementById('metaDescription').value;
  cfg.settings.footerText = document.getElementById('footerText').value;
  saveConfig(cfg);
}

function changeAdminKey() {
  var newKey = document.getElementById('newAdminKey').value;
  if (!newKey || newKey.length < 8) {
    showToast('Admin key must be at least 8 characters', true);
    return;
  }
  var oldKey = sessionStorage.getItem('z1h_admin_auth_key') || '';
  fetch('/api/admin/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldKey: oldKey, newKey: newKey })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) { showToast(data.error, true); return; }
    localStorage.setItem(ADMIN_KEY_KEY, newKey);
    sessionStorage.setItem('z1h_admin_auth_key', newKey);
    document.getElementById('newAdminKey').value = '';
    showToast('Admin key updated!');
  }).catch(function() {
    showToast('Failed to update key', true);
  });
}

/* EXPORT / IMPORT */
function exportSiteConfig() {
  var cfg = getConfig();
  var blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'z1hchat-config.json';
  a.click();
  showToast('Config exported!');
}

function importSiteConfig(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var cfg = JSON.parse(ev.target.result);
      saveConfig(cfg);
      loadConfigToUI();
      showToast('Config imported successfully!');
    } catch(err) {
      showToast('Invalid config file', true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function resetAllConfig() {
  if (!confirm('Reset ALL settings to defaults? This cannot be undone.')) return;
  saveConfig(JSON.parse(JSON.stringify(defaultConfig)));
  loadConfigToUI();
  showToast('All settings reset to defaults');
}

/* DASHBOARD */
function loadDashboard() {
  fetch('/api/users').then(function(r) { return r.json(); }).then(function(users) {
    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statOnline').textContent = users.filter(function(u) { return u.online; }).length;
    var tbody = document.querySelector('#recentUsersTable tbody');
    tbody.innerHTML = '';
    var sorted = users.slice().sort(function(a, b) {
      return (b.online ? 1 : 0) - (a.online ? 1 : 0);
    });
    sorted.slice(0, 10).forEach(function(u) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><img class="admin-avatar" src="' + escapeHtml(u.avatar) + '" alt=""></td>' +
        '<td>' + escapeHtml(u.username) + '</td>' +
        '<td>-</td>' +
        '<td><span class="status-badge ' + (u.online ? 'online' : 'offline') + '">' + (u.online ? 'Online' : 'Offline') + '</span></td>' +
        '<td>-</td>';
      tbody.appendChild(tr);
    });
  }).catch(function() {});

  fetch('/api/stories').then(function(r) { return r.json(); }).then(function(stories) {
    document.getElementById('statStories').textContent = stories.length;
  }).catch(function() {
    document.getElementById('statStories').textContent = '0';
  });
}

/* USERS MANAGEMENT */
var allAdminUsers = [];

function loadAdminUsers() {
  fetch('/api/users').then(function(r) { return r.json(); }).then(function(users) {
    allAdminUsers = users;
    document.getElementById('adminUserCount').textContent = users.length + ' users';
    renderAdminUsers(users);
  }).catch(function() {});
}

function renderAdminUsers(users) {
  var tbody = document.querySelector('#adminUsersTable tbody');
  tbody.innerHTML = '';
  users.forEach(function(u) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><img class="admin-avatar" src="' + escapeHtml(u.avatar) + '" alt=""></td>' +
      '<td>' + escapeHtml(u.username) + '</td>' +
      '<td>-</td>' +
      '<td>' + escapeHtml(u.bio || '') + '</td>' +
      '<td><span class="status-badge ' + (u.online ? 'online' : 'offline') + '">' + (u.online ? 'Online' : 'Offline') + '</span></td>' +
      '<td>' +
        '<button class="action-btn" onclick="viewUser(\'' + u.id + '\')">View</button>' +
        '<button class="action-btn danger" onclick="deleteUser(\'' + u.id + '\',\'' + escapeHtml(u.username) + '\')">Delete</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
}

function filterAdminUsers() {
  var q = document.getElementById('adminUserSearch').value.toLowerCase();
  var filtered = allAdminUsers.filter(function(u) {
    return u.username.toLowerCase().indexOf(q) !== -1;
  });
  renderAdminUsers(filtered);
  document.getElementById('adminUserCount').textContent = filtered.length + ' users';
}

function viewUser(userId) {
  window.open('/api/user/' + userId, '_blank');
}

function deleteUser(userId, username) {
  if (!confirm('Delete user "' + username + '"? This cannot be undone.')) return;
  var adminKey = sessionStorage.getItem('z1h_admin_auth_key') || '';
  fetch('/api/admin/delete-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: adminKey, userId: userId })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) { showToast(data.error, true); return; }
    showToast('User "' + username + '" deleted');
    loadAdminUsers();
  }).catch(function() {
    showToast('Failed to delete user', true);
  });
}

/* MESSAGES MANAGEMENT */
function loadAdminUsersForChat() {
  fetch('/api/users').then(function(r) { return r.json(); }).then(function(users) {
    allAdminUsers = users;
    var s1 = document.getElementById('adminMsgUser1');
    var s2 = document.getElementById('adminMsgUser2');
    s1.innerHTML = '<option value="">Select user...</option>';
    s2.innerHTML = '<option value="">Select user...</option>';
    users.forEach(function(u) {
      s1.innerHTML += '<option value="' + u.id + '">' + escapeHtml(u.username) + '</option>';
      s2.innerHTML += '<option value="' + u.id + '">' + escapeHtml(u.username) + '</option>';
    });
  }).catch(function() {});
}

function loadAdminChat() {
  var u1 = document.getElementById('adminMsgUser1').value;
  var u2 = document.getElementById('adminMsgUser2').value;
  if (!u1 || !u2 || u1 === u2) {
    document.getElementById('adminMessagesView').style.display = 'none';
    return;
  }
  var url = '/api/admin/chat?user1=' + encodeURIComponent(u1) + '&user2=' + encodeURIComponent(u2);
  fetch(url).then(function(r) { return r.json(); }).then(function(msgs) {
    var view = document.getElementById('adminMessagesView');
    view.style.display = 'block';
    var u1name = allAdminUsers.find(function(u) { return u.id === u1; });
    var u2name = allAdminUsers.find(function(u) { return u.id === u2; });
    document.getElementById('adminChatTitle').textContent = (u1name ? u1name.username : u1) + ' &harr; ' + (u2name ? u2name.username : u2);
    var list = document.getElementById('adminMessagesList');
    list.innerHTML = '';
    if (msgs.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#9898b0;padding:20px;">No messages</p>';
      return;
    }
    msgs.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'admin-msg ' + (m.senderId === u1 ? 'sent' : 'received');
      var time = new Date(m.timestamp).toLocaleString();
      div.innerHTML = '<div>' + escapeHtml(m.content) + '</div><div class="admin-msg-time">' + time + (m.edited ? ' (edited)' : '') + '</div>';
      list.appendChild(div);
    });
    list.scrollTop = list.scrollHeight;
  }).catch(function() {});
}

function closeAdminChat() {
  document.getElementById('adminMessagesView').style.display = 'none';
  document.getElementById('adminMsgUser1').value = '';
  document.getElementById('adminMsgUser2').value = '';
}

/* STORIES MANAGEMENT */
function loadAdminStories() {
  var container = document.getElementById('adminStoriesList');
  container.innerHTML = '<p class="admin-desc">Loading stories...</p>';
  fetch('/api/stories').then(function(r) { return r.json(); }).then(function(stories) {
    if (stories.length === 0) {
      container.innerHTML = '<p class="admin-desc">No active stories.</p>';
      return;
    }
    container.innerHTML = '';
    stories.forEach(function(s) {
      var div = document.createElement('div');
      div.className = 'admin-story-item';
      var time = new Date(s.timestamp).toLocaleString();
      var expires = new Date(s.expiresAt).toLocaleString();
      div.innerHTML =
        '<img src="' + escapeHtml(s.avatar || '') + '" alt="">' +
        '<div class="admin-story-info">' +
          '<strong>' + escapeHtml(s.username) + '</strong>' +
          '<span>' + escapeHtml(s.content || '[image]') + ' &bull; ' + time + ' &bull; expires: ' + expires + '</span>' +
        '</div>' +
        '<button class="admin-story-delete" onclick="deleteAdminStory(\'' + s.id + '\',\'' + s.userId + '\')">Delete</button>';
      container.appendChild(div);
    });
  }).catch(function() {
    container.innerHTML = '<p class="admin-desc">Error loading stories.</p>';
  });
}

function deleteAdminStory(storyId, userId) {
  if (!confirm('Delete this story?')) return;
  var adminKey = sessionStorage.getItem('z1h_admin_auth_key') || '';
  fetch('/api/admin/delete-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey: adminKey, storyId: storyId, userId: userId })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) { showToast(data.error, true); return; }
    showToast('Story deleted');
    loadAdminStories();
  }).catch(function() {
    showToast('Failed to delete story', true);
  });
}

/* UTILITIES */
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ==================== AI ASSISTANT ==================== */

var aiChatMessages = document.getElementById('aiChatMessages');
var aiChatForm = document.getElementById('aiChatForm');
var aiChatInput = document.getElementById('aiChatInput');

if (aiChatForm) {
  aiChatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var text = aiChatInput.value.trim();
    if (!text) return;
    aiAddMessage(text, 'user');
    aiChatInput.value = '';
    setTimeout(function() {
      var result = aiProcessCommand(text);
      aiAddMessage(result.reply, 'bot', result.type);
      if (result.action) result.action();
    }, 300);
  });
}

function aiSendCommand(cmd) {
  aiChatInput.value = cmd;
  aiChatForm.dispatchEvent(new Event('submit'));
}

function aiAddMessage(text, sender, type) {
  var div = document.createElement('div');
  div.className = 'ai-msg ai-msg-' + sender;
  var avatar = sender === 'bot' ? '&#10024;' : '&#9786;';
  var extraClass = '';
  if (type === 'success') extraClass = ' ai-msg-success';
  if (type === 'error') extraClass = ' ai-msg-error';
  var time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML =
    '<div class="ai-msg-avatar">' + avatar + '</div>' +
    '<div class="ai-msg-content' + extraClass + '">' +
      '<div class="ai-msg-text">' + text + '</div>' +
      '<div class="ai-msg-time">' + time + '</div>' +
    '</div>';
  aiChatMessages.appendChild(div);
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

/* COLOR NAME MAP */
var colorNames = {
  'red': '#f56565', 'blue': '#4299e1', 'green': '#48bb78', 'purple': '#9f7aea',
  'pink': '#ed64a6', 'orange': '#ed8936', 'yellow': '#ecc94b', 'teal': '#38b2ac',
  'cyan': '#0bc5ea', 'indigo': '#667eea', 'gray': '#a0aec0', 'grey': '#a0aec0',
  'black': '#000000', 'white': '#ffffff', 'dark': '#0f0f1a', 'light': '#f7fafc',
  'navy': '#1a365d', 'maroon': '#9b2c2c', 'olive': '#718096', 'lime': '#68d391',
  'aqua': '#00d2d3', 'teal': '#38b2ac', 'coral': '#fc8181', 'salmon': '#fc8181',
  'gold': '#d69e2e', 'silver': '#cbd5e0', 'brown': '#8b572a', 'beige': '#f5f5dc',
  'turquoise': '#38b2ac', 'violet': '#9f7aea', 'lavender': '#b794f4',
  'crimson': '#e53e3e', 'magenta': '#d53f8c', 'ruby': '#e53e3e',
  'sky': '#63b3ed', 'mint': '#68d391', 'peach': '#fbd38d'
};

function resolveColor(str) {
  str = str.toLowerCase().trim();
  if (str.charAt(0) === '#' && /^#[0-9a-f]{3,8}$/i.test(str)) return str;
  if (colorNames[str]) return colorNames[str];
  if (str.indexOf('gradient') !== -1) return str;
  return null;
}

/* MAIN COMMAND PARSER */
function aiProcessCommand(input) {
  var cmd = input.toLowerCase().trim().replace(/[""]/g, '"').replace(/['']/g, "'");

  // ===== THEME / COLOR COMMANDS =====
  var colorMatch = cmd.match(/(?:change|set|make)\s+(?:the\s+)?(?:primary|main)\s+(?:color\s+)?(?:to\s+)?(\S+)/);
  if (!colorMatch) colorMatch = cmd.match(/(?:change|set)\s+(?:theme|color)\s+(?:to\s+)?(\S+)/);
  if (colorMatch) {
    var color = resolveColor(colorMatch[1]);
    if (color) {
      var cfg = getConfig();
      cfg.colors.primary = color;
      var darker = adjustBrightness(color, -20);
      cfg.colors.primaryDark = darker;
      saveConfig(cfg);
      loadConfigToUI();
      return { reply: 'Done! Primary color changed to <strong>' + color + '</strong>. Theme gradient updated automatically.', type: 'success' };
    }
    return { reply: 'I didn\'t recognize that color. Try: red, blue, #ff0000, etc.', type: 'error' };
  }

  // Background color
  var bgMatch = cmd.match(/(?:change|set|make)\s+(?:the\s+)?(?:background|bg|back\s*ground)\s+(?:color\s+)?(?:to\s+)?(\S+)/);
  if (bgMatch) {
    var bgColor = resolveColor(bgMatch[1]);
    if (bgColor) {
      var cfg2 = getConfig();
      cfg2.colors.bgDark = bgColor;
      saveConfig(cfg2);
      loadConfigToUI();
      return { reply: 'Background color changed to <strong>' + bgColor + '</strong>.', type: 'success' };
    }
    return { reply: 'I didn\'t recognize that color. Try: black, #111111, dark blue, etc.', type: 'error' };
  }

  // Card color
  var cardMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?(?:card|cards|container)\s+(?:color\s+)?(?:to\s+)?(\S+)/);
  if (cardMatch) {
    var cardColor = resolveColor(cardMatch[1]);
    if (cardColor) {
      var cfg3 = getConfig();
      cfg3.colors.bgCard = cardColor;
      saveConfig(cfg3);
      loadConfigToUI();
      return { reply: 'Card background changed to <strong>' + cardColor + '</strong>.', type: 'success' };
    }
    return { reply: 'Unknown color. Try: #1a1a2e, dark purple, etc.', type: 'error' };
  }

  // Border color
  var borderMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?border\s+(?:color\s+)?(?:to\s+)?(\S+)/);
  if (borderMatch) {
    var borderColor = resolveColor(borderMatch[1]);
    if (borderColor) {
      var cfg4 = getConfig();
      cfg4.colors.border = borderColor;
      saveConfig(cfg4);
      loadConfigToUI();
      return { reply: 'Border color changed to <strong>' + borderColor + '</strong>.', type: 'success' };
    }
    return { reply: 'Unknown color.', type: 'error' };
  }

  // Text color
  var textMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?(?:text|font)\s+(?:color\s+)?(?:to\s+)?(\S+)/);
  if (textMatch) {
    var textColor = resolveColor(textMatch[1]);
    if (textColor) {
      var cfg5 = getConfig();
      cfg5.colors.textPrimary = textColor;
      saveConfig(cfg5);
      loadConfigToUI();
      return { reply: 'Text color changed to <strong>' + textColor + '</strong>.', type: 'success' };
    }
    return { reply: 'Unknown color.', type: 'error' };
  }

  // Secondary color
  var secMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?secondary\s+(?:color\s+)?(?:to\s+)?(\S+)/);
  if (secMatch) {
    var secColor = resolveColor(secMatch[1]);
    if (secColor) {
      var cfg6 = getConfig();
      cfg6.colors.secondary = secColor;
      saveConfig(cfg6);
      loadConfigToUI();
      return { reply: 'Secondary color changed to <strong>' + secColor + '</strong>.', type: 'success' };
    }
    return { reply: 'Unknown color.', type: 'error' };
  }

  // Reset theme
  if (cmd.match(/(?:reset|restore)\s+(?:theme|colors?|color\s+scheme)/)) {
    var cfg7 = getConfig();
    cfg7.colors = JSON.parse(JSON.stringify(defaultConfig.colors));
    saveConfig(cfg7);
    loadConfigToUI();
    return { reply: 'Theme reset to default colors.', type: 'success' };
  }

  // ===== TITLE / CONTENT COMMANDS =====
  var titleMatch = cmd.match(/(?:change|set|rename)\s+(?:the\s+)?(?:site\s+)?(?:title|name|app\s*name)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (titleMatch) {
    var newTitle = titleMatch[1].trim();
    var cfg8 = getConfig();
    cfg8.content.title = newTitle;
    saveConfig(cfg8);
    return { reply: 'Site title changed to <strong>"' + escapeHtml(newTitle) + '"</strong>.', type: 'success' };
  }

  // Tagline
  var tagMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?(?:tagline|subtitle|description)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (tagMatch) {
    var newTag = tagMatch[1].trim();
    var cfg9 = getConfig();
    cfg9.content.tagline = newTag;
    saveConfig(cfg9);
    return { reply: 'Tagline changed to <strong>"' + escapeHtml(newTag) + '"</strong>.', type: 'success' };
  }

  // Download description
  var dlDescMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?(?:download\s+)?(?:description|desc)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (dlDescMatch) {
    var newDlDesc = dlDescMatch[1].trim();
    var cfg10 = getConfig();
    cfg10.content.dlDesc = newDlDesc;
    saveConfig(cfg10);
    return { reply: 'Download page description changed to <strong>"' + escapeHtml(newDlDesc) + '"</strong>.', type: 'success' };
  }

  // Download version
  var dlVerMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?(?:app\s+)?version\s+(?:to\s+)?(\S+)/);
  if (dlVerMatch) {
    var newVer = dlVerMatch[1].trim();
    var cfg11 = getConfig();
    cfg11.content.dlVersion = newVer;
    saveConfig(cfg11);
    return { reply: 'App version changed to <strong>' + escapeHtml(newVer) + '</strong>.', type: 'success' };
  }

  // ===== FEATURE COMMANDS =====
  // Add feature
  var addFeatMatch = cmd.match(/(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?(?:feature|card)\s+(?:called|named|titled|with\s+title)?\s*["']?([^"']+?)["']?\s*$/);
  if (addFeatMatch) {
    var featTitle = addFeatMatch[1].trim();
    var cfg12 = getConfig();
    cfg12.content.features.push({ icon: '\u2728', title: featTitle, desc: '' });
    saveConfig(cfg12);
    return { reply: 'Feature <strong>"' + escapeHtml(featTitle) + '"</strong> added!', type: 'success' };
  }

  // Add feature with description
  var addFeatDescMatch = cmd.match(/(?:add|create)\s+(?:a\s+)?feature\s+["']([^"']+)["']\s+(?:with\s+)?(?:desc(?:ription)?|text)\s+["']([^"']+)["']/);
  if (addFeatDescMatch) {
    var cfg13 = getConfig();
    cfg13.content.features.push({ icon: '\u2728', title: addFeatDescMatch[1].trim(), desc: addFeatDescMatch[2].trim() });
    saveConfig(cfg13);
    return { reply: 'Feature <strong>"' + escapeHtml(addFeatDescMatch[1]) + '"</strong> added with description!', type: 'success' };
  }

  // Remove feature
  var remFeatMatch = cmd.match(/(?:remove|delete)\s+(?:feature|card)\s+(\d+|last|all)/);
  if (remFeatMatch) {
    var cfg14 = getConfig();
    if (remFeatMatch[1] === 'all') {
      cfg14.content.features = [];
      saveConfig(cfg14);
      return { reply: 'All features removed.', type: 'success' };
    }
    if (remFeatMatch[1] === 'last') {
      cfg14.content.features.pop();
      saveConfig(cfg14);
      return { reply: 'Last feature removed.', type: 'success' };
    }
    var idx = parseInt(remFeatMatch[1]) - 1;
    if (idx >= 0 && idx < cfg14.content.features.length) {
      var removed = cfg14.content.features.splice(idx, 1)[0];
      saveConfig(cfg14);
      return { reply: 'Feature <strong>"' + escapeHtml(removed.title) + '"</strong> removed.', type: 'success' };
    }
    return { reply: 'Feature #' + remFeatMatch[1] + ' not found. You have ' + cfg14.content.features.length + ' features.', type: 'error' };
  }

  // Edit feature
  var editFeatMatch = cmd.match(/(?:edit|change|update)\s+(?:feature|card)\s+(\d+)\s+(?:title|name)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (editFeatMatch) {
    var cfg15 = getConfig();
    var fi = parseInt(editFeatMatch[1]) - 1;
    if (fi >= 0 && fi < cfg15.content.features.length) {
      cfg15.content.features[fi].title = editFeatMatch[2].trim();
      saveConfig(cfg15);
      return { reply: 'Feature #' + editFeatMatch[1] + ' title changed to <strong>"' + escapeHtml(editFeatMatch[2]) + '"</strong>.', type: 'success' };
    }
    return { reply: 'Feature #' + editFeatMatch[1] + ' not found.', type: 'error' };
  }

  // Edit feature description
  var editFeatDescMatch = cmd.match(/(?:edit|change|update)\s+(?:feature|card)\s+(\d+)\s+(?:desc|description)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (editFeatDescMatch) {
    var cfg16 = getConfig();
    var fi2 = parseInt(editFeatDescMatch[1]) - 1;
    if (fi2 >= 0 && fi2 < cfg16.content.features.length) {
      cfg16.content.features[fi2].desc = editFeatDescMatch[2].trim();
      saveConfig(cfg16);
      return { reply: 'Feature #' + editFeatDescMatch[1] + ' description updated.', type: 'success' };
    }
    return { reply: 'Feature #' + editFeatDescMatch[1] + ' not found.', type: 'error' };
  }

  // Edit feature icon
  var editFeatIconMatch = cmd.match(/(?:edit|change|update)\s+(?:feature|card)\s+(\d+)\s+(?:icon|emoji)\s+(?:to\s+)?(\S+)/);
  if (editFeatIconMatch) {
    var cfg17 = getConfig();
    var fi3 = parseInt(editFeatIconMatch[1]) - 1;
    if (fi3 >= 0 && fi3 < cfg17.content.features.length) {
      cfg17.content.features[fi3].icon = editFeatIconMatch[2].trim();
      saveConfig(cfg17);
      return { reply: 'Feature #' + editFeatIconMatch[1] + ' icon changed to ' + editFeatIconMatch[2] + '.', type: 'success' };
    }
    return { reply: 'Feature #' + editFeatIconMatch[1] + ' not found.', type: 'error' };
  }

  // ===== TOGGLE COMMANDS =====
  if (cmd.match(/(?:enable|turn\s+on|activate)\s+(?:stories|story)/)) {
    var cfg18 = getConfig();
    cfg18.pages.storiesEnabled = true;
    saveConfig(cfg18);
    return { reply: 'Stories feature <strong>enabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:disable|turn\s+off|deactivate)\s+(?:stories|story)/)) {
    var cfg19 = getConfig();
    cfg19.pages.storiesEnabled = false;
    saveConfig(cfg19);
    return { reply: 'Stories feature <strong>disabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:enable|turn\s+on|activate)\s+(?:voice|voice\s+messages?|recording)/)) {
    var cfg20 = getConfig();
    cfg20.pages.voiceEnabled = true;
    saveConfig(cfg20);
    return { reply: 'Voice messages <strong>enabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:disable|turn\s+off|deactivate)\s+(?:voice|voice\s+messages?|recording)/)) {
    var cfg21 = getConfig();
    cfg21.pages.voiceEnabled = false;
    saveConfig(cfg21);
    return { reply: 'Voice messages <strong>disabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:enable|turn\s+on|activate)\s+(?:registration|register|signup|sign\s*up)/)) {
    var cfg22 = getConfig();
    cfg22.pages.registerEnabled = true;
    saveConfig(cfg22);
    return { reply: 'Registration page <strong>enabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:disable|turn\s+off|deactivate)\s+(?:registration|register|signup|sign\s*up)/)) {
    var cfg23 = getConfig();
    cfg23.pages.registerEnabled = false;
    saveConfig(cfg23);
    return { reply: 'Registration page <strong>disabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:enable|turn\s+on)\s+(?:download|downloads?)/)) {
    var cfg24 = getConfig();
    cfg24.pages.downloadEnabled = true;
    saveConfig(cfg24);
    return { reply: 'Download page <strong>enabled</strong>.', type: 'success' };
  }
  if (cmd.match(/(?:disable|turn\s+off)\s+(?:download|downloads?)/)) {
    var cfg25 = getConfig();
    cfg25.pages.downloadEnabled = false;
    saveConfig(cfg25);
    return { reply: 'Download page <strong>disabled</strong>.', type: 'success' };
  }

  // Maintenance mode
  if (cmd.match(/(?:enable|turn\s+on|activate)\s+maintenance/)) {
    var cfg26 = getConfig();
    cfg26.settings.maintenanceMode = true;
    saveConfig(cfg26);
    return { reply: 'Maintenance mode <strong>enabled</strong>. Your site now shows a maintenance message.', type: 'success' };
  }
  if (cmd.match(/(?:disable|turn\s+off|deactivate)\s+maintenance/)) {
    var cfg27 = getConfig();
    cfg27.settings.maintenanceMode = false;
    saveConfig(cfg27);
    return { reply: 'Maintenance mode <strong>disabled</strong>. Site is back online.', type: 'success' };
  }

  // Maintenance message
  var maintMsgMatch = cmd.match(/(?:set|change)\s+maintenance\s+(?:message|msg|text)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (maintMsgMatch) {
    var cfg28 = getConfig();
    cfg28.settings.maintenanceMsg = maintMsgMatch[1].trim();
    saveConfig(cfg28);
    return { reply: 'Maintenance message updated.', type: 'success' };
  }

  // Announcement
  var announceMatch = cmd.match(/(?:set|add|create)\s+(?:an?\s+)?(?:announcement|banner|notification|alert)\s+(?:to|saying|message|text)?\s*["']?([^"']+?)["']?\s*$/);
  if (announceMatch) {
    var cfg29 = getConfig();
    cfg29.settings.announcementText = announceMatch[1].trim();
    saveConfig(cfg29);
    return { reply: 'Announcement banner set: <strong>"' + escapeHtml(announceMatch[1]) + '"</strong>', type: 'success' };
  }
  if (cmd.match(/(?:clear|remove|delete|hide)\s+(?:announcement|banner|notification|alert)/)) {
    var cfg30 = getConfig();
    cfg30.settings.announcementText = '';
    saveConfig(cfg30);
    return { reply: 'Announcement banner removed.', type: 'success' };
  }

  // ===== LAYOUT COMMANDS =====
  var radiusMatch = cmd.match(/(?:change|set)\s+(?:border|corner)\s*radius\s+(?:to\s+)?(\d+)/);
  if (radiusMatch) {
    var r = radiusMatch[1];
    var customCss = getConfig().settings.customCss || '';
    customCss = customCss.replace(/\/\* radius \*\/.*?\/\* end radius \*\//gs, '');
    customCss += '\n/* radius */\n.auth-container, .overlay-content, .admin-section, .admin-login-card { border-radius: ' + r + 'px !important; }\n.btn { border-radius: ' + r + 'px !important; }/* end radius */';
    var cfg31 = getConfig();
    cfg31.settings.customCss = customCss;
    saveConfig(cfg31);
    return { reply: 'Border radius set to <strong>' + r + 'px</strong> on all cards and buttons.', type: 'success' };
  }

  // Font
  var fontMatch = cmd.match(/(?:change|set)\s+(?:the\s+)?font\s+(?:to|family\s+to|as)\s+(\S+)/);
  if (fontMatch) {
    var fonts = {
      'serif': 'Georgia, "Times New Roman", serif',
      'sans': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'mono': '"SF Mono", Monaco, "Cascadia Code", monospace',
      'mono-spaced': '"SF Mono", Monaco, "Cascadia Code", monospace',
      'arial': 'Arial, Helvetica, sans-serif',
      'roboto': '"Roboto", sans-serif',
      'open-sans': '"Open Sans", sans-serif',
      'poppins': '"Poppins", sans-serif',
      'tajawal': '"Tajawal", sans-serif',
      'cairo': '"Cairo", sans-serif'
    };
    var fontVal = fonts[fontMatch[1].toLowerCase()] || fontMatch[1];
    var customCss2 = getConfig().settings.customCss || '';
    customCss2 = customCss2.replace(/\/\* font \*\/.*?\/\* end font \*\//gs, '');
    customCss2 += '\n/* font */\nbody { font-family: ' + fontVal + ' !important; }/* end font */';
    var cfg32 = getConfig();
    cfg32.settings.customCss = customCss2;
    saveConfig(cfg32);
    return { reply: 'Font changed to <strong>' + fontMatch[1] + '</strong>.', type: 'success' };
  }

  // Button size
  if (cmd.match(/(?:make|set)\s+(?:the\s+)?(?:buttons?|btns?)\s+(?:bigger|larger|large|big)/)) {
    var customCss3 = getConfig().settings.customCss || '';
    customCss3 = customCss3.replace(/\/\* btnsize \*\/.*?\/\* end btnsize \*\//gs, '');
    customCss3 += '\n/* btnsize */\n.btn { padding: 18px 40px !important; font-size: 18px !important; }/* end btnsize */';
    var cfg33 = getConfig();
    cfg33.settings.customCss = customCss3;
    saveConfig(cfg33);
    return { reply: 'Buttons made bigger.', type: 'success' };
  }
  if (cmd.match(/(?:make|set)\s+(?:the\s+)?(?:buttons?|btns?)\s+(?:smaller|small)/)) {
    var customCss4 = getConfig().settings.customCss || '';
    customCss4 = customCss4.replace(/\/\* btnsize \*\/.*?\/\* end btnsize \*\//gs, '');
    customCss4 += '\n/* btnsize */\n.btn { padding: 10px 20px !important; font-size: 13px !important; }/* end btnsize */';
    var cfg34 = getConfig();
    cfg34.settings.customCss = customCss4;
    saveConfig(cfg34);
    return { reply: 'Buttons made smaller.', type: 'success' };
  }

  // ===== NAVIGATION COMMANDS =====
  var navMatch = cmd.match(/(?:add|create)\s+(?:a\s+)?(?:nav|navigation|link|button)\s+(?:called|named|labeled?)\s*["']?([^"']+?)["']?\s+(?:pointing\s+)?(?:to|->|=>|link\s+to)\s*["']?([^"']+?)["']?\s*$/);
  if (navMatch) {
    var cfg35 = getConfig();
    cfg35.pages.navLinks.push({ label: navMatch[1].trim(), url: navMatch[2].trim(), visible: true });
    saveConfig(cfg35);
    return { reply: 'Navigation link <strong>"' + escapeHtml(navMatch[1]) + '"</strong> added pointing to ' + escapeHtml(navMatch[2]) + '.', type: 'success' };
  }

  if (cmd.match(/(?:hide|remove|delete)\s+(?:all\s+)?nav\s+links?/)) {
    var cfg36 = getConfig();
    cfg36.pages.navLinks.forEach(function(l) { l.visible = false; });
    saveConfig(cfg36);
    return { reply: 'All navigation links hidden.', type: 'success' };
  }

  if (cmd.match(/(?:show|unhide|restore)\s+(?:all\s+)?nav\s+links?/)) {
    var cfg37 = getConfig();
    cfg37.pages.navLinks.forEach(function(l) { l.visible = true; });
    saveConfig(cfg37);
    return { reply: 'All navigation links shown.', type: 'success' };
  }

  // ===== CUSTOM CSS =====
  var cssMatch = cmd.match(/(?:add|set|apply)\s+(?:custom\s+)?css\s*:\s*(.+)/);
  if (cssMatch) {
    var cfg38 = getConfig();
    cfg38.settings.customCss = (cfg38.settings.customCss || '') + '\n' + cssMatch[1];
    saveConfig(cfg38);
    return { reply: 'Custom CSS applied.', type: 'success' };
  }

  // Footer text
  var footerMatch = cmd.match(/(?:set|change)\s+footer\s+(?:text|msg|message)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (footerMatch) {
    var cfg39 = getConfig();
    cfg39.settings.footerText = footerMatch[1].trim();
    saveConfig(cfg39);
    return { reply: 'Footer text updated.', type: 'success' };
  }

  // ===== META / SEO =====
  var metaMatch = cmd.match(/(?:set|change)\s+(?:meta\s+)?(?:description|seo|meta)\s+(?:to\s+)?["']?([^"']+?)["']?\s*$/);
  if (metaMatch) {
    var cfg40 = getConfig();
    cfg40.settings.metaDescription = metaMatch[1].trim();
    saveConfig(cfg40);
    return { reply: 'Meta description updated for SEO.', type: 'success' };
  }

  // ===== NAVIGATION / UI COMMANDS =====
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:users?|user\s+list|manage\s+users)/)) {
    switchTab('users');
    return { reply: 'Opened <strong>Users</strong> management tab.', type: 'success', action: function() { loadAdminUsers(); } };
  }
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:dashboard|stats|statistics|overview)/)) {
    switchTab('dashboard');
    return { reply: 'Opened <strong>Dashboard</strong>.', type: 'success', action: function() { loadDashboard(); } };
  }
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:stories|story\s+list)/)) {
    switchTab('stories');
    return { reply: 'Opened <strong>Stories</strong> tab.', type: 'success' };
  }
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:messages?|chats?|chat\s+list)/)) {
    switchTab('messages');
    return { reply: 'Opened <strong>Messages</strong> tab.', type: 'success' };
  }
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:settings?|config)/)) {
    switchTab('settings');
    return { reply: 'Opened <strong>Settings</strong> tab.', type: 'success' };
  }
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:appearance|theme|colors?)/)) {
    switchTab('appearance');
    return { reply: 'Opened <strong>Appearance</strong> tab.', type: 'success' };
  }
  if (cmd.match(/(?:show|go\s+to|open)\s+(?:the\s+)?(?:content|texts?|edit)/)) {
    switchTab('content');
    return { reply: 'Opened <strong>Content</strong> tab.', type: 'success' };
  }

  // ===== EXPORT / IMPORT =====
  if (cmd.match(/(?:export|download|save)\s+(?:the\s+)?(?:config|configuration|settings)/)) {
    return { reply: 'Exporting config...', type: 'success', action: function() { exportSiteConfig(); } };
  }

  // ===== WHAT CAN YOU DO =====
  if (cmd.match(/(?:what|how|help|features?|commands?|can you|capabilities|ماذا|مساعدة)/)) {
    return { reply: 'I can help you manage your site! Here\'s what I can do:<br><br>' +
      '<strong>Colors:</strong> change primary/background/card/text/border color to [color]<br>' +
      '<strong>Content:</strong> change site title/tagline/description to [text]<br>' +
      '<strong>Features:</strong> add/remove/edit feature [name]<br>' +
      '<strong>Toggles:</strong> enable/disable stories/voice/registration/maintenance<br>' +
      '<strong>Layout:</strong> change border radius, font, button size<br>' +
      '<strong>Navigation:</strong> add nav link, show/hide nav links<br>' +
      '<strong>Announcements:</strong> set/clear announcement banner<br>' +
      '<strong>Navigation:</strong> go to dashboard/users/stories/settings<br>' +
      '<strong>Custom CSS:</strong> add custom CSS code<br>' +
      '<strong>Export:</strong> export config as JSON', type: 'success' };
  }

  // ===== UNKNOWN =====
  return { reply: 'I didn\'t understand that command. Try things like:<br>' +
    '&bull; <code>change primary color to red</code><br>' +
    '&bull; <code>change site title to MyChat</code><br>' +
    '&bull; <code>add feature called Video Chat</code><br>' +
    '&bull; <code>disable stories</code><br>' +
    '&bull; <code>enable maintenance mode</code><br>' +
    '&bull; <code>go to dashboard</code><br>' +
    'Or type <strong>help</strong> for full list.', type: 'error' };
}

function adjustBrightness(hex, percent) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  var r = parseInt(hex.substr(0,2), 16);
  var g = parseInt(hex.substr(2,2), 16);
  var b = parseInt(hex.substr(4,2), 16);
  r = Math.max(0, Math.min(255, r + Math.round(r * percent / 100)));
  g = Math.max(0, Math.min(255, g + Math.round(g * percent / 100)));
  b = Math.max(0, Math.min(255, b + Math.round(b * percent / 100)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
