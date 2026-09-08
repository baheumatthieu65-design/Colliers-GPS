export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Méthode non autorisée.' });
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return res.status(503).json({ ok: false, enabled: false, error: 'Notifications Push non configurées sur Vercel.' });
  return res.status(200).json({ ok: true, enabled: true, publicKey });
}
