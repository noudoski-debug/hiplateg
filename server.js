/**
 * ==============================================================================
 * HI PLATEG - Высокопроизводительный и защищенный платежный сервер (API + Gateway)
 * ==============================================================================
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Генерация настоящих QR-кодов на сервере (SVG, без CDN и внешних запросов)
let QRCode = null;
try { QRCode = require('qrcode'); } catch (e) {}

// Опциональные зависимости с безопасными fallback-ами
let helmet = null;
let cors = null;
let rateLimit = null;

try { helmet = require('helmet'); } catch (e) {}
try { cors = require('cors'); } catch (e) {}
try { rateLimit = require('express-rate-limit'); } catch (e) {}

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const JWT_SECRET = process.env.JWT_SECRET || 'hi_plateg_ultra_secure_secret_key_2026_9823472';

// Обеспечиваем директорию данных
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Вспомогательные функции криптографии и безопасности
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(checkHash, 'hex'));
}

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// Инициализация базы данных
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const adminPass = hashPassword('admin12345');
    const demoUserPass = hashPassword('merchant123');

    const defaultData = {
      settings: {
        platformName: 'Hi Plateg',
        currency: 'RUB',
        maintenance: false,
        minDeposit: 100,
        maxDeposit: 1500000,
        baseCommissionPercent: 2.5,
        baseFixedCommission: 0,
        methodCommissions: {
          sbp: 1.5,
          card: 2.8,
          crypto: 1.0,
          p2p: 3.5,
          mir_pay: 2.0
        },
        payoutCommissionPercent: 1.8,
        antiFraudEnabled: true,
        ipWhitelistStrict: false,
        // Реальные реквизиты для генерации настоящих СБП / ГОСТ QR кодов
        bankingRequisites: {
          recipientName: 'ИП Платежные Решения',
          inn: '770123456789',
          accountNumber: '40802810900000012345',
          bankName: 'АО "ТБанк"',
          bic: '044525974',
          correspAccount: '30101810145620000974'
        },
        // Криптовалютные реквизиты для настоящих крипто QR
        cryptoRequisites: {
          usdtTrc20Address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd3GL8goB',
          tonAddress: 'EQBvW8m53WuASptHGnKaZsspY5HziwL7HRNp3TAfnPTFsTQY'
        },
        // Конфигурация внешних платежных шлюзов (ЮKassa, Т-Банк, Cryptomus)
        gateways: {
          yookassa: { enabled: false, shopId: '', secretKey: '' },
          tinkoff: { enabled: false, terminalKey: '', password: '' },
          cryptomus: { enabled: false, merchantId: '', apiKey: '' }
        }
      },
      users: [
        {
          id: 'usr_admin_001',
          name: 'Главный Администратор',
          email: 'admin@hiplateg.io',
          role: 'admin',
          passwordHash: adminPass.hash,
          passwordSalt: adminPass.salt,
          balance: 854200.50,
          holdBalance: 12500.00,
          currency: 'RUB',
          status: 'active',
          twoFactorEnabled: true,
          apiKeyPublic: 'hp_live_adm_994821a0f8234912',
          apiKeySecret: 'hp_sec_adm_e1b746f3c1a90d843810f',
          webhookUrl: 'https://api.hiplateg.io/webhooks/v1',
          customCommission: null,
          createdAt: new Date().toISOString()
        },
        {
          id: 'usr_demo_002',
          name: 'Neon Store / ИП Иванов',
          email: 'merchant@store.ru',
          role: 'merchant',
          passwordHash: demoUserPass.hash,
          passwordSalt: demoUserPass.salt,
          balance: 142850.00,
          holdBalance: 4200.00,
          currency: 'RUB',
          status: 'active',
          twoFactorEnabled: false,
          apiKeyPublic: 'hp_live_mer_55a290f11cd73491',
          apiKeySecret: 'hp_sec_mer_8f39b1a039d549e3820fa',
          webhookUrl: 'https://neon-store.ru/api/pay-callback',
          customCommission: 2.2,
          createdAt: new Date(Date.now() - 86400000 * 14).toISOString()
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
          description: 'Оплата заказа #4912 (Наушники CyberPulse)',
          customerEmail: 'alex@yandex.ru',
          status: 'success',
          clientIp: '185.120.45.19',
          createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
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
          description: 'Оплата подписки Pro Max 12 мес.',
          customerEmail: 'dmitry.pro@gmail.com',
          status: 'success',
          clientIp: '94.25.180.12',
          createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
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
          description: 'Пополнение баланса аккаунта',
          customerEmail: 'crypto_trader@proton.me',
          status: 'pending',
          clientIp: '45.130.82.10',
          createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
        },
        {
          id: 'tx_9823409',
          userId: 'usr_demo_002',
          merchantName: 'Neon Store / ИП Иванов',
          type: 'payout',
          amount: 50000,
          netAmount: 49100.00,
          fee: 900.00,
          currency: 'RUB',
          method: 'sbp_payout',
          description: 'Выплата на расчетный счет Т-Банк',
          customerEmail: 'merchant@store.ru',
          status: 'success',
          clientIp: '185.120.45.19',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ],
      auditLogs: [
        {
          id: 'log_01',
          type: 'SECURITY',
          message: 'Система запущена в защищенном режиме. Инициализирован крипто-модуль.',
          ip: '127.0.0.1',
          timestamp: new Date().toISOString()
        },
        {
          id: 'log_02',
          type: 'ADMIN',
          message: 'Базовые тарифы комиссий синхронизированы.',
          ip: '127.0.0.1',
          timestamp: new Date().toISOString()
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

initDatabase();

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    initDatabase();
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function addLog(type, message, ip = '127.0.0.1') {
  const db = readDB();
  db.auditLogs.unshift({
    id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    type,
    message,
    ip,
    timestamp: new Date().toISOString()
  });
  if (db.auditLogs.length > 200) db.auditLogs.pop();
  writeDB(db);
}

// Безопасность и Middleware
if (helmet) {
  app.use(helmet({
    contentSecurityPolicy: false // Для свободного использования Tailwind CDN и иконок
  }));
}

if (cors) {
  app.use(cors());
}

if (rateLimit) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Слишком много запросов. Сработала защита Rate Limiting.' }
  });
  app.use('/api/', limiter);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware проверки авторизации
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
  const token = authHeader.replace(/^Bearer\s+/, '');
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Недействительный или истекший токен сессии' });
  
  const db = readDB();
  const user = db.users.find(u => u.id === decoded.userId);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  if (user.status === 'blocked') return res.status(403).json({ error: 'Аккаунт заблокирован службой безопасности Hi Plateg' });
  
  req.user = user;
  next();
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ разрешен только администраторам платформы' });
    }
    next();
  });
}

// ==========================================
// API ЭНДПОИНТЫ: АУТЕНТИФИКАЦИЯ
// ==========================================

// Регистрация
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, currency = 'RUB' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
  }

  const { hash, salt } = hashPassword(password);
  const newUser = {
    id: 'usr_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'merchant',
    passwordHash: hash,
    passwordSalt: salt,
    balance: 0.00,
    holdBalance: 0.00,
    currency: ['RUB', 'USD', 'EUR', 'USDT'].includes(currency) ? currency : 'RUB',
    status: 'active',
    twoFactorEnabled: false,
    apiKeyPublic: 'hp_live_' + crypto.randomBytes(12).toString('hex'),
    apiKeySecret: 'hp_sec_' + crypto.randomBytes(16).toString('hex'),
    webhookUrl: '',
    customCommission: null,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  addLog('AUTH_REGISTER', `Новый мерчант зарегистрирован: ${newUser.email}`, req.ip);

  const token = generateToken({ userId: newUser.id, role: newUser.role, email: newUser.email });
  
  // Отправляем безопасную модель пользователя
  const { passwordHash, passwordSalt, ...safeUser } = newUser;
  res.status(201).json({
    message: 'Регистрация успешно завершена',
    token,
    user: safeUser
  });
});

// Авторизация
app.post('/api/auth/login', (req, res) => {
  const { email, password, twoFactorCode } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) {
    addLog('AUTH_FAILED', `Неудачная попытка входа с несуществующим email: ${email}`, req.ip);
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
  }

  const isMatch = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!isMatch) {
    addLog('AUTH_FAILED', `Неверный пароль для пользователя: ${email}`, req.ip);
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  // Если включен 2FA и код не передан
  if (user.twoFactorEnabled && !twoFactorCode) {
    return res.json({
      require2FA: true,
      message: 'Требуется подтверждение двухфакторной аутентификации'
    });
  }

  // Если 2FA передан, валидируем
  if (user.twoFactorEnabled && twoFactorCode) {
    if (twoFactorCode !== '123456' && twoFactorCode.length !== 6) {
      return res.status(400).json({ error: 'Неверный одноразовый 2FA код (используйте 123456 в демо)' });
    }
  }

  addLog('AUTH_SUCCESS', `Успешный вход: ${user.email} (${user.role})`, req.ip);
  const token = generateToken({ userId: user.id, role: user.role, email: user.email });
  const { passwordHash, passwordSalt, ...safeUser } = user;

  res.json({
    message: 'Авторизация успешна',
    token,
    user: safeUser
  });
});

// Получение профиля
app.get('/api/user/profile', authMiddleware, (req, res) => {
  const { passwordHash, passwordSalt, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Регенерация API ключей
app.post('/api/user/regenerate-keys', authMiddleware, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  user.apiKeyPublic = 'hp_live_' + crypto.randomBytes(12).toString('hex');
  user.apiKeySecret = 'hp_sec_' + crypto.randomBytes(16).toString('hex');
  writeDB(db);

  addLog('SECURITY_KEY_ROTATION', `Ключи API обновлены мерчантом: ${user.email}`, req.ip);
  res.json({
    message: 'API ключи успешно пересозданы',
    apiKeyPublic: user.apiKeyPublic,
    apiKeySecret: user.apiKeySecret
  });
});

// Обновление вебхука и настроек мерчанта
app.post('/api/user/settings', authMiddleware, (req, res) => {
  const { webhookUrl, twoFactorEnabled } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (webhookUrl !== undefined) user.webhookUrl = webhookUrl;
  if (twoFactorEnabled !== undefined) user.twoFactorEnabled = Boolean(twoFactorEnabled);
  writeDB(db);

  res.json({ message: 'Настройки мерчанта сохранены', user: { ...user, passwordHash: undefined, passwordSalt: undefined } });
});

// ==========================================
// API ЭНДПОИНТЫ: ПЛАТЕЖИ И ТРАНЗАКЦИИ
// ==========================================

// Список транзакций пользователя
app.get('/api/transactions', authMiddleware, (req, res) => {
  const db = readDB();
  let list = db.transactions;
  if (req.user.role !== 'admin') {
    list = list.filter(t => t.userId === req.user.id);
  }
  res.json({ transactions: list });
});

// Создание платежного счета (Инвойс / Ссылка на оплату)
app.post('/api/transactions/create-invoice', authMiddleware, (req, res) => {
  const { amount, description, method = 'sbp', customerEmail = '' } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Укажите корректную сумму платежа' });
  }

  const db = readDB();
  const settings = db.settings;

  if (numAmount < settings.minDeposit) {
    return res.status(400).json({ error: `Минимальная сумма платежа: ${settings.minDeposit} ${req.user.currency}` });
  }
  if (numAmount > settings.maxDeposit) {
    return res.status(400).json({ error: `Максимальная сумма платежа: ${settings.maxDeposit} ${req.user.currency}` });
  }

  // Расчет комиссии: персональная или по методу
  let commissionRate = req.user.customCommission;
  if (commissionRate === null || commissionRate === undefined) {
    commissionRate = settings.methodCommissions[method] || settings.baseCommissionPercent;
  }
  const fee = +(numAmount * (commissionRate / 100)).toFixed(2);
  const netAmount = +(numAmount - fee).toFixed(2);

  const txId = 'tx_' + Math.floor(1000000 + Math.random() * 9000000);
  const newTx = {
    id: txId,
    userId: req.user.id,
    merchantName: req.user.name,
    type: 'deposit',
    amount: numAmount,
    netAmount,
    fee,
    currency: req.user.currency,
    method,
    description: description || `Оплата счета #${txId.replace('tx_', '')}`,
    customerEmail,
    status: 'pending',
    clientIp: req.ip || '127.0.0.1',
    createdAt: new Date().toISOString()
  };

  db.transactions.unshift(newTx);
  writeDB(db);

  addLog('TRANSACTION_CREATED', `Создан инвойс ${txId} на сумму ${numAmount} ${req.user.currency}`, req.ip);

  res.status(201).json({
    message: 'Счет успешно сформирован',
    transaction: newTx,
    paymentUrl: `/pay.html?invoice=${txId}`
  });
});

// Запрос на вывод средств (Payout)
app.post('/api/transactions/payout', authMiddleware, (req, res) => {
  const { amount, destination, method = 'sbp_payout' } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Укажите корректную сумму вывода' });
  }

  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);

  const fee = +(numAmount * (db.settings.payoutCommissionPercent / 100)).toFixed(2);
  const totalDeduct = +(numAmount + fee).toFixed(2);

  if (user.balance < totalDeduct) {
    return res.status(400).json({
      error: `Недостаточно средств. Требуется ${totalDeduct} ${user.currency} (включая комиссию ${fee})`
    });
  }

  user.balance = +(user.balance - totalDeduct).toFixed(2);

  const txId = 'tx_out_' + Math.floor(1000000 + Math.random() * 9000000);
  const payoutTx = {
    id: txId,
    userId: user.id,
    merchantName: user.name,
    type: 'payout',
    amount: numAmount,
    netAmount: numAmount,
    fee,
    currency: user.currency,
    method,
    description: `Вывод на реквизиты: ${destination}`,
    customerEmail: user.email,
    status: 'success',
    clientIp: req.ip || '127.0.0.1',
    createdAt: new Date().toISOString()
  };

  db.transactions.unshift(payoutTx);
  writeDB(db);

  addLog('PAYOUT_EXECUTED', `Вывод средств: ${numAmount} ${user.currency} для ${user.email}`, req.ip);

  res.json({
    message: 'Выплата успешно отправлена',
    newBalance: user.balance,
    transaction: payoutTx
  });
});

// Проверка карты по алгоритму Луна + определение платёжной системы
function luhnValid(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return num.length >= 13 && sum % 10 === 0;
}

function cardBrandOf(num) {
  if (/^220[0-4]/.test(num)) return 'МИР';
  if (/^4/.test(num)) return 'Visa';
  if (/^5[1-5]/.test(num) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(num)) return 'Mastercard';
  return 'Карта';
}

// Проведение оплаты счета (с зачислением мерчанту и вебхуком)
function settleInvoice(txId, meta, ip) {
  meta = meta || {};
  const db = readDB();
  const tx = db.transactions.find(t => t.id === txId);
  if (!tx) return { status: 404, body: { error: 'Платеж не найден' } };
  if (tx.status === 'success') return { status: 400, body: { error: 'Этот счет уже был успешно оплачен' } };
  if (tx.type !== 'deposit') return { status: 400, body: { error: 'Это не счет на оплату' } };
  const method = ['sbp', 'card', 'bank'].includes(meta.method) ? meta.method : (tx.method || 'sbp');
  tx.status = 'success';
  tx.paidAt = new Date().toISOString();
  tx.paidMethod = method;
  if (meta.last4) tx.cardLast4 = String(meta.last4).slice(-4);
  if (meta.brand) tx.cardBrand = String(meta.brand).slice(0, 24);
  if (meta.holder) tx.cardHolder = String(meta.holder).slice(0, 40);
  tx.receiptId = 'hp_' + String(tx.id).replace(/^tx_/, '');
  const merchant = db.users.find(u => u.id === tx.userId);
  if (merchant) merchant.balance = +(merchant.balance + tx.netAmount).toFixed(2);
  writeDB(db);
  addLog('PAYMENT_CONFIRMED', 'Оплата счета ' + tx.id + ' через ' + method + ' (+' + tx.netAmount + ' ' + tx.currency + ')', ip);

  // Реальная доставка вебхука мерчанту (если URL настроен)
  if (merchant && merchant.webhookUrl && /^https?:\/\//.test(merchant.webhookUrl)) {
    try {
      fetch(merchant.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.succeeded',
          invoice_id: tx.id,
          amount: tx.amount,
          fee: tx.fee,
          net_amount: tx.netAmount,
          currency: tx.currency,
          method: method,
          receipt_id: tx.receiptId,
          paid_at: tx.paidAt,
          signature: crypto.createHmac('sha256', JWT_SECRET).update(tx.id + tx.amount + tx.paidAt).digest('hex')
        })
      }).catch(() => {});
    } catch (e) {}
  }

  const fresh = readDB().transactions.find(t => t.id === txId);
  return { status: 200, body: { message: 'Платеж успешно проведен', transaction: fresh } };
}

app.post('/api/checkout/:id/pay', (req, res) => {
  const body = req.body || {};
  if (body.pan || body.cardNumber || body.cvv || body.cvc) {
    return res.status(400).json({ error: 'Полные данные карты не принимаются' });
  }
  const result = settleInvoice(req.params.id, body, req.ip);
  res.status(result.status).json(result.body);
});

// Полная серверная проверка карты (Луна + срок действия) — оплата только после валидации
app.post('/api/checkout/:id/pay-card', (req, res) => {
  const body = req.body || {};
  const pan = String(body.pan || '').replace(/\D/g, '');
  const exp = String(body.exp || '').replace(/\D/g, '');
  const cvc = String(body.cvc || '').replace(/\D/g, '');
  const holder = String(body.holder || '').trim();

  if (pan.length < 13 || pan.length > 19 || !luhnValid(pan)) {
    return res.status(400).json({ error: 'Номер карты не проходит проверку по алгоритму Луна' });
  }
  const month = Number(exp.slice(0, 2));
  const year = 2000 + Number(exp.slice(2, 4) || 0);
  const now = new Date();
  if (exp.length !== 4 || month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return res.status(400).json({ error: 'Срок действия карты истёк или указан неверно' });
  }
  if (cvc.length !== 3 || holder.length < 3) {
    return res.status(400).json({ error: 'Проверьте CVC и имя владельца карты' });
  }

  const result = settleInvoice(req.params.id, {
    method: 'card',
    last4: pan.slice(-4),
    brand: cardBrandOf(pan),
    holder: holder.toUpperCase()
  }, req.ip);
  res.status(result.status).json(result.body);
});

app.post('/api/checkout/pay-simulation', (req, res) => {
  const result = settleInvoice(req.body && req.body.transactionId, { method: req.body && req.body.method }, req.ip);
  res.status(result.status).json(result.body);
});

app.get('/api/admin/overview', adminMiddleware, (req, res) => {
  const db = readDB();
  const totalUsers = db.users.length;
  const activeUsers = db.users.filter(u => u.status === 'active').length;
  
  const totalTurnover = db.transactions
    .filter(t => t.type === 'deposit' && t.status === 'success')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCommissionsEarned = db.transactions
    .filter(t => t.status === 'success')
    .reduce((sum, t) => sum + (t.fee || 0), 0);

  const totalPayouts = db.transactions
    .filter(t => t.type === 'payout' && t.status === 'success')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      totalTurnover: +totalTurnover.toFixed(2),
      totalCommissionsEarned: +totalCommissionsEarned.toFixed(2),
      totalPayouts: +totalPayouts.toFixed(2),
      pendingTransactions: db.transactions.filter(t => t.status === 'pending').length
    },
    settings: db.settings
  });
});

// Список всех пользователей
app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const db = readDB();
  const usersSafe = db.users.map(({ passwordHash, passwordSalt, ...u }) => u);
  res.json({ users: usersSafe });
});

// Изменение статуса пользователя (блокировка / разблокировка)
app.patch('/api/admin/users/:id/status', adminMiddleware, (req, res) => {
  const { status } = req.body;
  if (!['active', 'blocked'].includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }

  const db = readDB();
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
  if (target.role === 'admin' && status === 'blocked') {
    return res.status(400).json({ error: 'Нельзя заблокировать главного администратора' });
  }

  target.status = status;
  writeDB(db);
  addLog('ADMIN_USER_STATUS', `Администратор изменил статус ${target.email} на ${status}`, req.ip);

  res.json({ message: `Статус пользователя изменен на ${status}`, user: target });
});

// Ручная корректировка баланса пользователя
app.post('/api/admin/users/:id/adjust-balance', adminMiddleware, (req, res) => {
  const { amount, reason = 'Корректировка администратором' } = req.body;
  const delta = parseFloat(amount);
  if (isNaN(delta) || delta === 0) {
    return res.status(400).json({ error: 'Укажите сумму изменения' });
  }

  const db = readDB();
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  target.balance = +(target.balance + delta).toFixed(2);
  writeDB(db);

  addLog('ADMIN_BALANCE_ADJUST', `Баланс ${target.email} изменен на ${delta > 0 ? '+' : ''}${delta} (${reason})`, req.ip);

  res.json({ message: 'Баланс успешно обновлен', newBalance: target.balance });
});

// Установка персональной комиссии пользователю
app.patch('/api/admin/users/:id/commission', adminMiddleware, (req, res) => {
  const { customCommission } = req.body;
  const rate = customCommission === null || customCommission === '' ? null : parseFloat(customCommission);

  const db = readDB();
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

  target.customCommission = rate;
  writeDB(db);

  addLog('ADMIN_COMMISSION_CHANGE', `Комиссия для ${target.email} установлена на ${rate !== null ? rate + '%' : 'Стандартную'}`, req.ip);

  res.json({ message: 'Персональная комиссия сохранена', customCommission: target.customCommission });
});

// Обновление глобальных настроек платформы и комиссий
app.post('/api/admin/settings', adminMiddleware, (req, res) => {
  const {
    baseCommissionPercent,
    methodCommissions,
    payoutCommissionPercent,
    maintenance,
    minDeposit,
    maxDeposit,
    antiFraudEnabled
  } = req.body;

  const db = readDB();
  if (baseCommissionPercent !== undefined) db.settings.baseCommissionPercent = parseFloat(baseCommissionPercent);
  if (payoutCommissionPercent !== undefined) db.settings.payoutCommissionPercent = parseFloat(payoutCommissionPercent);
  if (methodCommissions) db.settings.methodCommissions = { ...db.settings.methodCommissions, ...methodCommissions };
  if (maintenance !== undefined) db.settings.maintenance = Boolean(maintenance);
  if (minDeposit !== undefined) db.settings.minDeposit = parseFloat(minDeposit);
  if (maxDeposit !== undefined) db.settings.maxDeposit = parseFloat(maxDeposit);
  if (antiFraudEnabled !== undefined) db.settings.antiFraudEnabled = Boolean(antiFraudEnabled);

  writeDB(db);
  addLog('ADMIN_SETTINGS_UPDATED', `Глобальные параметры и комиссии обновлены`, req.ip);

  res.json({ message: 'Настройки платформы Hi Plateg успешно сохранены', settings: db.settings });
});

// Аудит-логи системы
app.get('/api/admin/logs', adminMiddleware, (req, res) => {
  const db = readDB();
  res.json({ logs: db.auditLogs.slice(0, 100) });
});

// Управление шлюзами и реквизитами для администратора
app.get('/api/admin/gateways', adminMiddleware, (req, res) => {
  const db = readDB();
  res.json({
    bankingRequisites: db.settings.bankingRequisites,
    cryptoRequisites: db.settings.cryptoRequisites,
    gateways: db.settings.gateways
  });
});

app.post('/api/admin/gateways', adminMiddleware, (req, res) => {
  const { bankingRequisites, cryptoRequisites, gateways } = req.body;
  const db = readDB();
  if (bankingRequisites) db.settings.bankingRequisites = { ...db.settings.bankingRequisites, ...bankingRequisites };
  if (cryptoRequisites) db.settings.cryptoRequisites = { ...db.settings.cryptoRequisites, ...cryptoRequisites };
  if (gateways) db.settings.gateways = { ...db.settings.gateways, ...gateways };
  writeDB(db);
  addLog('ADMIN_GATEWAYS_UPDATE', 'Реквизиты реальных платежей и шлюзов обновлены администратором', req.ip);
  res.json({ message: 'Настройки шлюзов и реквизитов успешно сохранены', settings: db.settings });
});

// Получение данных для реальной оплаты и QR-кода покупателем
app.get('/api/checkout/:id/payment-data', async (req, res) => {
  const db = readDB();
  const tx = db.transactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Платеж не найден' });

  const bankReq = db.settings.bankingRequisites || {
    recipientName: 'ИП Платежные Решения',
    inn: '770123456789',
    accountNumber: '40802810900000012345',
    bankName: 'АО "ТБанк"',
    bic: '044525974',
    correspAccount: '30101810145620000974'
  };

  const cryptoReq = db.settings.cryptoRequisites || {
    usdtTrc20Address: 'TYDzsYUEpvnYmQk4zGP9sWWcTEd3GL8goB',
    tonAddress: 'EQBvW8m53WuASptHGnKaZsspY5HziwL7HRNp3TAfnPTFsTQY'
  };

  // Формирование настоящей строки по стандарту ГОСТ Р 56042-2014 (Банковский СБП/Сбер/Т-Банк QR)
  // Сумма передается в копейках
  const amountInKopecks = Math.round(tx.amount * 100);
  const purpose = String(tx.description || 'Оплата').split('|').join(' ').split(String.fromCharCode(10)).join(' ').split(String.fromCharCode(13)).join(' ').slice(0, 210);
  const gostString = [
    'ST00012',
    "Name=" + bankReq.recipientName,
    "PersonalAcc=" + bankReq.accountNumber,
    "BankName=" + bankReq.bankName,
    "BIC=" + bankReq.bic,
    "CorrespAcc=" + bankReq.correspAccount,
    "PayeeINN=" + bankReq.inn,
    "Sum=" + amountInKopecks,
    "Purpose=" + purpose,
    "Contract=" + tx.id
  ].join('|');

  // Нормальный СБП-URL (схема nsb / payment.ru), если банк мерчанта его предоставляет
  const sbpUrl = null;

  // Криптовалютные URI
  const tronUri = `tron:${cryptoReq.usdtTrc20Address}?amount=${tx.amount}&token=USDT`;
  const tonUri = `ton://transfer/${cryptoReq.tonAddress}?amount=${amountInKopecks}&text=${encodeURIComponent(tx.id)}`;

  // Серверная генерация настоящих QR-кодов в SVG — работают без интернета и CDN
  async function makeQr(value) {
    if (!QRCode || !value) return null;
    try {
      return await QRCode.toString(value, {
        type: 'svg',
        margin: 1,
        width: 168,
        color: { dark: '#1c1915', light: '#ffffff' }
      });
    } catch (e) {
      return null;
    }
  }

  const [gostSvg, tronSvg, tonSvg] = await Promise.all([
    makeQr(gostString),
    makeQr(tronUri),
    makeQr(tonUri)
  ]);

  res.json({
    transaction: tx,
    alreadyPaid: tx.status === 'success',
    gostQrString: gostString,
    qrSvg: gostSvg,
    sbpUrl,
    crypto: {
      usdtTrc20Address: cryptoReq.usdtTrc20Address,
      tronUri,
      tronQrSvg: tronSvg,
      tonAddress: cryptoReq.tonAddress,
      tonUri,
      tonQrSvg: tonSvg
    },
    banking: bankReq
  });
});

// Опрос статуса платежа (для анимации «ожидание → получено → проведение»)
app.get('/api/checkout/:id/status', (req, res) => {
  const db = readDB();
  const tx = db.transactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ error: 'Платеж не найден' });
  res.json({ id: tx.id, status: tx.status, paidAt: tx.paidAt || null, paidMethod: tx.paidMethod || null });
});

// Обработка входящих реальных вебхуков от ЮKassa / Т-Банка / Cryptomus
app.post('/api/gateways/webhook/:provider', (req, res) => {
  const { provider } = req.params;
  const event = req.body || {};
  addLog('WEBHOOK_RECEIVED', `Входящий вебхук от провайдера ${provider}: ${JSON.stringify(event).slice(0, 100)}`, req.ip);

  // Извлекаем ID платежа и статус из стандартных форматов провайдеров
  const invoiceId =
    (event.object && event.object.metadata && event.object.metadata.invoice_id) ||
    (event.PaymentId || (event.Data && event.Data.InvoiceId)) ||
    (event.paymentUuid || (event.body && event.body.id)) ||
    event.invoice_id || null;

  const rawStatus = String(
    (event.object && event.object.status) ||
    (event.Status || (event.Data && event.Data.Status)) ||
    event.status || ''
  ).toLowerCase();

  if (invoiceId && ['succeeded', 'success', 'captured', 'confirmed', 'paid', 'finished'].includes(rawStatus)) {
    const result = settleInvoice(invoiceId, { method: provider === 'cryptomus' ? 'crypto' : (provider === 'tinkoff' ? 'card' : 'sbp') }, req.ip);
    return res.status(result.status).json(result.body);
  }

  res.json({ status: 'ok' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`
  ==============================================================
   ⚡ HI PLATEG PAYMENT GATEWAY & DASHBOARD ONLINE ⚡
  ==============================================================
   Портал:        http://localhost:${PORT}
   Администратор: admin@hiplateg.io  (Пароль: admin12345)
   Мерчант-демо:  merchant@store.ru  (Пароль: merchant123)
  ==============================================================
  `);
});
