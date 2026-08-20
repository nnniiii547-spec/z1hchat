// Auto phone layout fix — runs on every page load
(function() {
  var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

  function applyMobileFix() {
    if (!isMobile) return;

    // Force correct viewport height
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');

    // Fix chat-page height
    var chatPage = document.querySelector('.chat-page');
    if (chatPage) {
      chatPage.style.position = 'absolute';
      chatPage.style.top = '0';
      chatPage.style.left = '0';
      chatPage.style.width = '100%';
      chatPage.style.height = window.innerHeight + 'px';
      chatPage.style.overflow = 'hidden';
    }

    // Fix app-container
    var container = document.querySelector('.app-container');
    if (container) {
      container.style.height = window.innerHeight + 'px';
    }

    // Fix chat-area
    var chatArea = document.querySelector('.chat-area');
    if (chatArea) {
      chatArea.style.height = window.innerHeight + 'px';
      chatArea.style.display = 'flex';
      chatArea.style.flexDirection = 'column';
      chatArea.style.overflow = 'hidden';
    }

    // Fix chat-active
    var chatActive = document.querySelector('.chat-active');
    if (chatActive && chatActive.style.display !== 'none') {
      chatActive.style.height = window.innerHeight + 'px';
      chatActive.style.display = 'flex';
      chatActive.style.flexDirection = 'column';
      chatActive.style.overflow = 'hidden';
    }

    // Pin message form to bottom
    var msgForm = document.querySelector('.message-form');
    if (msgForm) {
      msgForm.style.flexShrink = '0';
      msgForm.style.position = 'relative';
      msgForm.style.zIndex = '5';
    }

    // Make messages scrollable
    var msgContainer = document.querySelector('.messages-container');
    if (msgContainer) {
      msgContainer.style.flex = '1';
      msgContainer.style.minHeight = '0';
      msgContainer.style.overflowY = 'auto';
      msgContainer.style.webkitOverflowScrolling = 'touch';
    }
  }

  // Run on load
  applyMobileFix();

  // Re-run on resize (handles keyboard open/close)
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      applyMobileFix();
      // Scroll to bottom after keyboard closes
      var msgContainer = document.querySelector('.messages-container');
      if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
    }, 100);
  });

  // Handle orientation change
  window.addEventListener('orientationchange', function() {
    setTimeout(applyMobileFix, 300);
  });

  // Handle visual viewport (keyboard)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function() {
      var chatPage = document.querySelector('.chat-page');
      if (chatPage) {
        chatPage.style.height = window.visualViewport.height + 'px';
      }
      var container = document.querySelector('.app-container');
      if (container) {
        container.style.height = window.visualViewport.height + 'px';
      }
      var chatActive = document.querySelector('.chat-active');
      if (chatActive && chatActive.style.display !== 'none') {
        chatActive.style.height = window.visualViewport.height + 'px';
      }
      // Scroll to bottom after keyboard
      setTimeout(function() {
        var msgContainer = document.querySelector('.messages-container');
        if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
      }, 100);
    });
  }
})();
