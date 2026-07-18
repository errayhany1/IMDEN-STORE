/**
 * Convert tmp/clients.xlsx (Google Maps shop scrape) into CSVs.
 * Usage: node scripts/convert-clients-xlsx.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const xlsxPath = path.join(root, 'tmp', 'xlsx-tool', 'node_modules', 'xlsx');
const XLSX = require(xlsxPath);

const src = path.join(root, 'tmp', 'clients.xlsx');
const wb = XLSX.readFile(src);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });

function normPhone(p) {
  if (p == null || p === '') return '';
  let s = String(p).trim();
  if (/e\+/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = Math.round(n).toString();
  } else if (typeof p === 'number') {
    s = Math.round(p).toString();
  }
  s = s.replace(/[^\d+]/g, '');
  if (s.startsWith('212') && !s.startsWith('+')) s = `+${s}`;
  if (s.startsWith('0') && s.length >= 9) s = `+212${s.slice(1)}`;
  return s;
}

function findEmail(text) {
  const m = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : '';
}

function esc(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, list) {
  return [headers.join(',')]
    .concat(list.map((r) => headers.map((h) => esc(r[h])).join(',')))
    .join('\n');
}

let withPhone = 0;
let withWeb = 0;
let withEmail = 0;
let withFb = 0;

function pickUrls(r) {
  const a = String(r.website || '').trim();
  const b = String(r.searchPageUrl || '').trim();
  const all = [a, b].filter(Boolean);
  const maps = all.find((u) => /google\.com\/maps/i.test(u)) || '';
  const site = all.find((u) => u && !/google\.com\/maps/i.test(u)) || '';
  return { maps, site };
}

const out = rows.map((r) => {
  const phone = normPhone(r.phoneUnformatted);
  const { maps, site } = pickUrls(r);
  const email = findEmail(site) || findEmail(r.title) || findEmail(r.address);
  if (phone) withPhone += 1;
  if (site) withWeb += 1;
  if (email) withEmail += 1;
  if (/facebook\.com/i.test(site)) withFb += 1;
  return {
    NAME: String(r.title || '').trim(),
    PHONE: phone,
    CITY: String(r.city || '').trim(),
    ADDRESS: String(r.address || '').trim(),
    CATEGORY: String(r.categoryName || '').trim(),
    SCORE: String(r.totalScore ?? '').trim(),
    WEBSITE: site,
    EMAIL: email,
    MAPS: maps,
  };
});

const headers = ['NAME', 'PHONE', 'CITY', 'ADDRESS', 'CATEGORY', 'SCORE', 'WEBSITE', 'EMAIL', 'MAPS'];
fs.writeFileSync(path.join(root, 'tmp', 'clients-shops.csv'), `\uFEFF${toCsv(headers, out)}`, 'utf8');

const brevo = out.filter((r) => r.EMAIL);
fs.writeFileSync(
  path.join(root, 'tmp', 'clients-brevo-emails.csv'),
  `\uFEFF${toCsv(['EMAIL', 'FIRSTNAME', 'SMS', 'CITY'], brevo.map((r) => ({
    EMAIL: r.EMAIL,
    FIRSTNAME: r.NAME,
    SMS: r.PHONE,
    CITY: r.CITY,
  })))}`,
  'utf8'
);

const phones = out.filter((r) => r.PHONE);
fs.writeFileSync(
  path.join(root, 'tmp', 'clients-phones.csv'),
  `\uFEFF${toCsv(['NAME', 'PHONE', 'CITY', 'WEBSITE'], phones)}`,
  'utf8'
);

const cities = [...new Set(out.map((r) => r.CITY).filter(Boolean))];
console.log(JSON.stringify({
  total: out.length,
  withPhone,
  withWeb,
  withEmail,
  withFb,
  cities: cities.length,
  sampleCities: cities.slice(0, 15),
  sample: out.slice(0, 3),
}, null, 2));
