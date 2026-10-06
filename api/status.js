const SHARPIFY_BASE_URL = (process.env.SHARPIFY_API_URL || 'https://sharpify-pay.com').replace(/\/$/, '');
const SHARPIFY_GET_PATH = process.env.SHARPIFY_GET_PATH || '/api/v1/gateway/payment/get-payment';
const BLACKCAT_STATUS_URL = process.env.BLACKCAT_STATUS_URL || 'https://api.blackcatpay.com.br/api/sales';
const gateway = () => String(process.env.PAYMENT_GATEWAY || 'blackcat').toLowerCase() === 'sharpify' ? 'sharpify' : 'blackcat';

async function readResponse(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { raw: text }; }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Método não permitido' });
  const active = gateway();
  try {
    if (active === 'sharpify') {
      if (!process.env.SHARPIFY_CLIENT_ID || !process.env.SHARPIFY_CLIENT_SECRET) return res.status(500).json({ success: false, message: 'Credenciais Sharpify não configuradas.' });
      const paymentLinkId = String(req.query?.paymentLinkId || req.query?.transaction || '').trim();
      if (!paymentLinkId) return res.status(400).json({ success: false, message: 'paymentLinkId é obrigatório.' });
      const response = await fetch(`${SHARPIFY_BASE_URL}${SHARPIFY_GET_PATH}?paymentLinkId=${encodeURIComponent(paymentLinkId)}`, {
        headers: { 'x-sharpify-client-id': process.env.SHARPIFY_CLIENT_ID, 'x-sharpify-client-secret': process.env.SHARPIFY_CLIENT_SECRET, 'Content-Type': 'application/json' }
      });
      const data = await readResponse(response);
      return res.status(response.status).json({ success: response.ok, gateway: 'sharpify', data });
    }

    if (!process.env.BLACKCAT_API_KEY) return res.status(500).json({ success: false, message: 'BLACKCAT_API_KEY não configurada no ambiente da Vercel.' });
    const transaction = String(req.query?.transaction || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!transaction) return res.status(400).json({ success: false, message: 'transaction é obrigatória.' });
    const response = await fetch(`${BLACKCAT_STATUS_URL}/${encodeURIComponent(transaction)}/status`, { headers: { 'X-API-Key': process.env.BLACKCAT_API_KEY, 'Content-Type': 'application/json' } });
    const data = await readResponse(response);
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message || 'Não foi possível consultar o status do pagamento.' });
  }
}
