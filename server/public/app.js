// ExamGuard Module 1 - Frontend Demonstration Logic
const API_BASE = ''; // Same origin

let currentSession = {
  token: localStorage.getItem('examguard_token') || null,
  user: null
};

// DOM References
const healthBadge = document.getElementById('healthBadge');
const healthStatusText = document.getElementById('healthStatusText');
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const headerUserInfo = document.getElementById('headerUserInfo');
const headerUserName = document.getElementById('headerUserName');
const headerUserRole = document.getElementById('headerUserRole');
const headerUserAvatar = document.getElementById('headerUserAvatar');
const welcomeUserName = document.getElementById('welcomeUserName');
const statRole = document.getElementById('statRole');
const statStatus = document.getElementById('statStatus');
const logoutBtn = document.getElementById('logoutBtn');
const toastContainer = document.getElementById('toastContainer');
const roleFilter = document.getElementById('roleFilter');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const userTableBody = document.getElementById('userTableBody');
const examTableBody = document.getElementById('examTableBody');
const auditTableBody = document.getElementById('auditTableBody');

// Modals
const createUserModal = document.getElementById('createUserModal');
const openCreateUserModalBtn = document.getElementById('openCreateUserModalBtn');
const closeUserModalBtn = document.getElementById('closeUserModalBtn');
const cancelUserModalBtn = document.getElementById('cancelUserModalBtn');
const createUserForm = document.getElementById('createUserForm');

const createExamModal = document.getElementById('createExamModal');
const openCreateExamModalBtn = document.getElementById('openCreateExamModalBtn');
const closeExamModalBtn = document.getElementById('closeExamModalBtn');
const cancelExamModalBtn = document.getElementById('cancelExamModalBtn');
const createExamForm = document.getElementById('createExamForm');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkHealth();
  setInterval(checkHealth, 15000); // Check health periodically

  if (currentSession.token) {
    fetchProfile();
  } else {
    showLogin();
  }
});

// Event Listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);

  // Quick credentials chips
  document.getElementById('fillAdminCreds').addEventListener('click', () => {
    loginEmail.value = 'admin@examguard.local';
    loginPassword.value = 'AdminPass123!';
  });
  document.getElementById('fillCustCreds').addEventListener('click', () => {
    loginEmail.value = 'cust1@examguard.local';
    loginPassword.value = 'CustodianPass123!';
  });

  // Nav Tab switching
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      if (targetId === 'usersTab') loadUsers();
      if (targetId === 'examsTab') loadExams();
      if (targetId === 'auditTab') loadAuditLogs();
    });
  });

  // User management
  roleFilter.addEventListener('change', loadUsers);
  refreshUsersBtn.addEventListener('click', loadUsers);
  openCreateUserModalBtn.addEventListener('click', () => createUserModal.classList.remove('hidden'));
  closeUserModalBtn.addEventListener('click', () => createUserModal.classList.add('hidden'));
  cancelUserModalBtn.addEventListener('click', () => createUserModal.classList.add('hidden'));
  createUserForm.addEventListener('submit', handleCreateUser);

  // Examination management
  if (openCreateExamModalBtn) {
    openCreateExamModalBtn.addEventListener('click', () => createExamModal.classList.remove('hidden'));
    closeExamModalBtn.addEventListener('click', () => createExamModal.classList.add('hidden'));
    cancelExamModalBtn.addEventListener('click', () => createExamModal.classList.add('hidden'));
    createExamForm.addEventListener('submit', handleCreateExam);
  }

  // Audit refresh
  const refreshAuditBtn = document.getElementById('refreshAuditBtn');
  if (refreshAuditBtn) refreshAuditBtn.addEventListener('click', loadAuditLogs);
}

// Health check
async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const json = await res.json();
    if (res.ok && json.data?.database === 'connected') {
      healthBadge.className = 'health-badge connected';
      healthStatusText.textContent = `Backend Online (${json.data.database})`;
    } else {
      healthBadge.className = 'health-badge disconnected';
      healthStatusText.textContent = `DB ${json.data?.database || 'Down'}`;
    }
  } catch (err) {
    healthBadge.className = 'health-badge disconnected';
    healthStatusText.textContent = 'Backend Offline';
  }
}

// Authentication
async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  const submitBtn = document.getElementById('loginSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.querySelector('.spinner')?.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      showToast(json.message || 'Login failed. Check your credentials.', 'error');
      return;
    }

    currentSession.token = json.data.token;
    currentSession.user = json.data.user;
    localStorage.setItem('examguard_token', json.data.token);

    showToast(`Welcome back, ${json.data.user.name}!`, 'success');
    updateUserSessionUI();
  } catch (err) {
    showToast('Network error during authentication.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.spinner')?.classList.add('hidden');
  }
}

async function fetchProfile() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${currentSession.token}` }
    });
    const json = await res.json();

    if (res.ok && json.success) {
      currentSession.user = json.data.user;
      updateUserSessionUI();
    } else {
      handleLogout();
    }
  } catch {
    handleLogout();
  }
}

async function handleLogout() {
  if (currentSession.token) {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentSession.token}` }
      });
    } catch {
      // client-side disposal is primary
    }
  }

  currentSession.token = null;
  currentSession.user = null;
  localStorage.removeItem('examguard_token');
  showLogin();
  showToast('You have been signed out.', 'info');
}

// UI State Management
function showLogin() {
  loginSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  headerUserInfo.classList.add('hidden');
}

function updateUserSessionUI() {
  const user = currentSession.user;
  if (!user) return;

  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  headerUserInfo.classList.remove('hidden');

  headerUserName.textContent = user.name;
  headerUserRole.textContent = user.role;
  headerUserRole.className = `badge role-badge ${user.role.toLowerCase()}`;
  headerUserAvatar.textContent = user.name.charAt(0).toUpperCase();

  welcomeUserName.textContent = user.name;
  statRole.textContent = user.role;
  statStatus.textContent = user.isActive ? 'Active' : 'Deactivated';

  // Role Scoping UI
  const isAdmin = user.role === 'Admin';
  const isCustodian = user.role === 'Custodian';
  const isInvestigator = user.role === 'Investigator';

  // Toggle Admin-only controls
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  // Update capability statuses
  const adminScope = document.getElementById('adminScopeStatus');
  const custScope = document.getElementById('custodianScopeStatus');
  const invScope = document.getElementById('investigatorScopeStatus');

  if (adminScope) {
    adminScope.textContent = isAdmin ? 'Granted (Full Admin)' : 'Restricted (403)';
    adminScope.className = `cap-status ${isAdmin ? 'granted' : 'restricted'}`;
  }
  if (custScope) {
    custScope.textContent = isCustodian ? 'Active Role' : (isAdmin ? 'Admin Supersets' : 'Restricted');
    custScope.className = `cap-status ${isCustodian || isAdmin ? 'granted' : 'restricted'}`;
  }
  if (invScope) {
    invScope.textContent = isInvestigator ? 'Active Role' : (isAdmin ? 'Admin Supersets' : 'Restricted');
    invScope.className = `cap-status ${isInvestigator || isAdmin ? 'granted' : 'restricted'}`;
  }

  // Load default data
  if (isAdmin) loadUsers();
  loadExams();
}

// User Management Actions
async function loadUsers() {
  if (currentSession.user?.role !== 'Admin') return;

  userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading users...</td></tr>';
  const role = roleFilter.value;
  const url = `${API_BASE}/api/users?page=1&limit=50${role ? `&role=${role}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${currentSession.token}` }
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      userTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">${json.message || 'Failed to load users'}</td></tr>`;
      return;
    }

    const users = json.data.users || [];
    if (users.length === 0) {
      userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No users found.</td></tr>';
      return;
    }

    userTableBody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="font-weight: 600;">${escapeHtml(u.name)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(u.email)}</div>
        </td>
        <td>
          <span class="badge ${u.role.toLowerCase()}">${u.role}</span>
        </td>
        <td>
          <span class="badge ${u.isActive ? 'active' : 'inactive'}">${u.isActive ? 'Active' : 'Disabled'}</span>
        </td>
        <td style="font-size: 0.8rem; color: var(--text-secondary);">
          ${new Date(u.createdAt).toLocaleDateString()}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.id}', ${!u.isActive})" ${u.id === currentSession.user.id ? 'disabled title="Cannot deactivate self"' : ''}>
            ${u.isActive ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    userTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to fetch users.</td></tr>';
  }
}

window.toggleUserStatus = async function(userId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/api/users/${userId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.token}`
      },
      body: JSON.stringify({ isActive: newStatus })
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showToast(`User status updated to ${newStatus ? 'Active' : 'Disabled'}`, 'success');
      loadUsers();
    } else {
      showToast(json.message || 'Status change rejected', 'error');
    }
  } catch {
    showToast('Network error updating user status', 'error');
  }
};

async function handleCreateUser(e) {
  e.preventDefault();
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const role = document.getElementById('newUserRole').value;
  const password = document.getElementById('newUserPassword').value;

  try {
    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.token}`
      },
      body: JSON.stringify({ name, email, role, password })
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showToast(`User ${name} created successfully!`, 'success');
      createUserModal.classList.add('hidden');
      createUserForm.reset();
      loadUsers();
    } else {
      const errDetail = json.errors ? json.errors.map(e => e.message).join(', ') : json.message;
      showToast(errDetail || 'Failed to create user', 'error');
    }
  } catch {
    showToast('Network error during user creation', 'error');
  }
}

// Examination Management
async function loadExams() {
  examTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading examinations...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/api/examinations`, {
      headers: { Authorization: `Bearer ${currentSession.token}` }
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      examTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">${json.message || 'Failed to load examinations'}</td></tr>`;
      return;
    }

    const exams = json.data.examinations || [];
    if (exams.length === 0) {
      examTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No examinations accessible under this role.</td></tr>';
      return;
    }

    examTableBody.innerHTML = exams.map(x => `
      <tr>
        <td><code>${escapeHtml(x.examinationCode)}</code></td>
        <td style="font-weight: 600;">${escapeHtml(x.title)}</td>
        <td><span class="badge ${x.status === 'Draft' ? 'inactive' : 'active'}">${x.status}</span></td>
        <td style="font-size: 0.8rem;">${new Date(x.scheduledDateTime).toLocaleString()}</td>
        <td style="font-size: 0.8rem; color: var(--text-secondary);">${x.assignedCustodians?.length || 0} Custodians</td>
      </tr>
    `).join('');
  } catch {
    examTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to fetch examinations.</td></tr>';
  }
}

async function handleCreateExam(e) {
  e.preventDefault();
  const examinationCode = document.getElementById('newExamCode').value.trim();
  const title = document.getElementById('newExamTitle').value.trim();
  const scheduledDateTime = new Date(document.getElementById('newExamDate').value).toISOString();

  try {
    const res = await fetch(`${API_BASE}/api/examinations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentSession.token}`
      },
      body: JSON.stringify({ examinationCode, title, scheduledDateTime })
    });
    const json = await res.json();

    if (res.ok && json.success) {
      showToast(`Examination ${examinationCode} created!`, 'success');
      createExamModal.classList.add('hidden');
      createExamForm.reset();
      loadExams();
    } else {
      showToast(json.message || 'Failed to create examination', 'error');
    }
  } catch {
    showToast('Network error creating examination', 'error');
  }
}

// Audit Logs
async function loadAuditLogs() {
  if (currentSession.user?.role !== 'Admin') return;
  auditTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading audit logs...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/api/audit-logs?limit=30`, {
      headers: { Authorization: `Bearer ${currentSession.token}` }
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      auditTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">${json.message || 'Failed to load audit logs'}</td></tr>`;
      return;
    }

    const logs = json.data.auditLogs || [];
    if (logs.length === 0) {
      auditTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No audit events recorded yet.</td></tr>';
      return;
    }

    auditTableBody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(l.createdAt).toLocaleTimeString()}</td>
        <td><code>${escapeHtml(l.action)}</code></td>
        <td><span class="badge ${l.outcome === 'success' ? 'active' : 'inactive'}">${l.outcome}</span></td>
        <td style="font-size: 0.8rem;">${escapeHtml(l.actor?.email || l.actorIp || 'System')}</td>
        <td style="font-size: 0.8rem; color: var(--text-secondary);">${l.resourceType ? `${l.resourceType}` : '-'}</td>
      </tr>
    `).join('');
  } catch {
    auditTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to fetch audit logs.</td></tr>';
  }
}

// Utilities
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
