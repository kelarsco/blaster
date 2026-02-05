import { Router } from 'express';
import { getDb, memoryStore } from '../db.js';
import { logActivity } from './activity.js';

export const exportRoutes = Router();

exportRoutes.get('/xml/:scanId', async (req, res) => {
  const scanId = req.params.scanId;
  let rows = [];
  const db = getDb();
  if (db) {
    const result = await db.query(
      'SELECT store_url, email FROM scan_results WHERE scan_id = $1 AND has_email = 1',
      [scanId]
    );
    rows = result.rows;
  } else {
    rows = (memoryStore.results.get(scanId) || []).filter((r) => r.has_email === 1 && r.email);
  }
  const byStore = new Map();
  for (const r of rows) {
    if (!byStore.has(r.store_url)) byStore.set(r.store_url, []);
    if (r.email) byStore.get(r.store_url).push(r.email);
  }
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<stores>\n';
  for (const [url, emails] of byStore) {
    for (const email of emails) {
      xml += `  <store>\n    <url>${escapeXml(url)}</url>\n    <email>${escapeXml(email)}</email>\n  </store>\n`;
    }
  }
  xml += '</stores>';
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="storereach-${scanId}.xml"`);
  res.send(xml);
  logActivity('export_xml', { scanId });
});

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
