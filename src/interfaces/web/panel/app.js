(function () {
  let token = localStorage.getItem('mcp_admin_token') || null;
  let cachedProviders = [];

  // DOM Elements
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const loggedUser = document.getElementById('logged-user');

  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Modals
  const providerModal = document.getElementById('provider-modal');
  const channelModal = document.getElementById('channel-modal');
  const openProviderModalBtn = document.getElementById('open-provider-modal-btn');
  const openChannelModalBtn = document.getElementById('open-channel-modal-btn');
  const closeButtons = document.querySelectorAll('.close-modal');

  // Forms
  const providerForm = document.getElementById('provider-form');
  const channelForm = document.getElementById('channel-form');
  const providerModalError = document.getElementById('provider-modal-error');
  const channelModalError = document.getElementById('channel-modal-error');

  // Tables & Stats
  const providersTableBody = document.getElementById('providers-table-body');
  const channelsTableBody = document.getElementById('channels-table-body');
  const channelProviderSelect = document.getElementById('c-provider');
  const statProviders = document.getElementById('stat-providers');
  const statChannels = document.getElementById('stat-channels');
  const statDefaultChannel = document.getElementById('stat-default-channel');
  const statUptime = document.getElementById('stat-uptime');
  const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');

  // Helper API fetch
  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
      throw new Error('Sesión expirada o no autorizada');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error en la petición');
    }
    return data;
  }

  // Auth Handling
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
      const res = await api('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      token = res.token;
      localStorage.setItem('mcp_admin_token', token);
      localStorage.setItem('mcp_admin_user', res.user.username);
      initApp(res.user.username);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove('hidden');
    }
  });

  function handleLogout() {
    token = null;
    localStorage.removeItem('mcp_admin_token');
    localStorage.removeItem('mcp_admin_user');
    appView.classList.add('hidden');
    loginView.classList.remove('hidden');
  }

  logoutBtn.addEventListener('click', handleLogout);

  // App Initialization
  function initApp(username) {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    loggedUser.textContent = username || localStorage.getItem('mcp_admin_user') || 'admin';
    loadDashboard();
    loadProviders();
    loadChannels();
  }

  // Tab Navigation
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      navItems.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.classList.add('active');

      if (tabId === 'dashboard') loadDashboard();
      if (tabId === 'providers') loadProviders();
      if (tabId === 'channels') loadChannels();
    });
  });

  // Modal Controls
  openProviderModalBtn.addEventListener('click', () => {
    providerForm.reset();
    providerModalError.classList.add('hidden');
    providerModal.classList.remove('hidden');
  });

  openChannelModalBtn.addEventListener('click', () => {
    channelForm.reset();
    channelModalError.classList.add('hidden');
    populateProviderSelect();
    channelModal.classList.remove('hidden');
  });

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      providerModal.classList.add('hidden');
      channelModal.classList.remove('hidden');
      channelModal.classList.add('hidden');
    });
  });

  // Data Loading: Dashboard
  async function loadDashboard() {
    try {
      const stats = await api('/api/admin/dashboard');
      statProviders.textContent = stats.activeProvidersCount;
      statChannels.textContent = stats.activeChannelsCount;
      statDefaultChannel.textContent = stats.defaultChannel
        ? `${stats.defaultChannel.name} (${stats.defaultChannel.phoneNumber || 'Sin num'})`
        : 'Ninguna';

      const hours = Math.floor(stats.uptimeSeconds / 3600);
      const mins = Math.floor((stats.uptimeSeconds % 3600) / 60);
      statUptime.textContent = `${hours}h ${mins}m`;
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  }

  if (refreshDashboardBtn) {
    refreshDashboardBtn.addEventListener('click', loadDashboard);
  }

  // Data Loading: Providers
  async function loadProviders() {
    try {
      const providers = await api('/api/admin/providers');
      cachedProviders = providers;
      renderProviders(providers);
    } catch (err) {
      providersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted error">Error al cargar proveedores: ${err.message}</td></tr>`;
    }
  }

  function renderProviders(providers) {
    if (providers.length === 0) {
      providersTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay proveedores registrados. Crea uno con "+ Nuevo Proveedor".</td></tr>';
      return;
    }

    providersTableBody.innerHTML = providers
      .map(
        (p) => `
        <tr>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td><span class="badge badge-muted">${escapeHtml(p.type)}</span></td>
          <td><code>${escapeHtml(p.baseUrl)}</code></td>
          <td><span class="badge ${p.isActive ? 'badge-green' : 'badge-muted'}">${p.isActive ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.testProvider('${p.id}')">⚡ Probar</button>
            ${p.isActive ? `<button class="btn btn-danger btn-sm" onclick="window.deleteProvider('${p.id}')">Desactivar</button>` : ''}
          </td>
        </tr>
      `
      )
      .join('');
  }

  // Data Loading: Channels
  async function loadChannels() {
    try {
      const channels = await api('/api/admin/channels');
      renderChannels(channels);
    } catch (err) {
      channelsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted error">Error al cargar canales: ${err.message}</td></tr>`;
    }
  }

  function renderChannels(channels) {
    if (channels.length === 0) {
      channelsTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay líneas/canales configurados. Crea uno con "+ Nueva Línea / Canal".</td></tr>';
      return;
    }

    channelsTableBody.innerHTML = channels
      .map((c) => {
        const prov = cachedProviders.find((p) => p.id === c.providerId);
        const provName = prov ? prov.name : c.providerId;

        return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${c.phoneNumber ? escapeHtml(c.phoneNumber) : '<span class="text-muted">—</span>'}</td>
          <td><span class="badge badge-muted">${escapeHtml(provName)}</span></td>
          <td><code>${c.instanceId ? escapeHtml(c.instanceId) : '<span class="text-muted">—</span>'}</code></td>
          <td>
            ${
              c.isDefault
                ? '<span class="badge badge-green">★ Default</span>'
                : `<button class="btn btn-secondary btn-sm" onclick="window.setDefaultChannel('${c.id}')">Hacer Default</button>`
            }
          </td>
          <td>
            ${c.isActive ? `<button class="btn btn-danger btn-sm" onclick="window.deleteChannel('${c.id}')">Desactivar</button>` : '<span class="text-muted">Inactivo</span>'}
          </td>
        </tr>
      `;
      })
      .join('');
  }

  function populateProviderSelect() {
    channelProviderSelect.innerHTML = '<option value="">Seleccione un proveedor...</option>' +
      cachedProviders
        .filter((p) => p.isActive)
        .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.type})</option>`)
        .join('');
  }

  // Provider Form Submit
  providerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    providerModalError.classList.add('hidden');

    const name = document.getElementById('p-name').value.trim();
    const type = document.getElementById('p-type').value;
    const baseUrl = document.getElementById('p-url').value.trim();
    const apiKey = document.getElementById('p-key').value.trim();

    try {
      await api('/api/admin/providers', {
        method: 'POST',
        body: JSON.stringify({ name, type, baseUrl, apiKey }),
      });
      providerModal.classList.add('hidden');
      loadProviders();
      loadDashboard();
    } catch (err) {
      providerModalError.textContent = err.message;
      providerModalError.classList.remove('hidden');
    }
  });

  // Channel Form Submit
  channelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    channelModalError.classList.add('hidden');

    const name = document.getElementById('c-name').value.trim();
    const providerId = document.getElementById('c-provider').value;
    const phoneNumber = document.getElementById('c-phone').value.trim();
    const instanceId = document.getElementById('c-instance').value.trim();
    const isDefault = document.getElementById('c-default').checked;

    try {
      await api('/api/admin/channels', {
        method: 'POST',
        body: JSON.stringify({ name, providerId, phoneNumber, instanceId, isDefault }),
      });
      channelModal.classList.add('hidden');
      loadChannels();
      loadDashboard();
    } catch (err) {
      channelModalError.textContent = err.message;
      channelModalError.classList.remove('hidden');
    }
  });

  // Global Actions
  window.testProvider = async (id) => {
    try {
      const res = await api(`/api/admin/providers/${id}/test`, { method: 'POST' });
      alert(res.message || 'Prueba exitosa');
    } catch (err) {
      alert(`Error en prueba: ${err.message}`);
    }
  };

  window.deleteProvider = async (id) => {
    if (!confirm('¿Estás seguro de desactivar este proveedor?')) return;
    try {
      await api(`/api/admin/providers/${id}`, { method: 'DELETE' });
      loadProviders();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  window.setDefaultChannel = async (id) => {
    try {
      await api(`/api/admin/channels/${id}/set-default`, { method: 'POST' });
      loadChannels();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  window.deleteChannel = async (id) => {
    if (!confirm('¿Estás seguro de desactivar este canal?')) return;
    try {
      await api(`/api/admin/channels/${id}`, { method: 'DELETE' });
      loadChannels();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Check initial state
  if (token) {
    initApp();
  } else {
    handleLogout();
  }
})();
