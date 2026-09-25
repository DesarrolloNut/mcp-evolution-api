(function () {
  let token = localStorage.getItem('mcp_admin_token') || null;
  let cachedProviders = [];
  let qrPollInterval = null;
  let activeQrChannelId = null;

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
  const qrModal = document.getElementById('qr-modal');
  const sendMessageModal = document.getElementById('send-message-modal');
  const openProviderModalBtn = document.getElementById('open-provider-modal-btn');
  const openChannelModalBtn = document.getElementById('open-channel-modal-btn');
  const closeButtons = document.querySelectorAll('.close-modal');

  // Forms & Inputs
  const providerForm = document.getElementById('provider-form');
  const channelForm = document.getElementById('channel-form');
  const sendMessageForm = document.getElementById('send-message-form');
  const providerTypeSelect = document.getElementById('p-type');
  const providerExternalFields = document.getElementById('p-external-fields');
  const providerBaileysNote = document.getElementById('p-baileys-note');
  const providerUrlInput = document.getElementById('p-url');
  const providerKeyInput = document.getElementById('p-key');
  const channelInstanceGroup = document.getElementById('c-instance-group');
  const providerModalError = document.getElementById('provider-modal-error');
  const channelModalError = document.getElementById('channel-modal-error');

  // Send Message Modal Elements
  const smModalSubtitle = document.getElementById('sm-modal-subtitle');
  const smChannelNameInput = document.getElementById('sm-channel-name');
  const smRecipientInput = document.getElementById('sm-recipient');
  const smTextInput = document.getElementById('sm-text');
  const smModalAlert = document.getElementById('sm-modal-alert');
  const smSubmitBtn = document.getElementById('sm-submit-btn');
  const smBtnText = document.getElementById('sm-btn-text');
  // QR Modal Elements
  const qrModalTitle = document.getElementById('qr-modal-title');
  const qrModalSubtitle = document.getElementById('qr-modal-subtitle');
  const qrStatusBadge = document.getElementById('qr-status-badge');
  const qrLoader = document.getElementById('qr-loader');
  const qrLoaderText = document.getElementById('qr-loader-text');
  const qrImageWrapper = document.getElementById('qr-image-wrapper');
  const qrImage = document.getElementById('qr-image');
  const qrSuccessCard = document.getElementById('qr-success-card');
  const qrConnectedPhone = document.getElementById('qr-connected-phone');
  const qrLogoutActionBtn = document.getElementById('qr-logout-action-btn');
  const qrRetryActionBtn = document.getElementById('qr-retry-action-btn');

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
    stopQrPolling();
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
    if (btn.tagName.toLowerCase() === 'button') {
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
    }
  });

  // Modal Controls
  openProviderModalBtn.addEventListener('click', () => {
    providerForm.reset();
    providerModalError.classList.add('hidden');
    updateProviderFormVisibility();
    providerModal.classList.remove('hidden');
  });

  openChannelModalBtn.addEventListener('click', () => {
    channelForm.reset();
    channelModalError.classList.add('hidden');
    populateProviderSelect();
    updateChannelFormVisibility();
    channelModal.classList.remove('hidden');
  });

  function closeAllModals() {
    stopQrPolling();
    closeAllDropdowns();
    providerModal.classList.add('hidden');
    channelModal.classList.add('hidden');
    qrModal.classList.add('hidden');
    if (sendMessageModal) sendMessageModal.classList.add('hidden');
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', closeAllModals);
  });

  // Provider Type Selector Toggle
  function updateProviderFormVisibility() {
    const selectedType = providerTypeSelect.value;
    if (selectedType === 'baileys') {
      providerExternalFields.classList.add('hidden');
      providerBaileysNote.classList.remove('hidden');
      providerUrlInput.removeAttribute('required');
      providerKeyInput.removeAttribute('required');
    } else {
      providerExternalFields.classList.remove('hidden');
      providerBaileysNote.classList.add('hidden');
      providerUrlInput.setAttribute('required', 'required');
      providerKeyInput.setAttribute('required', 'required');
    }
  }

  providerTypeSelect.addEventListener('change', updateProviderFormVisibility);

  // Channel Provider Selector Toggle
  function updateChannelFormVisibility() {
    const provId = channelProviderSelect.value;
    const prov = cachedProviders.find((p) => p.id === provId);
    if (prov && prov.type === 'baileys') {
      if (channelInstanceGroup) channelInstanceGroup.classList.add('hidden');
    } else {
      if (channelInstanceGroup) channelInstanceGroup.classList.remove('hidden');
    }
  }

  channelProviderSelect.addEventListener('change', updateChannelFormVisibility);

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
          <td><span class="badge ${p.type === 'baileys' ? 'badge-blue' : 'badge-muted'}">${escapeHtml(p.type)}</span></td>
          <td><code>${p.type === 'baileys' ? 'embebido://whatsapp-web' : escapeHtml(p.baseUrl)}</code></td>
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
      if (!cachedProviders || cachedProviders.length === 0) {
        cachedProviders = await api('/api/admin/providers');
      }
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
        const isBaileys = prov ? prov.type === 'baileys' : false;

        return `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${c.phoneNumber ? `<code>${escapeHtml(c.phoneNumber)}</code>` : '<span class="text-muted">—</span>'}</td>
          <td><span class="badge ${isBaileys ? 'badge-blue' : 'badge-muted'}">${escapeHtml(provName)}</span></td>
          <td><code>${c.instanceId ? escapeHtml(c.instanceId) : (isBaileys ? '<span class="text-green">directo</span>' : '<span class="text-muted">—</span>')}</code></td>
          <td>
            ${
              c.isDefault
                ? '<span class="badge badge-green">★ Default</span>'
                : `<button class="btn btn-secondary btn-sm" onclick="window.setDefaultChannel('${c.id}')">Hacer Default</button>`
            }
          </td>
          <td>
            <div class="dropdown" id="dropdown-wrapper-${c.id}">
              <button type="button" class="btn-dropdown-trigger" onclick="window.toggleActionMenu(event, '${c.id}')" title="Acciones de línea">⋮</button>
              <div class="dropdown-menu hidden" id="dropdown-menu-${c.id}">
                <button type="button" class="dropdown-item" onclick="window.openSendMessageModal('${escapeHtml(c.name)}', '${escapeHtml(c.phoneNumber || '')}')">
                  💬 Enviar Mensaje
                </button>
                ${
                  isBaileys
                    ? `<button type="button" class="dropdown-item" onclick="window.openQrModal('${c.id}', '${escapeHtml(c.name)}')">
                        📱 Vincular / Estado QR
                      </button>`
                    : ''
                }
                ${
                  !c.isDefault
                    ? `<button type="button" class="dropdown-item" onclick="window.setDefaultChannel('${c.id}')">
                        ★ Hacer Predeterminada
                      </button>`
                    : ''
                }
                <div class="dropdown-divider"></div>
                ${
                  c.isActive
                    ? `<button type="button" class="dropdown-item danger" onclick="window.deleteChannel('${c.id}')">
                        🗑️ Desactivar Línea
                      </button>`
                    : `<span class="dropdown-item text-muted">Línea Inactiva</span>`
                }
              </div>
            </div>
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
        .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} (${p.type === 'baileys' ? 'Baileys Embebido' : p.type})</option>`)
        .join('');
  }

  // Dropdown Menu Controls
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach((m) => m.classList.add('hidden'));
    document.querySelectorAll('.btn-dropdown-trigger').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.dropdown').forEach((d) => d.classList.remove('active'));
  }

  window.toggleActionMenu = (e, channelId) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const menu = document.getElementById(`dropdown-menu-${channelId}`);
    const wrapper = document.getElementById(`dropdown-wrapper-${channelId}`);
    const trigger = e ? e.currentTarget : (wrapper ? wrapper.querySelector('.btn-dropdown-trigger') : null);
    const isHidden = menu ? menu.classList.contains('hidden') : false;

    closeAllDropdowns();

    if (menu && isHidden) {
      menu.classList.remove('hidden');
      if (trigger) trigger.classList.add('active');
      if (wrapper) wrapper.classList.add('active');
    }
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      closeAllDropdowns();
    }
  });

  // Send Message Modal Handling
  window.openSendMessageModal = (channelName, phoneNumber) => {
    closeAllDropdowns();
    smChannelNameInput.value = channelName;
    smModalSubtitle.textContent = `Desde línea: ${channelName}${phoneNumber ? ` (${phoneNumber})` : ''}`;
    smRecipientInput.value = '';
    smTextInput.value = '';
    smModalAlert.className = 'alert hidden';
    smModalAlert.textContent = '';
    smSubmitBtn.disabled = false;
    smBtnText.textContent = '🚀 Enviar Mensaje';

    sendMessageModal.classList.remove('hidden');
    smRecipientInput.focus();
  };

  if (sendMessageForm) {
    sendMessageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      smModalAlert.className = 'alert hidden';

      const channel = smChannelNameInput.value.trim();
      const recipient = smRecipientInput.value.trim();
      const text = smTextInput.value.trim();

      if (!recipient || !text) {
        smModalAlert.className = 'alert error';
        smModalAlert.textContent = 'Por favor completa el destinatario y el mensaje.';
        return;
      }

      smSubmitBtn.disabled = true;
      smBtnText.textContent = 'Enviando mensaje...';

      try {
        const res = await api('/api/messages/text', {
          method: 'POST',
          body: JSON.stringify({ recipient, text, channel }),
        });

        smModalAlert.className = 'alert success';
        const msgId = res.result?.messageId || 'OK';
        smModalAlert.innerHTML = `✅ <strong>¡Mensaje Enviado con Éxito!</strong><br><small class="text-muted">ID de entrega: ${escapeHtml(msgId)}</small>`;
        smTextInput.value = '';
      } catch (err) {
        smModalAlert.className = 'alert error';
        smModalAlert.textContent = `❌ Error al enviar mensaje: ${err.message}`;
      } finally {
        smSubmitBtn.disabled = false;
        smBtnText.textContent = '🚀 Enviar Mensaje';
      }
    });
  }

  // Provider Form Submit
  providerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    providerModalError.classList.add('hidden');

    const name = document.getElementById('p-name').value.trim();
    const type = providerTypeSelect.value;
    let baseUrl = providerUrlInput.value.trim();
    let apiKey = providerKeyInput.value.trim();

    if (type === 'baileys') {
      if (!baseUrl) baseUrl = 'embedded://whatsapp-web';
      if (!apiKey) apiKey = 'embedded-session-auth';
    }

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
    const providerId = channelProviderSelect.value;
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

  // QR Modal & Session Lifecycle
  function stopQrPolling() {
    if (qrPollInterval) {
      clearInterval(qrPollInterval);
      qrPollInterval = null;
    }
  }

  window.openQrModal = async (channelId, channelName) => {
    closeAllDropdowns();
    activeQrChannelId = channelId;
    stopQrPolling();

    qrModalTitle.textContent = '📱 Vincular WhatsApp Web';
    qrModalSubtitle.textContent = `Canal: ${channelName}`;
    qrStatusBadge.className = 'badge badge-muted badge-pulse';
    qrStatusBadge.textContent = 'Iniciando sesión...';

    qrLoader.classList.remove('hidden');
    qrLoaderText.textContent = 'Iniciando socket y generando código QR...';
    qrImageWrapper.classList.add('hidden');
    qrSuccessCard.classList.add('hidden');
    qrLogoutActionBtn.classList.add('hidden');

    qrModal.classList.remove('hidden');

    try {
      // Trigger session start
      await api(`/api/admin/channels/${channelId}/session/start`, { method: 'POST' });
    } catch (err) {
      console.warn('Session start notice:', err.message);
    }

    // Immediately poll and start loop
    await fetchQrStatus(channelId);
    qrPollInterval = setInterval(() => {
      fetchQrStatus(channelId);
    }, 2500);
  };

  async function fetchQrStatus(channelId) {
    if (activeQrChannelId !== channelId) return;

    try {
      const res = await api(`/api/admin/channels/${channelId}/session/qr`);

      if (res.status === 'connected' || res.isConnected) {
        qrStatusBadge.className = 'badge badge-green';
        qrStatusBadge.textContent = '✅ Conectado y Listo';
        qrLoader.classList.add('hidden');
        qrImageWrapper.classList.add('hidden');
        qrSuccessCard.classList.remove('hidden');
        qrConnectedPhone.textContent = res.userPhone ? `+${res.userPhone}` : 'Conexión activa';
        qrLogoutActionBtn.classList.remove('hidden');
        stopQrPolling();

        // Refresh main lists
        loadChannels();
        loadDashboard();
      } else if (res.status === 'qr_ready' && res.qrDataUrl) {
        qrStatusBadge.className = 'badge badge-yellow badge-pulse';
        qrStatusBadge.textContent = 'Esperando escaneo con tu teléfono...';
        qrLoader.classList.add('hidden');
        qrSuccessCard.classList.add('hidden');
        qrImage.src = res.qrDataUrl;
        qrImageWrapper.classList.remove('hidden');
        qrLogoutActionBtn.classList.add('hidden');
      } else if (res.status === 'connecting') {
        qrStatusBadge.className = 'badge badge-blue badge-pulse';
        qrStatusBadge.textContent = 'Autenticando vinculación...';
        qrLoader.classList.remove('hidden');
        qrLoaderText.textContent = 'Vinculando dispositivo con WhatsApp...';
        qrImageWrapper.classList.add('hidden');
        qrSuccessCard.classList.add('hidden');
      } else if (res.status === 'disconnected') {
        qrStatusBadge.className = 'badge badge-muted';
        qrStatusBadge.textContent = 'Sesión desconectada';
        qrLoader.classList.remove('hidden');
        qrLoaderText.textContent = 'Sesión cerrada o desconectada. Pulsa "Regenerar QR" para vincular.';
        qrImageWrapper.classList.add('hidden');
        qrSuccessCard.classList.add('hidden');
        qrLogoutActionBtn.classList.add('hidden');
      }
    } catch (err) {
      qrStatusBadge.className = 'badge badge-muted';
      qrStatusBadge.textContent = 'Error consultando estado';
      qrLoaderText.textContent = `Error: ${err.message}`;
    }
  }

  // Retry / Regenerate QR Button
  if (qrRetryActionBtn) {
    qrRetryActionBtn.addEventListener('click', async () => {
      if (!activeQrChannelId) return;
      qrLoader.classList.remove('hidden');
      qrLoaderText.textContent = 'Reiniciando sesión y generando nuevo código QR...';
      qrImageWrapper.classList.add('hidden');
      qrSuccessCard.classList.add('hidden');
      qrStatusBadge.className = 'badge badge-muted badge-pulse';
      qrStatusBadge.textContent = 'Regenerando...';

      try {
        await api(`/api/admin/channels/${activeQrChannelId}/session/start`, {
          method: 'POST',
          body: JSON.stringify({ forceNew: true }),
        });
        stopQrPolling();
        await fetchQrStatus(activeQrChannelId);
        qrPollInterval = setInterval(() => {
          fetchQrStatus(activeQrChannelId);
        }, 2500);
      } catch (err) {
        alert(`Error al reiniciar sesión: ${err.message}`);
      }
    });
  }

  // Disconnect / Logout Action Button
  if (qrLogoutActionBtn) {
    qrLogoutActionBtn.addEventListener('click', async () => {
      if (!activeQrChannelId) return;
      if (!confirm('¿Estás seguro de desconectar y cerrar la sesión de WhatsApp para esta línea?')) return;

      try {
        await api(`/api/admin/channels/${activeQrChannelId}/session/logout`, { method: 'POST' });
        alert('Sesión de WhatsApp cerrada exitosamente.');
        stopQrPolling();
        qrSuccessCard.classList.add('hidden');
        qrLogoutActionBtn.classList.add('hidden');
        qrLoader.classList.remove('hidden');
        qrLoaderText.textContent = 'Sesión cerrada. Pulsa "Regenerar QR" para volver a vincular.';
        qrStatusBadge.className = 'badge badge-muted';
        qrStatusBadge.textContent = 'Desconectado';
        loadChannels();
        loadDashboard();
      } catch (err) {
        alert(`Error al cerrar sesión: ${err.message}`);
      }
    });
  }

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

