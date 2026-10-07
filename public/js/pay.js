(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const invoiceId = params.get('invoice') || params.get('id');
  const FALLBACK_BANK = {
    recipientName: 'ИП Платежные Решения',
    inn: '770123456789',
    accountNumber: '40802810900000012345',
    bankName: 'АО "ТБанк"',
    bic: '044525974',
    correspAccount: '30101810145620000974'
  };
  let payload = null;

  function money(amount, currency) {
    try {
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: currency || 'RUB' }).format(Number(amount) || 0);
    } catch (e) {
      return (Number(amount) || 0).toFixed(2) + ' ₽';
    }
  }

  function when(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function show(name) {
    ['loading', 'missing', 'pay', 'done'].forEach((view) => {
      const el = $('view-' + view);
      if (el) el.hidden = view !== name;
    });
  }

  function setStatus(text, isError) {
    const el = $('status');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', Boolean(isError));
  }

  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  function luhn(num) {
    let sum = 0;
    let alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = Number(num[i]);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function brandOf(num) {
    if (/^220[0-4]/.test(num)) return 'МИР';
    if (/^4/.test(num)) return 'Visa';
    if (/^5[1-5]/.test(num) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(num)) return 'Mastercard';
    return 'Карта';
  }

  function cleanPurpose(text) {
    return String(text || 'Оплата').replace(/[|\r\n]/g, ' ').slice(0, 210);
  }

  function gostString(bank, tx) {
    const sum = Math.round(Number(tx.amount) * 100);
    const fields = [
      'Name=' + bank.recipientName,
      'PersonalAcc=' + bank.accountNumber,
      'BankName=' + bank.bankName,
      'BIC=' + bank.bic,
      'CorrespAcc=' + bank.correspAccount,
      'PayeeINN=' + bank.inn,
      'Sum=' + sum,
      'Purpose=' + cleanPurpose(tx.description),
      'Contract=' + tx.id
    ];
    return 'ST00012|' + fields.join('|');
  }

  function tx() { return payload && payload.transaction; }
  function bank() { return (payload && payload.banking) || FALLBACK_BANK; }

  function requisitesText() {
    const b = bank();
    const t = tx();
    return [
      'Получатель: ' + b.recipientName,
      'ИНН: ' + b.inn,
      'Счёт: ' + b.accountNumber,
      'Банк: ' + b.bankName,
      'БИК: ' + b.bic,
      'К/с: ' + b.correspAccount,
      'Сумма: ' + money(t.amount, t.currency),
      'Назначение: ' + cleanPurpose(t.description) + ' ' + t.id
    ].join('\n');
  }

  function renderRequisites() {
    const b = bank();
    const t = tx();
    const rows = [
      ['Получатель', b.recipientName],
      ['ИНН', b.inn],
      ['Расчётный счёт', b.accountNumber],
      ['Банк', b.bankName],
      ['БИК', b.bic],
      ['Корр. счёт', b.correspAccount],
      ['Сумма', money(t.amount, t.currency)],
      ['Назначение', cleanPurpose(t.description) + ' ' + t.id]
    ];
    $('reqs').innerHTML = rows.map((row, i) => '<div class="' + (i > 5 ? 'wide' : '') + '"><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>').join('');
  }

  async function drawQr() {
    const canvas = $('qr');
    const value = payload.gostQrString || gostString(bank(), tx());
    if (window.QRCode) {
      await QRCode.toCanvas(canvas, value, { width: 168, margin: 0, color: { dark: '#1c1915', light: '#ffffff' } });
    }
  }

  function renderDone() {
    const t = tx();
    const methodName = t.paidMethod === 'card' ? (t.cardBrand || 'Карта') + (t.cardLast4 ? ' •• ' + t.cardLast4 : '') : (t.paidMethod === 'sbp' ? 'СБП / QR' : 'Реквизиты');
    $('done-lead').textContent = 'Магазин «' + (t.merchantName || 'Hi Plateg') + '» получил отметку об оплате.';
    $('receipt').innerHTML = [
      ['Квитанция', t.receiptId || t.id],
      ['Сумма', money(t.amount, t.currency)],
      ['Назначение', t.description || 'Оплата'],
      ['Способ', methodName],
      ['Время', when(t.paidAt)]
    ].map((row) => '<div><span>' + row[0] + '</span><strong>' + row[1] + '</strong></div>').join('');
    show('done');
  }

  function render() {
    const t = tx();
    if (!t) { show('missing'); return; }
    if (t.status === 'success') { renderDone(); return; }
    $('amount').textContent = money(t.amount, t.currency);
    $('purpose').textContent = t.description || 'Оплата заказа';
    $('merchant').textContent = t.merchantName || 'Магазин';
    $('invoice').textContent = t.id;
    $('email').textContent = t.customerEmail || 'не указан';
    $('pay-card').textContent = 'Оплатить ' + money(t.amount, t.currency);
    $('demo-req').hidden = bank().accountNumber !== FALLBACK_BANK.accountNumber;
    renderRequisites();
    show('pay');
    drawQr().catch(() => setStatus('Не удалось собрать QR. Реквизиты ниже можно перенести вручную.', true));
  }

  function loadOffline() {
    try {
      const db = JSON.parse(localStorage.getItem('hp_mock_db') || 'null');
      if (!db) return null;
      const found = (db.transactions || []).find((item) => item.id === invoiceId);
      if (!found) return null;
      const banking = (db.settings && db.settings.bankingRequisites) || FALLBACK_BANK;
      return { transaction: found, banking, gostQrString: gostString(banking, found), sandbox: true };
    } catch (e) {
      return null;
    }
  }

  function settleOffline(extra) {
    const db = JSON.parse(localStorage.getItem('hp_mock_db') || 'null');
    if (!db) throw new Error('Сервер недоступен, а локальный счёт не найден');
    const found = db.transactions.find((item) => item.id === invoiceId);
    if (!found) throw new Error('Счёт не найден');
    if (found.status === 'success') throw new Error('Этот счёт уже оплачен');
    found.status = 'success';
    found.paidAt = new Date().toISOString();
    found.paidMethod = extra.method;
    found.cardLast4 = extra.last4 || '';
    found.cardBrand = extra.brand || '';
    found.receiptId = 'hp_' + found.id.replace('tx_', '');
    const merchant = (db.users || []).find((user) => user.id === found.userId);
    if (merchant) merchant.balance = +(merchant.balance + found.netAmount).toFixed(2);
    localStorage.setItem('hp_mock_db', JSON.stringify(db));
    payload.transaction = found;
  }

  async function confirm(extra) {
    setStatus('Проверяем счёт…');
    try {
      const res = await fetch('/api/checkout/' + encodeURIComponent(invoiceId) + '/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extra)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Оплата не прошла');
      payload.transaction = data.transaction;
      renderDone();
      return;
    } catch (err) {
      if (!(err instanceof TypeError)) {
        setStatus(err.message, true);
        return;
      }
    }
    try {
      settleOffline(extra);
      renderDone();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function selectMethod(name) {
    ['sbp', 'card', 'bank'].forEach((method) => {
      $('tab-' + method).setAttribute('aria-pressed', method === name ? 'true' : 'false');
      $('panel-' + method).hidden = method !== name;
    });
  }

  function markField(id, bad) {
    $('field-' + id).classList.toggle('error', bad);
  }

  function bind() {
    $('tab-sbp').onclick = () => selectMethod('sbp');
    $('tab-card').onclick = () => selectMethod('card');
    $('tab-bank').onclick = () => selectMethod('bank');
    $('copy-purpose').onclick = () => navigator.clipboard.writeText(cleanPurpose(tx().description) + ' ' + tx().id).then(() => setStatus('Назначение скопировано'));
    $('copy-reqs').onclick = () => navigator.clipboard.writeText(requisitesText()).then(() => setStatus('Реквизиты скопированы'));
    $('print-slip').onclick = () => window.print();
    $('print-receipt').onclick = () => window.print();
    $('confirm-sbp').onclick = () => confirm({ method: 'sbp' });
    $('pan').addEventListener('input', (e) => {
      const raw = digits(e.target.value).slice(0, 16);
      e.target.value = raw.replace(/(.{4})/g, '$1 ').trim();
    });
    $('exp').addEventListener('input', (e) => {
      const raw = digits(e.target.value).slice(0, 4);
      e.target.value = raw.length > 2 ? raw.slice(0, 2) + ' / ' + raw.slice(2) : raw;
    });
    $('cvc').addEventListener('input', (e) => { e.target.value = digits(e.target.value).slice(0, 3); });
    $('card-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const pan = digits($('pan').value);
      const exp = digits($('exp').value);
      const cvc = digits($('cvc').value);
      const holder = $('holder').value.trim();
      const month = Number(exp.slice(0, 2));
      const year = 2000 + Number(exp.slice(2, 4) || '0');
      const now = new Date();
      const expired = exp.length !== 4 || month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
      markField('pan', pan.length < 16 || !luhn(pan));
      markField('exp', expired);
      markField('cvc', cvc.length !== 3);
      markField('holder', holder.length < 3);
      if (pan.length < 16 || !luhn(pan) || expired || cvc.length !== 3 || holder.length < 3) {
        $('card-error').textContent = 'Проверьте номер, срок и код карты.';
        return;
      }
      $('card-error').textContent = '';
      $('pay-card').disabled = true;
      confirm({ method: 'card', last4: pan.slice(-4), brand: brandOf(pan), holder }).finally(() => { $('pay-card').disabled = false; });
    });
  }

  async function start() {
    if (!invoiceId) {
      show('missing');
      return;
    }
    try {
      const res = await fetch('/api/checkout/' + encodeURIComponent(invoiceId) + '/payment-data');
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error((data && data.error) || 'not found');
      payload = data;
    } catch (err) {
      payload = loadOffline();
      if (!payload && err instanceof TypeError) {
        $('missing-text').textContent = 'Сервер оплаты не отвечает. Запустите node server.js и откройте счёт заново.';
      }
    }
    if (!payload) { show('missing'); return; }
    bind();
    const preferred = tx().method === 'card' ? 'card' : 'sbp';
    selectMethod(preferred);
    render();
  }

  start();
})();
