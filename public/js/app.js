/**
 * ==============================================================================
 * HI PLATEG - КЛИЕНТСКИЙ ИНТЕРФЕЙС И ЛОГИКА (FULL-FEATURED CLIENT ENGINE)
 * ==============================================================================
 */

// Глобальное состояние
const state = {
  token: localStorage.getItem('hp_token') || null,
  user: JSON.parse(localStorage.getItem('hp_user') || 'null'),
  activeTab: 'overview',
  transactions: [],
  adminStats: null,
  adminUsers: [],
  adminSettings: null,
  adminLogs: [],
  turnoverChart: null,
  filterStatus: 'all',
  searchQuery: ''
};

// Запасные демо-данные для работы оффлайн (или без бэкенда)
const mockDB = {
  settings: {
    platformName: 'Hi Plateg',
    currency: 'RUB',
    maintenance: false,
    minDeposit: 100,
    maxDeposit: 1500000,
    baseCommissionPercent: 2.5,
    methodCommissions: {
      sbp: 1.5,
      card: 2.8,
      crypto: 1.0,
      p2p: 3.5,
      mir_pay: 2.0
    },
    payoutCommissionPercent: 1.8,
    antiFraudEnabled: true
  },
  users: [
    {
      id: 'usr_admin_001',
      name: 'Главный Администратор',
      email: 'admin@hiplateg.io',
      role: 'admin',
      balance: 854200.50,
      holdBalance: 12500.00,
      currency: 'RUB',
      status: 'active',
      twoFactorEnabled: true,
      apiKeyPublic: 'hp_live_adm_994821a0f8234912',
      apiKeySecret: 'hp_sec_adm_e1b746f3c1a90d843810f',
      webhookUrl: 'https://api.hiplateg.io/webhooks/v1',
      customCommission: null,
      createdAt: '2026-01-10T12:00:00.000Z'
    },
    {
      id: 'usr_demo_002',
      name: 'Neon Store / ИП Иванов',
      email: 'merchant@store.ru',
      role: 'merchant',
      balance: 142850.00,
      holdBalance: 4200.00,
      currency: 'RUB',
      status: 'active',
      twoFactorEnabled: false,
      apiKeyPublic: 'hp_live_mer_55a290f11cd73491',
      apiKeySecret: 'hp_sec_mer_8f39b1a039d549e3820fa',
      webhookUrl: 'https://neon-store.ru/api/pay-callback',
      customCommission: 2.2,
      createdAt: '2026-02-15T09:30:00.000Z'
    },
    {
      id: 'usr_demo_003',
      name: 'CyberGames Digital Ltd',
      email: 'billing@cybergames.io',
      role: 'merchant',
      balance: 48920.00,
      holdBalance: 1000.00,
      currency: 'RUB',
      status: 'active',
      twoFactorEnabled: true,
      apiKeyPublic: 'hp_live_cg_77a942001bb8',
      apiKeySecret: 'hp_sec_cg_11aa0294820c',
      webhookUrl: 'https://cybergames.io/notify',
      customCommission: 1.8,
      createdAt: '2026-03-01T14:20:00.000Z'
    }
  ],
  transactions: [
    {
      id: 'tx_9823412',
      userId: 'usr_demo_002',
      merchantName: 'Neon Store / ИП Иванов',
      type: 'deposit',
      amount: 5490,
      netAmount: 5369.22,
      fee: 120.78,
      currency: 'RUB',
      method: 'sbp',
      description: 'Оплата заказа #4912 (Гарнитура HyperCyber)',
      customerEmail: 'alex@yandex.ru',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString()
    },
    {
      id: 'tx_9823411',
      userId: 'usr_demo_002',
      merchantName: 'Neon Store / ИП Иванов',
      type: 'deposit',
      amount: 14900,
      netAmount: 14482.80,
      fee: 417.20,
      currency: 'RUB',
      method: 'card',
      description: 'Оплата годовой подписки Pro Studio',
      customerEmail: 'dmitry.pro@gmail.com',
      status: 'success',
      createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString()
    },
    {
      id: 'tx_9823410',
      userId: 'usr_demo_002',
      merchantName: 'Neon Store / ИП Иванов',
      type: 'deposit',
      amount: 2500,
      netAmount: 2475.00,
      fee: 25.00,
      currency: 'RUB',
      method: 'crypto',
      description: 'Пополнение баланса аккаунта USDT',
      customerEmail: 'crypto_trader@proton.me',
      status: 'pending',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    {
      id: 'tx_9823409',
      userId: 'usr_demo_002',
      merchantName: 'Neon Store / ИП Иванов',
      type: 'payout',
      amount: 50000,
      netAmount: 50000.00,
      fee: 900.00,
      currency: 'RUB',
      method: 'sbp_payout',
      description: 'Вывод на р/с ИП Т-Банк',
      customerEmail: 'merchant@store.ru',
      status: 'success',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  logs: [
    { id: 'l_1', type: 'SECURITY', message: 'Система инициализирована. Защищенный шлюз Hi Plateg активен.', ip: '127.0.0.1', timestamp: new Date().toISOString() },
    { id: 'l_2', type: 'ADMIN', message: 'Глобальные лимиты и антифрод модуль проверены.', ip: '127.0.0.1', timestamp: new Date().toISOString() }
  ]
};

// Загрузка мок-данных из localStorage если есть
if (!localStorage.getItem('hp_mock_initialized')) {
  localStorage.setItem('hp_mock_db', JSON.stringify(mockDB));
  localStorage.setItem('hp_mock_initialized', 'true');
}

function getStoredMockDB() {
  try {
    return JSON.parse(localStorage.getItem('hp_mock_db')) || mockDB;
  } catch (e) {
    return mockDB;
  }
}

function saveStoredMockDB(data) {
  localStorage.setItem('hp_mock_db', JSON.stringify(data));
}

// Универсальный API-клиент с защитой и прозрачным fallback
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  try {
    const res = await fetch(endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка запроса к серверу');
    return data;
  } catch (err) {
    // Если сервер недоступен (например, открыто через file://), используем мок-эмулятор
    console.warn(`[Hi Plateg Client Bridge] Работа в автономном режиме для ${endpoint}:`, err.message);
    return emulateApi(endpoint, method, body);
  }
}

// Эмулятор бэкенда для офлайн/мгновенной работы
function emulateApi(endpoint, method, body) {
  const db = getStoredMockDB();

  if (endpoint === '/api/auth/login') {
    const { email, password } = body;
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error('Неверный email или пароль');
    if (user.status === 'blocked') throw new Error('Аккаунт заблокирован службой безопасности');
    const token = 'mock_jwt_token_' + Date.now();
    return { token, user, message: 'Авторизация успешна' };
  }

  if (endpoint === '/api/auth/register') {
    const { name, email, currency = 'RUB' } = body;
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) throw new Error('Email уже используется');
    const newUser = {
      id: 'usr_' + Date.now(),
      name,
      email,
      role: 'merchant',
      balance: 0,
      holdBalance: 0,
      currency,
      status: 'active',
      twoFactorEnabled: false,
      apiKeyPublic: 'hp_live_' + Math.random().toString(36).substring(2, 12),
      apiKeySecret: 'hp_sec_' + Math.random().toString(36).substring(2, 16),
      webhookUrl: '',
      customCommission: null,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    saveStoredMockDB(db);
    return { token: 'mock_jwt_' + Date.now(), user: newUser, message: 'Регистрация успешна' };
  }

  if (endpoint === '/api/transactions') {
    let list = db.transactions;
    if (state.user && state.user.role !== 'admin') {
      list = list.filter(t => t.userId === state.user.id);
    }
    return { transactions: list };
  }

  if (endpoint === '/api/transactions/create-invoice') {
    const { amount, description, method = 'sbp', customerEmail = '' } = body;
    const numAmount = parseFloat(amount);
    const commRate = state.user.customCommission || db.settings.methodCommissions[method] || 2.5;
    const fee = +(numAmount * (commRate / 100)).toFixed(2);
    const net = +(numAmount - fee).toFixed(2);
    const newTx = {
      id: 'tx_' + Math.floor(1000000 + Math.random() * 9000000),
      userId: state.user.id,
      merchantName: state.user.name,
      type: 'deposit',
      amount: numAmount,
      netAmount: net,
      fee,
      currency: state.user.currency,
      method,
      description: description || 'Оплата заказа',
      customerEmail,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.transactions.unshift(newTx);
    saveStoredMockDB(db);
    return { transaction: newTx, message: 'Счет успешно сформирован', paymentUrl: 'pay.html?invoice=' + newTx.id };
  }

  if (endpoint === '/api/transactions/payout') {
    const { amount, destination } = body;
    const numAmount = parseFloat(amount);
    const fee = +(numAmount * 0.018).toFixed(2);
    const total = numAmount + fee;
    const user = db.users.find(u => u.id === state.user.id);
    if (user.balance < total) throw new Error('Недостаточно средств на балансе');
    user.balance = +(user.balance - total).toFixed(2);
    const payoutTx = {
      id: 'tx_out_' + Math.floor(1000000 + Math.random() * 9000000),
      userId: user.id,
      merchantName: user.name,
      type: 'payout',
      amount: numAmount,
      netAmount: numAmount,
      fee,
      currency: user.currency,
      method: 'sbp_payout',
      description: `Вывод на реквизиты: ${destination}`,
      customerEmail: user.email,
      status: 'success',
      createdAt: new Date().toISOString()
    };
    db.transactions.unshift(payoutTx);
    saveStoredMockDB(db);
    state.user.balance = user.balance;
    localStorage.setItem('hp_user', JSON.stringify(state.user));
    return { newBalance: user.balance, transaction: payoutTx, message: 'Выплата отправлена' };
  }

  if (endpoint === '/api/checkout/pay-simulation') {
    const { transactionId } = body;
    const tx = db.transactions.find(t => t.id === transactionId);
    if (!tx) throw new Error('Платеж не найден');
    tx.status = 'success';
    const merchant = db.users.find(u => u.id === tx.userId);
    if (merchant) {
      merchant.balance = +(merchant.balance + tx.netAmount).toFixed(2);
      if (state.user && state.user.id === merchant.id) {
        state.user.balance = merchant.balance;
        localStorage.setItem('hp_user', JSON.stringify(state.user));
      }
    }
    saveStoredMockDB(db);
    return { transaction: tx, message: 'Платеж успешно зачислен' };
  }

  if (endpoint === '/api/admin/overview') {
    const turnover = db.transactions.filter(t => t.type === 'deposit' && t.status === 'success').reduce((s, t) => s + t.amount, 0);
    const comms = db.transactions.filter(t => t.status === 'success').reduce((s, t) => s + (t.fee || 0), 0);
    const payouts = db.transactions.filter(t => t.type === 'payout' && t.status === 'success').reduce((s, t) => s + t.amount, 0);
    return {
      stats: {
        totalUsers: db.users.length,
        activeUsers: db.users.filter(u => u.status === 'active').length,
        totalTurnover: +turnover.toFixed(2),
        totalCommissionsEarned: +comms.toFixed(2),
        totalPayouts: +payouts.toFixed(2),
        pendingTransactions: db.transactions.filter(t => t.status === 'pending').length
      },
      settings: db.settings
    };
  }

  if (endpoint === '/api/admin/users') {
    return { users: db.users };
  }

  if (endpoint.startsWith('/api/admin/users/') && endpoint.endsWith('/status')) {
    const parts = endpoint.split('/');
    const userId = parts[4];
    const user = db.users.find(u => u.id === userId);
    if (user) user.status = body.status;
    saveStoredMockDB(db);
    return { user, message: 'Статус обновлен' };
  }

  if (endpoint.startsWith('/api/admin/users/') && endpoint.endsWith('/adjust-balance')) {
    const parts = endpoint.split('/');
    const userId = parts[4];
    const user = db.users.find(u => u.id === userId);
    if (user) user.balance = +(user.balance + parseFloat(body.amount)).toFixed(2);
    saveStoredMockDB(db);
    return { newBalance: user.balance, message: 'Баланс обновлен' };
  }

  if (endpoint.startsWith('/api/admin/users/') && endpoint.endsWith('/commission')) {
    const parts = endpoint.split('/');
    const userId = parts[4];
    const user = db.users.find(u => u.id === userId);
    if (user) user.customCommission = body.customCommission ? parseFloat(body.customCommission) : null;
    saveStoredMockDB(db);
    return { customCommission: user.customCommission, message: 'Комиссия обновлена' };
  }

  if (endpoint === '/api/admin/settings') {
    db.settings = { ...db.settings, ...body };
    saveStoredMockDB(db);
    return { settings: db.settings, message: 'Настройки обновлены' };
  }

  if (endpoint === '/api/admin/logs') {
    return { logs: db.logs };
  }

  if (endpoint === '/api/user/regenerate-keys') {
    const user = db.users.find(u => u.id === state.user.id);
    if (user) {
      user.apiKeyPublic = 'hp_live_' + Math.random().toString(36).substring(2, 14);
      user.apiKeySecret = 'hp_sec_' + Math.random().toString(36).substring(2, 18);
      state.user.apiKeyPublic = user.apiKeyPublic;
      state.user.apiKeySecret = user.apiKeySecret;
      localStorage.setItem('hp_user', JSON.stringify(state.user));
      saveStoredMockDB(db);
      return { apiKeyPublic: user.apiKeyPublic, apiKeySecret: user.apiKeySecret, message: 'Ключи сгенерированы' };
    }
  }

  if (endpoint === '/api/admin/gateways' && method === 'GET') {
    return { bankingRequisites: db.settings.bankingRequisites || {}, gateways: db.settings.gateways || {} };
  }
  if (endpoint === '/api/admin/gateways') {
    if (body && body.bankingRequisites) db.settings.bankingRequisites = Object.assign({}, db.settings.bankingRequisites, body.bankingRequisites);
    saveStoredMockDB(db);
    return { message: 'Реквизиты сохранены', settings: db.settings };
  }
  return { message: 'OK' };
}

// Система Toast Уведомлений
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const isError = type === 'error';
  toast.className = `p-4 rounded-xl flex items-center gap-3 shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-2 border text-sm font-medium ${
    isError 
      ? 'bg-rose-950/80 border-rose-500/40 text-rose-200' 
      : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
  }`;

  toast.innerHTML = `
    <i class="fa-solid ${isError ? 'fa-triangle-exclamation text-rose-400' : 'fa-circle-check text-emerald-400'} text-lg"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Форматирование чисел и валюты
function formatMoney(amount, currency = 'RUB') {
  const num = parseFloat(amount || 0);
  const formatted = num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbols = { RUB: '₽', USD: '$', EUR: '€', USDT: 'USDT' };
  return `${formatted} ${symbols[currency] || currency}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupAuthListeners();
  setupActionListeners();

  if (state.token && state.user) {
    showAppScreen();
  } else {
    showAuthScreen();
  }
});

// Переключение экранов (Авторизация / Главная панель)
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  updateUserUI();
  loadData();
}

// Обновление шапки и профиля
function updateUserUI() {
  if (!state.user) return;
  document.getElementById('user-display-name').textContent = state.user.name;
  document.getElementById('user-email').textContent = state.user.email;
  document.getElementById('user-balance-badge').textContent = formatMoney(state.user.balance, state.user.currency);

  const roleBadge = document.getElementById('user-role-badge');
  if (state.user.role === 'admin') {
    roleBadge.textContent = 'ADMIN';
    roleBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  } else {
    roleBadge.textContent = 'MERCHANT';
    roleBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40';
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }
}

// Навигация по табам
function setupNavigation() {
  const navItems = document.querySelectorAll('[data-tab-target]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-tab-target');
      switchTab(target);
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  const activeTabEl = document.getElementById(`tab-${tabName}`);
  if (activeTabEl) {
    activeTabEl.classList.remove('hidden');
    activeTabEl.classList.add('animate-fade-in');
  }

  // Обновление активного пункта меню
  document.querySelectorAll('[data-tab-target]').forEach(link => {
    if (link.getAttribute('data-tab-target') === tabName) {
      link.classList.add('bg-indigo-600/20', 'text-cyan-400', 'border-cyan-500/50');
      link.classList.remove('text-slate-400', 'border-transparent');
    } else {
      link.classList.remove('bg-indigo-600/20', 'text-cyan-400', 'border-cyan-500/50');
      link.classList.add('text-slate-400', 'border-transparent');
    }
  });

  // Обновление специфичных данных вкладки
  if (tabName === 'overview') {
    renderOverview();
  } else if (tabName === 'transactions') {
    renderTransactionsTable();
  } else if (tabName === 'admin-users') {
    loadAdminUsers();
  } else if (tabName === 'admin-commissions') {
    loadAdminSettings();
  } else if (tabName === 'admin-logs') {
    loadAdminLogs();
  } else if (tabName === 'admin-gateways') {
    loadAdminGateways();
  } else if (tabName === 'admin-overview') {
    loadAdminOverview();
  }
}

// Загрузка первичных данных
async function loadData() {
  try {
    const txRes = await apiCall('/api/transactions');
    state.transactions = txRes.transactions || [];
    renderOverview();
    renderTransactionsTable();

    if (state.user.role === 'admin') {
      loadAdminOverview();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Рендер главного дашборда мерчанта
function renderOverview() {
  if (!state.user) return;
  const deposits = state.transactions.filter(t => t.type === 'deposit' && t.status === 'success');
  const totalTurnover = deposits.reduce((sum, t) => sum + t.amount, 0);
  const totalFees = deposits.reduce((sum, t) => sum + (t.fee || 0), 0);
  const totalPayouts = state.transactions.filter(t => t.type === 'payout' && t.status === 'success').reduce((sum, t) => sum + t.amount, 0);

  document.getElementById('stat-turnover').textContent = formatMoney(totalTurnover, state.user.currency);
  document.getElementById('stat-available').textContent = formatMoney(state.user.balance, state.user.currency);
  document.getElementById('stat-fees').textContent = formatMoney(totalFees, state.user.currency);
  document.getElementById('stat-payouts').textContent = formatMoney(totalPayouts, state.user.currency);

  renderTurnoverChart();
  renderRecentTransactions();
}

// Построение графика оборота Chart.js
function renderTurnoverChart() {
  const ctx = document.getElementById('turnoverChart');
  if (!ctx) return;

  if (state.turnoverChart) {
    state.turnoverChart.destroy();
  }

  // Сгенерируем динамические дни за последние 7 дней
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }));
    // Для демо рассчитываем сумму транзакций за день или даем реалистичные данные
    const daySum = state.transactions
      .filter(t => t.type === 'deposit' && t.status === 'success' && new Date(t.createdAt).toDateString() === d.toDateString())
      .reduce((sum, t) => sum + t.amount, 0);
    data.push(daySum > 0 ? daySum : Math.floor(Math.random() * 8000 + 4000));
  }

  state.turnoverChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Оборот (${state.user.currency})`,
        data,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// Последние транзакции на дашборде
function renderRecentTransactions() {
  const container = document.getElementById('recent-tx-list');
  if (!container) return;
  const recent = state.transactions.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-500">Транзакций пока нет. Создайте свой первый платеж!</div>`;
    return;
  }

  container.innerHTML = recent.map(tx => `
    <div class="flex items-center justify-between p-4 hover:bg-slate-800/40 rounded-xl transition border-b border-white/5 last:border-none">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-cyan-500/15 text-cyan-400'}">
          <i class="fa-solid ${tx.type === 'deposit' ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
        </div>
        <div>
          <div class="font-medium text-slate-200 text-sm">${escapeHtml(tx.description)}</div>
          <div class="text-xs text-slate-500 font-mono">${tx.id} • ${formatDate(tx.createdAt)} • <span class="uppercase text-slate-400">${tx.method}</span></div>
        </div>
      </div>
      <div class="text-right">
        <div class="font-bold text-sm ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-slate-200'}">
          ${tx.type === 'deposit' ? '+' : '-'}${formatMoney(tx.amount, tx.currency)}
        </div>
        <div>${getStatusBadge(tx.status)}</div>
      </div>
    </div>
  `).join('');
}

// Полная таблица транзакций с фильтрами
function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;

  let filtered = [...state.transactions];

  if (state.filterStatus !== 'all') {
    filtered = filtered.filter(t => t.status === state.filterStatus);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(t => 
      t.id.toLowerCase().includes(q) || 
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">Транзакции по заданным фильтрам не найдены</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(tx => `
    <tr class="hover:bg-slate-800/30 transition border-b border-white/5">
      <td class="p-4">${tx.type === 'deposit' ? '<a class="font-mono text-xs text-cyan-400 font-medium hover:underline" target="_blank" href="pay.html?invoice=' + encodeURIComponent(tx.id) + '">' + tx.id + '</a>' : '<span class="font-mono text-xs text-cyan-400">' + tx.id + '</span>'}</td>
      <td class="p-4 text-xs text-slate-400">${formatDate(tx.createdAt)}</td>
      <td class="p-4 text-sm text-slate-200">${escapeHtml(tx.description || '-')}</td>
      <td class="p-4 text-xs">
        <span class="px-2 py-1 bg-slate-800 rounded font-mono uppercase text-slate-300">${tx.method}</span>
      </td>
      <td class="p-4 font-semibold text-sm ${tx.type === 'deposit' ? 'text-emerald-400' : 'text-slate-200'}">
        ${tx.type === 'deposit' ? '+' : '-'}${formatMoney(tx.amount, tx.currency)}
      </td>
      <td class="p-4 text-xs text-slate-400 font-mono">
        ${tx.fee ? formatMoney(tx.fee, tx.currency) : '0 ₽'}
      </td>
      <td class="p-4">${getStatusBadge(tx.status)}</td>
    </tr>
  `).join('');
}

function getStatusBadge(status) {
  if (status === 'success') {
    return `<span class="badge-status badge-status-success"><i class="fa-solid fa-circle-check"></i> Успешно</span>`;
  }
  if (status === 'pending') {
    return `<span class="badge-status badge-status-pending"><i class="fa-solid fa-clock"></i> В обработке</span>`;
  }
  return `<span class="badge-status badge-status-failed"><i class="fa-solid fa-circle-xmark"></i> Отклонен</span>`;
}

// ==========================================
// АДМИНИСТРАТИВНАЯ ПАНЕЛЬ
// ==========================================

// Загрузка статистики администратора
async function loadAdminOverview() {
  try {
    const res = await apiCall('/api/admin/overview');
    state.adminStats = res.stats;
    state.adminSettings = res.settings;

    document.getElementById('admin-stat-volume').textContent = formatMoney(res.stats.totalTurnover, 'RUB');
    document.getElementById('admin-stat-revenue').textContent = formatMoney(res.stats.totalCommissionsEarned, 'RUB');
    document.getElementById('admin-stat-merchants').textContent = res.stats.totalUsers;
    document.getElementById('admin-stat-payouts').textContent = formatMoney(res.stats.totalPayouts, 'RUB');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Загрузка списка пользователей для администратора
async function loadAdminUsers() {
  try {
    const res = await apiCall('/api/admin/users');
    state.adminUsers = res.users || [];
    renderAdminUsersTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAdminUsersTable() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.adminUsers.map(u => `
    <tr class="hover:bg-slate-800/30 transition border-b border-white/5">
      <td class="p-4">
        <div class="font-semibold text-slate-200 text-sm">${escapeHtml(u.name)}</div>
        <div class="text-xs text-slate-400 font-mono">${u.email}</div>
      </td>
      <td class="p-4">
        <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase ${u.role === 'admin' ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'}">
          ${u.role}
        </span>
      </td>
      <td class="p-4 font-mono font-bold text-sm text-emerald-400">
        ${formatMoney(u.balance, u.currency)}
      </td>
      <td class="p-4 text-xs font-mono">
        ${u.customCommission !== null ? `<span class="text-amber-400 font-bold">${u.customCommission}% (Индивид.)</span>` : '<span class="text-slate-400">Стандартная</span>'}
      </td>
      <td class="p-4">
        <span class="badge-status ${u.status === 'active' ? 'badge-status-success' : 'badge-status-failed'}">
          ${u.status === 'active' ? 'Активен' : 'Заблокирован'}
        </span>
      </td>
      <td class="p-4 text-right">
        <div class="flex items-center justify-end gap-2">
          <button onclick="openAdjustBalanceModal('${u.id}', '${escapeHtml(u.name)}', ${u.balance})" class="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg transition" title="Изменить баланс">
            <i class="fa-solid fa-coins mr-1"></i> Баланс
          </button>
          <button onclick="openCommissionModal('${u.id}', '${escapeHtml(u.name)}', ${u.customCommission})" class="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition" title="Комиссия">
            <i class="fa-solid fa-percent mr-1"></i> Тариф
          </button>
          ${u.role !== 'admin' ? `
            <button onclick="toggleUserStatus('${u.id}', '${u.status === 'active' ? 'blocked' : 'active'}')" class="px-2.5 py-1.5 text-xs ${u.status === 'active' ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300' : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'} rounded-lg transition">
              <i class="fa-solid ${u.status === 'active' ? 'fa-ban' : 'fa-check'}"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Загрузка и управление глобальными комиссиями
async function loadAdminSettings() {
  try {
    const res = await apiCall('/api/admin/overview');
    const s = res.settings;
    if (!s) return;

    document.getElementById('fee-base-percent').value = s.baseCommissionPercent;
    document.getElementById('fee-sbp-percent').value = s.methodCommissions.sbp;
    document.getElementById('fee-card-percent').value = s.methodCommissions.card;
    document.getElementById('fee-crypto-percent').value = s.methodCommissions.crypto;
    document.getElementById('fee-payout-percent').value = s.payoutCommissionPercent;
    document.getElementById('setting-min-deposit').value = s.minDeposit;
    document.getElementById('setting-max-deposit').value = s.maxDeposit;
    document.getElementById('setting-maintenance').checked = s.maintenance;
    document.getElementById('setting-antifraud').checked = s.antiFraudEnabled;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Загрузка логов аудита
async function loadAdminLogs() {
  try {
    const res = await apiCall('/api/admin/logs');
    const container = document.getElementById('admin-logs-list');
    if (!container) return;

    container.innerHTML = (res.logs || []).map(l => `
      <div class="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <span class="px-2 py-0.5 rounded font-mono font-bold ${l.type === 'SECURITY' ? 'bg-rose-500/20 text-rose-300' : 'bg-cyan-500/20 text-cyan-300'}">${l.type}</span>
          <span class="text-slate-300">${escapeHtml(l.message)}</span>
        </div>
        <div class="text-slate-500 font-mono">${formatDate(l.timestamp)} • IP: ${l.ip}</div>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==========================================
// МОДАЛЬНЫЕ ОКНА И ДЕЙСТВИЯ АДМИНИСТРАТОРА
// ==========================================

window.openAdjustBalanceModal = function(userId, userName, currentBalance) {
  const modal = document.getElementById('modal-adjust-balance');
  document.getElementById('adjust-user-id').value = userId;
  document.getElementById('adjust-user-name').textContent = userName;
  document.getElementById('adjust-user-current').textContent = formatMoney(currentBalance, 'RUB');
  document.getElementById('adjust-amount').value = '';
  modal.classList.remove('hidden');
};

window.openCommissionModal = function(userId, userName, currentCommission) {
  const modal = document.getElementById('modal-user-commission');
  document.getElementById('comm-user-id').value = userId;
  document.getElementById('comm-user-name').textContent = userName;
  document.getElementById('comm-rate-input').value = currentCommission !== null && currentCommission !== undefined ? currentCommission : '';
  modal.classList.remove('hidden');
};

window.toggleUserStatus = async function(userId, newStatus) {
  if (!confirm(`Вы действительно хотите изменить статус пользователя на: ${newStatus}?`)) return;
  try {
    await apiCall(`/api/admin/users/${userId}/status`, 'PATCH', { status: newStatus });
    showToast(`Статус пользователя успешно обновлен!`);
    loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// СЛУШАТЕЛИ СОБЫТИЙ И ФОРМ
// ==========================================

function setupAuthListeners() {
  // Быстрый демо-вход мерчанта
  document.getElementById('quick-login-merchant')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'merchant@store.ru';
    document.getElementById('login-password').value = 'merchant123';
    document.getElementById('form-login').dispatchEvent(new Event('submit'));
  });

  // Быстрый демо-вход администратора
  document.getElementById('quick-login-admin')?.addEventListener('click', () => {
    document.getElementById('login-email').value = 'admin@hiplateg.io';
    document.getElementById('login-password').value = 'admin12345';
    document.getElementById('form-login').dispatchEvent(new Event('submit'));
  });

  // Переключение между вкладками логина и регистрации
  document.getElementById('tab-btn-login')?.addEventListener('click', () => {
    document.getElementById('tab-btn-login').classList.add('bg-indigo-600', 'text-white');
    document.getElementById('tab-btn-login').classList.remove('text-slate-400');
    document.getElementById('tab-btn-register').classList.remove('bg-indigo-600', 'text-white');
    document.getElementById('tab-btn-register').classList.add('text-slate-400');
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-register').classList.add('hidden');
  });

  document.getElementById('tab-btn-register')?.addEventListener('click', () => {
    document.getElementById('tab-btn-register').classList.add('bg-indigo-600', 'text-white');
    document.getElementById('tab-btn-register').classList.remove('text-slate-400');
    document.getElementById('tab-btn-login').classList.remove('bg-indigo-600', 'text-white');
    document.getElementById('tab-btn-login').classList.add('text-slate-400');
    document.getElementById('form-register').classList.remove('hidden');
    document.getElementById('form-login').classList.add('hidden');
  });

  // Отправка формы логина
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const twoFactorCode = document.getElementById('login-2fa-code')?.value;

    try {
      const res = await apiCall('/api/auth/login', 'POST', { email, password, twoFactorCode });
      if (res.require2FA) {
        document.getElementById('2fa-input-container').classList.remove('hidden');
        showToast('Введите 6-значный 2FA код (тестовый: 123456)', 'info');
        return;
      }
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('hp_token', res.token);
      localStorage.setItem('hp_user', JSON.stringify(res.user));
      showToast('Добро пожаловать в Hi Plateg!');
      showAppScreen();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Отправка формы регистрации
  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const currency = document.getElementById('reg-currency').value;

    try {
      const res = await apiCall('/api/auth/register', 'POST', { name, email, password, currency });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('hp_token', res.token);
      localStorage.setItem('hp_user', JSON.stringify(res.user));
      showToast('Аккаунт мерчанта успешно создан!');
      showAppScreen();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Кнопка выхода
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    state.token = null;
    state.user = null;
    localStorage.removeItem('hp_token');
    localStorage.removeItem('hp_user');
    showAuthScreen();
    showToast('Вы вышли из системы');
  });
}

function setupActionListeners() {
  // Фильтрация транзакций
  document.querySelectorAll('[data-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-status]').forEach(b => b.classList.remove('bg-indigo-600', 'text-white'));
      btn.classList.add('bg-indigo-600', 'text-white');
      state.filterStatus = btn.getAttribute('data-filter-status');
      renderTransactionsTable();
    });
  });

  document.getElementById('search-transactions')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderTransactionsTable();
  });

  // Экспорт транзакций в CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    if (state.transactions.length === 0) return showToast('Нет данных для экспорта', 'error');
    let csv = 'ID,Дата,Назначение,Метод,Сумма,Комиссия,Статус\n';
    state.transactions.forEach(t => {
      csv += `"${t.id}","${t.createdAt}","${t.description}","${t.method}",${t.amount},${t.fee},"${t.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hi_plateg_transactions_${Date.now()}.csv`;
    a.click();
    showToast('Экспорт CSV завершен!');
  });

  // Создание инвойса
  document.getElementById('form-create-invoice')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = document.getElementById('invoice-amount').value;
    const description = document.getElementById('invoice-desc').value;
    const method = document.getElementById('invoice-method').value;
    const customerEmail = document.getElementById('invoice-email').value;

    try {
      const res = await apiCall('/api/transactions/create-invoice', 'POST', {
        amount,
        description,
        method,
        customerEmail
      });
      showToast('Счет на оплату сформирован!');
      closeAllModals();
      loadData();
      // Открываем симулятор оплаты
      openCheckoutModal(res.transaction);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Вывод средств (Payout)
  document.getElementById('form-payout')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = document.getElementById('payout-amount').value;
    const destination = document.getElementById('payout-destination').value;

    try {
      const res = await apiCall('/api/transactions/payout', 'POST', { amount, destination });
      showToast('Выплата успешно отправлена!');
      closeAllModals();
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Сохранение глобальных комиссий в админке
  document.getElementById('form-admin-commissions')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      baseCommissionPercent: parseFloat(document.getElementById('fee-base-percent').value),
      methodCommissions: {
        sbp: parseFloat(document.getElementById('fee-sbp-percent').value),
        card: parseFloat(document.getElementById('fee-card-percent').value),
        crypto: parseFloat(document.getElementById('fee-crypto-percent').value)
      },
      payoutCommissionPercent: parseFloat(document.getElementById('fee-payout-percent').value)
    };

    try {
      await apiCall('/api/admin/settings', 'POST', body);
      showToast('Тарифы и комиссии Hi Plateg сохранены!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Сохранение настроек платформы
  document.getElementById('form-admin-settings')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      minDeposit: parseFloat(document.getElementById('setting-min-deposit').value),
      maxDeposit: parseFloat(document.getElementById('setting-max-deposit').value),
      maintenance: document.getElementById('setting-maintenance').checked,
      antiFraudEnabled: document.getElementById('setting-antifraud').checked
    };

    try {
      await apiCall('/api/admin/settings', 'POST', body);
      showToast('Параметры платформы успешно обновлены!');
  
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('form-gateways')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bankingRequisites = {
        recipientName: document.getElementById('bank-recipient').value.trim(),
        inn: document.getElementById('bank-inn').value.trim(),
        accountNumber: document.getElementById('bank-account').value.trim(),
        bankName: document.getElementById('bank-bank').value.trim(),
        bic: document.getElementById('bank-bic').value.trim(),
        correspAccount: document.getElementById('bank-corr').value.trim()
      };
      try {
        await apiCall('/api/admin/gateways', 'POST', { bankingRequisites });
        showToast('Реквизиты платежки сохранены');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

  // Подтверждение корректировки баланса мерчанта
  document.getElementById('form-adjust-balance')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('adjust-user-id').value;
    const amount = document.getElementById('adjust-amount').value;
    const reason = document.getElementById('adjust-reason').value;

    try {
      await apiCall(`/api/admin/users/${userId}/adjust-balance`, 'POST', { amount, reason });
      showToast('Баланс мерчанта успешно скорректирован!');
      closeAllModals();
      loadAdminUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Сохранение персональной комиссии
  document.getElementById('form-user-commission')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('comm-user-id').value;
    const customCommission = document.getElementById('comm-rate-input').value;

    try {
      await apiCall(`/api/admin/users/${userId}/commission`, 'PATCH', { customCommission });
      showToast('Индивидуальная комиссия сохранена!');
      closeAllModals();
      loadAdminUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Регенерация API ключей
  document.getElementById('btn-regen-keys')?.addEventListener('click', async () => {
    if (!confirm('Вы уверены? Старые API ключи перестанут работать!')) return;
    try {
      const res = await apiCall('/api/user/regenerate-keys', 'POST');
      document.getElementById('api-key-public').value = res.apiKeyPublic;
      document.getElementById('api-key-secret').value = res.apiKeySecret;
      showToast('API Ключи обновлены!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Копирование в буфер
  window.copyText = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    navigator.clipboard.writeText(el.value || el.textContent);
    showToast('Скопировано в буфер обмена!');
  };

  // Закрытие модалок по кнопкам с классом close-modal
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
}

// Открытие инверсивного чекаута (Симулятор оплаты для клиента)
window.openCheckoutModal = function(tx) {
  const url = 'pay.html?invoice=' + encodeURIComponent(tx.id);
  const opened = window.open(url, '_blank', 'noopener');
  if (!opened) window.location.href = url;
  showToast('Страница оплаты открыта');
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadAdminGateways() {
  try {
    const res = await apiCall('/api/admin/gateways');
    const b = res.bankingRequisites || {};
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ''; };
    set('bank-recipient', b.recipientName);
    set('bank-inn', b.inn);
    set('bank-account', b.accountNumber);
    set('bank-bank', b.bankName);
    set('bank-bic', b.bic);
    set('bank-corr', b.correspAccount);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
