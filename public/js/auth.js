const API_URL = '/api';

function getToken() {
  // Check localStorage first, fallback to sessionStorage for backward compatibility
  let token = localStorage.getItem('token');
  if (!token) {
    token = sessionStorage.getItem('token');
    if (token) {
      localStorage.setItem('token', token);
    }
  }
  return token;
}

function getUser() {
  let user = localStorage.getItem('user');
  if (!user) {
    user = sessionStorage.getItem('user');
    if (user) {
      localStorage.setItem('user', user);
    }
  }
  return user ? JSON.parse(user) : null;
}

function isAuthenticated() {
  return !!getToken();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.setItem('auth_action', 'logout');
  window.location.href = 'login.html';
}

function redirectIfNotAuthenticated() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
  }
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }
  
  return data;
}

// Listen for storage changes from other tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'auth_action') {
    const action = e.newValue;
    if (action === 'logout' && isAuthenticated()) {
      // Another tab logged out, clear and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
  }
  if (e.key === 'groups_updated') {
    // Refresh dashboard/groups data if on those pages
    const currentPage = window.location.pathname.split('/').pop();
    if (['dashboard.html', 'groups.html', 'group-details.html'].includes(currentPage)) {
      if (typeof loadDashboard === 'function') loadDashboard();
      if (typeof loadGroups === 'function') loadGroups();
      if (typeof loadGroupDetails === 'function') loadGroupDetails();
    }
  }
});

if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
  try {
    const data = await apiCall('/auth/login', 'POST', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('auth_action', 'login');
    window.location.href = 'dashboard.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

if (document.getElementById('signupForm')) {
  document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
      await apiCall('/auth/register', 'POST', { name, email, password });
      alert('Registration successful! Please login.');
      window.location.href = 'login.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

if (document.getElementById('landingSignupForm')) {
  document.getElementById('landingSignupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
    
    try {
      await apiCall('/auth/register', 'POST', { name, email, password });
      alert('Account created! Please login to continue.');
      window.location.href = 'login.html';
    } catch (error) {
      alert(error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Free Account';
    }
  });
}

if (document.getElementById('logoutBtn')) {
  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

const currentPage = window.location.pathname.split('/').pop();
if (['dashboard.html', 'groups.html', 'add-expense.html', 'balance.html', 'group-details.html', 'add-member.html', 'settlement.html'].includes(currentPage)) {
  redirectIfNotAuthenticated();
  loadUserProfile();
}

async function loadUserProfile() {
  try {
    const user = getUser();
    if (user) {
      document.getElementById('userName').textContent = user.name;
      document.getElementById('userEmail').textContent = user.email;
    }
  } catch (error) {
    console.error('Error loading user profile:', error);
  }
}