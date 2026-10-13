// Vercel Serverless Function: /api/works
// GET    → সব কাজের লিস্ট (পাবলিক)
// POST   → নতুন কাজ আপলোড (শুধু অ্যাডমিন; header "x-admin-key")
// DELETE → ?id=... কাজ মুছে ফেলা (শুধু অ্যাডমিন)
// প্রয়োজন: Vercel Blob store (BLOB_READ_WRITE_TOKEN) এবং ADMIN_PASSWORD — দুটোই Vercel Environment Variables-এ।
import { put, list, del } from '@vercel/blob';
import { timingSafeEqual, randomUUID } from 'node:crypto';

const META = 'works/meta/';
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function isAdmin(req) {
  const want = Buffer.from(process.env.ADMIN_PASSWORD || '');
  const got = Buffer.from(String(req.headers['x-admin-key'] || ''));
  return want.length > 0 && want.length === got.length && timingSafeEqual(want, got);
}

async function allWorks() {
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix: META, cursor });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const items = await Promise.all(blobs.map(b => fetch(b.url).then(r => r.json()).catch(() => null)));
  return items.filter(Boolean).sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
}

const clean = (v, max) => String(v || '').trim().slice(0, max);

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
      return res.status(200).json({ ok: true, works: await allWorks() });
    }
    if (!isAdmin(req)) return res.status(401).json({ ok: false, message: 'Wrong password' });

    if (req.method === 'POST') {
      const d = req.body || {};
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(d.image || ''));
      const title = clean(d.title, 120), description = clean(d.description, 2000);
      if (!m || !title || !description) return res.status(400).json({ ok: false, message: 'Image, title and description are required' });
      const id = randomUUID();
      const img = await put(`works/img/${id}.${TYPES[m[1]]}`, Buffer.from(m[2], 'base64'), { access: 'public', contentType: m[1], addRandomSuffix: false });
      const work = {
        id, title, description,
        category: clean(d.category, 40),
        location: clean(d.location, 80),
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '',
        image: img.url,
        createdAt: new Date().toISOString(),
      };
      await put(`${META}${id}.json`, JSON.stringify(work), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
      return res.status(200).json({ ok: true, work });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ ok: false });
      const { blobs } = await list({ prefix: `works/img/${id}` });
      const meta = await list({ prefix: `${META}${id}` });
      const urls = [...blobs, ...meta.blobs].map(b => b.url);
      if (urls.length) await del(urls);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
}
