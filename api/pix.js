const SHARPIFY_BASE_URL = (process.env.SHARPIFY_API_URL || 'https://sharpify-pay.com').replace(/\/$/, '');
const SHARPIFY_CREATE_PATH = process.env.SHARPIFY_CREATE_PATH || '/api/v1/gateway/payment/create-paymnet';
const SHARPIFY_GET_PATH = process.env.SHARPIFY_GET_PATH || '/api/v1/gateway/payment/get-payment';
const BLACKCAT_API_URL = process.env.BLACKCAT_API_URL || 'https://api.blackcatoficial.com/api/sales/create-sale';

function gateway() {
  return String(process.env.PAYMENT_GATEWAY || 'blackcat').toLowerCase() === 'sharpify' ? 'sharpify' : 'blackcat';
}

function parseBody(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function findValue(obj, keys, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  for (const value of Object.values(obj)) {
    const found = findValue(value, keys, depth + 1);
    if (found !== null && found !== undefined && found !== '') return found;
  }
  return null;
}

function normalizeSharpify(data, amount) {
  const paymentLinkId = findValue(data, ['paymentLinkId', 'payment_link_id', 'paymentId', 'payment_id']);
  const copyPaste = findValue(data, ['copyPaste', 'copy_paste', 'pixCopyPaste', 'pixCode', 'qrCode']);
  const paymentUrl = findValue(data, ['paymentUrl', 'paymentURL', 'payment_url', 'checkoutUrl', 'checkoutURL', 'checkout_url', 'url', 'link']);
  const qrCodeBase64 = findValue(data, ['qrCodeBase64', 'qr_code_base64', 'qrCodeImage', 'qr_code_image']);
  const qrContent = copyPaste || paymentUrl || '';
  return {
    paymentData: {
      copyPaste: typeof copyPaste === 'string' ? copyPaste : '',
      qrCodeBase64: typeof qrCodeBase64 === 'string' ? qrCodeBase64 : null,
      qrCode: qrContent,
      paymentUrl: typeof paymentUrl === 'string' ? paymentUrl : null,
      isPaymentLink: !copyPaste && !!paymentUrl
    },
    paymentLinkId: paymentLinkId ? String(paymentLinkId) : null,
    transactionId: paymentLinkId ? String(paymentLinkId) : null,
    status: String(findValue(data, ['status', 'paymentStatus', 'payment_status']) || 'PENDING').toUpperCase(),
    amount: Number(findValue(data, ['amount', 'value', 'total']) || amount * 100),
    amountDisplay: amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  };
}

async function sharpifyRequest(path, options = {}) {
  const url = `${SHARPIFY_BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'x-sharpify-client-id': process.env.SHARPIFY_CLIENT_ID || '',
        'x-sharpify-client-secret': process.env.SHARPIFY_CLIENT_SECRET || '',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new Error(`Não foi possível conectar à Sharpify: ${error.message}`);
  }

  const text = await response.text();
  const data = parseBody(text);
  if (!response.ok) {
    const candidates = [data?.message, data?.error, data?.detail, data?.errors, data?.data?.message, data?.data?.error];
    const first = candidates.find((value) => value !== undefined && value !== null && value !== '');
    let message;
    if (typeof first === 'string') {
      message = first;
    } else if (first !== undefined) {
      try { message = JSON.stringify(first); } catch { message = String(first); }
    } else {
      message = text ? text.slice(0, 500) : `HTTP ${response.status}`;
    }
    throw new Error(`Sharpify HTTP ${response.status}: ${message}`);
  }
  if (text && !data) {
    throw new Error(`A Sharpify respondeu algo que não é JSON (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
  return data;
}

async function createSharpify(amount, productName) {
  if (!process.env.SHARPIFY_CLIENT_ID || !process.env.SHARPIFY_CLIENT_SECRET) {
    throw new Error('SHARPIFY_CLIENT_ID e SHARPIFY_CLIENT_SECRET não estão configurados na Vercel.');
  }
  // Sem webhook/callbackURL de propósito: o projeto não usa webhooks.
  const data = await sharpifyRequest(SHARPIFY_CREATE_PATH, {
    method: 'POST',
    body: JSON.stringify({
      name: productName || 'Recarga de celular',
      description: productName || 'Recarga de celular via Pix',
      amount: Number(amount.toFixed(2)),
      gatewayMethod: 'PIX'
    })
  });

  let normalized = normalizeSharpify(data, amount);
  // Se a criação retornar apenas o ID, consulta o link privado para obter os dados do pagamento.
  if ((!normalized.paymentData.copyPaste && !normalized.paymentData.paymentUrl) && normalized.paymentLinkId) {
    const detail = await sharpifyRequest(`${SHARPIFY_GET_PATH}?paymentLinkId=${encodeURIComponent(normalized.paymentLinkId)}`, { method: 'GET' });
    normalized = normalizeSharpify({ ...data, ...detail }, amount);
  }

  if (!normalized.paymentData.copyPaste && !normalized.paymentData.paymentUrl && !normalized.paymentData.qrCodeBase64) {
    throw new Error('A Sharpify criou o pagamento, mas não retornou QR Code, Pix copia e cola ou link de pagamento.');
  }
  return normalized;
}

async function createBlackcat(input, amount, metadata) {
  if (!process.env.BLACKCAT_API_KEY) throw new Error('BLACKCAT_API_KEY não configurada no ambiente da Vercel.');
  const payload = {
    amount: Math.round(amount * 100), currency: 'BRL', paymentMethod: 'pix',
    items: [{ title: input.product_name || 'Recarga de Celular - Recarga Fácil', quantity: 1, tangible: false }],
    customer: { name: process.env.BLACKCAT_CLIENT_NAME || 'Recarga Fácil', email: process.env.BLACKCAT_CLIENT_EMAIL || 'contato@recargatodahora.online', phone: String(metadata.telefone || '11999999999'), document: { number: process.env.BLACKCAT_CLIENT_DOCUMENT || '', type: 'cpf' } },
    pix: { expiresInDays: 1 }, metadata,
    ...(process.env.BLACKCAT_POSTBACK_URL ? { postbackUrl: process.env.BLACKCAT_POSTBACK_URL } : {}),
    externalRef: `RTH-${new Date().toISOString().slice(0,10).replaceAll('-', '')}-${crypto.randomUUID().slice(0,8)}`
  };
  const response = await fetch(BLACKCAT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.BLACKCAT_API_KEY }, body: JSON.stringify(payload) });
  const text = await response.text();
  const data = parseBody(text);
  if (!response.ok || !data?.data?.paymentData) {
    const message = data?.message || data?.error || (text ? text.slice(0, 300) : 'A API Blackcat não retornou um Pix válido.');
    throw new Error(`Blackcat HTTP ${response.status}: ${message}`);
  }
  return {
    paymentData: { copyPaste: data.data.paymentData.copyPaste || '', qrCodeBase64: data.data.paymentData.qrCodeBase64 || null, qrCode: data.data.paymentData.qrCode || '' },
    transactionId: data.data.transactionId || null,
    status: data.data.status || 'PENDING',
    amount: data.data.amount || Math.round(amount * 100),
    amountDisplay: amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    invoiceUrl: data.data.invoiceUrl || null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método não permitido' });
  const input = req.body || {};
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1000) return res.status(400).json({ success: false, message: 'amount deve ser um número entre 0,01 e 1.000.' });
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  try {
    const data = gateway() === 'sharpify'
      ? await createSharpify(amount, input.product_name)
      : await createBlackcat(input, amount, metadata);
    return res.status(200).json({ success: true, gateway: gateway(), data });
  } catch (error) {
    return res.status(502).json({ success: false, gateway: gateway(), message: error.message || 'Não foi possível gerar o Pix.' });
  }
}
