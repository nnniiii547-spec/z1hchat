const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const errorMsg = document.getElementById('errorMsg');

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      errorMsg.textContent = 'Passwords do not match';
      return;
    }

    if (password.length < 6) {
      errorMsg.textContent = 'Password must be at least 6 characters';
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.error;
        return;
      }

      localStorage.setItem('user', JSON.stringify({
        id: data.userId,
        username: data.username,
        avatar: data.avatar
      }));
      window.location.href = 'chat.html';
    } catch (err) {
      errorMsg.textContent = 'Connection error. Please try again.';
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorMsg.textContent = data.error;
        return;
      }

      localStorage.setItem('user', JSON.stringify({
        id: data.userId,
        username: data.username,
        avatar: data.avatar
      }));
      window.location.href = 'chat.html';
    } catch (err) {
      errorMsg.textContent = 'Connection error. Please try again.';
    }
  });
}
