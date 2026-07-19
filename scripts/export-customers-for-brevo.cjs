/**
 * Export unique customer emails for Brevo import (CSV).
 * Sources (in order):
 *  1) NocoDB Customers table (VITE_NOCODB_TABLE_CUSTOMERS) if configured
 *  2) NocoDB Orders table — Customer Email / Email fields when present
 *
 * Usage: node scripts/export-customers-for-brevo.cjs
 * Output: tmp/wholesale-customers-brevo.csv
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const url = process.env.VITE_NOCODB_URL;
const token = process.env.VITE_NOCODB_ORDERS_TOKEN || process.env.VITE_NOCODB_API_TOKEN;
const customersTable = process.env.VITE_NOCODB_TABLE_CUSTOMERS;
const ordersTable = process.env.VITE_NOCODB_TABLE_ORDERS;

if (!url || !token) {
  console.error('Missing VITE_NOCODB_URL or API token in .env');
  process.exit(1);
}

const headers = { 'xc-token': token };

async function fetchAll(tableId) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data } = await axios.get(`${url}/api/v2/tables/${tableId}/records`, {
      headers,
      params: { limit: 200, offset },
    });
    const list = data.list || [];
    rows.push(...list);
    if (list.length < 200) break;
    offset += 200;
  }
  return rows;
}

function pickEmail(record) {
  return String(
    record.Email
    || record['Customer Email']
    || record.email
    || ''
  ).trim().toLowerCase();
}

function pickName(record) {
  return String(
    record.Name
    || record['Customer Name']
    || record.name
    || ''
  ).trim();
}

function pickPhone(record) {
  return String(
    record.Phone
    || record['Customer Phone']
    || record['Phone Normalized']
    || ''
  ).trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

(async () => {
  const byEmail = new Map();

  if (customersTable) {
    const customers = await fetchAll(customersTable);
    for (const r of customers) {
      const email = pickEmail(r);
      if (!isValidEmail(email) || byEmail.has(email)) continue;
      byEmail.set(email, {
        EMAIL: email,
        FIRSTNAME: pickName(r),
        SMS: pickPhone(r),
      });
    }
  }

  if (ordersTable) {
    const orders = await fetchAll(ordersTable);
    for (const r of orders) {
      const email = pickEmail(r);
      if (!isValidEmail(email) || byEmail.has(email)) continue;
      byEmail.set(email, {
        EMAIL: email,
        FIRSTNAME: pickName(r),
        SMS: pickPhone(r),
      });
    }
  }

  const rows = [...byEmail.values()];
  const outDir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'wholesale-customers-brevo.csv');
  const csv = [
    'EMAIL,FIRSTNAME,SMS',
    ...rows.map((r) => [
      r.EMAIL,
      JSON.stringify(r.FIRSTNAME || ''),
      JSON.stringify(r.SMS || ''),
    ].join(',')),
  ].join('\n');
  fs.writeFileSync(outFile, csv, 'utf8');

  console.log(JSON.stringify({
    uniqueEmails: rows.length,
    output: outFile,
    note: rows.length === 0
      ? 'No emails found. Add Customer Email column to Orders, or set VITE_NOCODB_TABLE_CUSTOMERS.'
      : 'Import this CSV in Brevo → Contacts → Import contacts.',
  }, null, 2));
})().catch((err) => {
  console.error(err.response?.data || err.message);
  process.exit(1);
});
