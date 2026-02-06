import { Router } from 'express';
import * as XLSX from 'xlsx';
import { getDb, memoryStore } from '../db.js';
import { logActivity } from './activity.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const exportRoutes = Router();

exportRoutes.get('/excel/:scanId', requireAuth, async (req, res) => {
  const scanId = req.params.scanId;
  const fieldsParam = (req.query.fields || '').toString();
  const fields = fieldsParam
    ? fieldsParam.split(',').map((f) => f.trim()).filter(Boolean)
    : ['storeUrl', 'email'];
  let rows = [];
  const db = getDb();
  if (db) {
    const result = await db.query(
      `SELECT sr.store_url, sr.email FROM scan_results sr
       JOIN scans s ON s.id = sr.scan_id
       WHERE sr.scan_id = $1 AND s.user_id = $2 AND sr.has_email = 1`,
      [scanId, req.user.id]
    );
    rows = result.rows;
    if (rows.length === 0) {
      const scanCheck = await db.query('SELECT 1 FROM scans WHERE id = $1 AND user_id = $2', [scanId, req.user.id]);
      if (!scanCheck.rows?.length) return res.status(404).json({ error: 'Scan not found' });
    }
  } else {
    rows = (memoryStore.results.get(scanId) || []).filter((r) => r.has_email === 1 && r.email);
  }

  const normalized = rows.map((r) => ({
    storeUrl: r.store_url || r.storeUrl,
    email: r.email,
  }));

  const header = [];
  if (fields.includes('storeUrl')) header.push('Store URL');
  if (fields.includes('email')) header.push('Email');
  const data = [header];

  for (const r of normalized) {
    const row = [];
    if (fields.includes('storeUrl')) row.push(r.storeUrl || '');
    if (fields.includes('email')) row.push(r.email || '');
    data.push(row);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Stores');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="storereach-${scanId}.xlsx"`);
  res.send(buf);
  logActivity('export_excel', { scanId }, req.user?.id);
});
