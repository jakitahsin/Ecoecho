// Vercel Serverless Function: POST /api/join
// এখনো কোনো ডাটাবেস যুক্ত নেই — তাই এই ফাংশন কিছু সংরক্ষণ করে না।
// TODO: Supabase / Google Sheets / Airtable-এ সংরক্ষণ যোগ করুন (secret key শুধু Vercel Environment Variables-এ রাখুন)।
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const d = req.body || {};
  if (d.company) return res.status(200).json({ ok: true }); // honeypot (spam)
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email || ''));
  if (!d.fullName || !emailOk || !d.location || !d.currentStatus || !d.motivation || d.consent !== true)
    return res.status(400).json({ ok: false, message: 'Invalid data' });
  // TODO: এখানে ডাটা সংরক্ষণ করুন
  return res.status(200).json({ ok: true });
}
