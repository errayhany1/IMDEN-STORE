const fs = require('fs');
const path = require('path');

const src = path.join(process.env.TEMP || '/tmp', 'data_safety_template.csv');
const dst = 'C:/Users/pc/Documents/WholesaleCatalog/data-safety-errayhany.csv';

const COLLECT = new Set([
  'PSL_NAME',
  'PSL_EMAIL',
  'PSL_USER_ACCOUNT',
  'PSL_ADDRESS',
  'PSL_PHONE',
  'PSL_PURCHASE_HISTORY',
  'PSL_DEVICE_ID',
]);
// Delivery partners receive address/phone for shipping
const SHARE = new Set(['PSL_ADDRESS', 'PSL_PHONE']);
const PRIVACY = 'https://errayhany.com/privacy-policy.html';

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      cur += ch;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function unquote(s) {
  s = s ?? '';
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

function quote(s) {
  s = String(s ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const text = fs.readFileSync(src, 'utf8');
const lines = text.split(/\r?\n/);
const header = lines[0];
const rows = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const cols = parseCSVLine(lines[i]).map(unquote);
  while (cols.length < 5) cols.push('');
  let [qid, rid, val, req, label] = cols;
  qid = qid.trim();
  rid = rid.trim();
  val = '';

  if (qid === 'PSL_DATA_COLLECTION_COLLECTS_PERSONAL_DATA') {
    val = 'true';
  } else if (qid === 'PSL_DATA_COLLECTION_ENCRYPTED_IN_TRANSIT') {
    val = 'true';
  } else if (qid === 'PSL_SUPPORTED_ACCOUNT_CREATION_METHODS') {
    val =
      rid === 'PSL_ACM_USER_ID_OTHER_AUTH' || rid === 'PSL_ACM_OAUTH'
        ? 'true'
        : '';
  } else if (qid === 'PSL_ACCOUNT_DELETION_URL') {
    val = PRIVACY;
  } else if (qid === 'PSL_SUPPORT_DATA_DELETION_BY_USER') {
    val = rid === 'DATA_DELETION_YES' ? 'true' : '';
  } else if (qid === 'PSL_DATA_DELETION_URL') {
    val = PRIVACY;
  } else if (qid.startsWith('PSL_DATA_TYPES_')) {
    val = COLLECT.has(rid) ? 'true' : '';
  } else if (qid.startsWith('PSL_DATA_USAGE_RESPONSES:')) {
    const m = qid.match(/^PSL_DATA_USAGE_RESPONSES:([^:]+):(.+)$/);
    if (m && COLLECT.has(m[1])) {
      const dtype = m[1];
      const aspect = m[2];
      if (aspect === 'PSL_DATA_USAGE_COLLECTION_AND_SHARING') {
        if (rid === 'PSL_DATA_USAGE_COLLECTED_AND_SHARED' && SHARE.has(dtype)) {
          val = 'true';
        } else if (
          rid === 'PSL_DATA_USAGE_ONLY_COLLECTED' &&
          !SHARE.has(dtype)
        ) {
          val = 'true';
        } else if (
          SHARE.has(dtype) &&
          (rid === 'PSL_DATA_USAGE_ONLY_COLLECTED' ||
            rid === 'PSL_DATA_USAGE_ONLY_SHARED')
        ) {
          // Fallback if COLLECTED_AND_SHARED is absent: mark both
          val = 'true';
        }
      } else if (aspect === 'PSL_DATA_USAGE_EPHEMERAL') {
        val = 'false';
      } else if (aspect === 'DATA_USAGE_USER_CONTROL') {
        const optional = [
          'PSL_EMAIL',
          'PSL_USER_ACCOUNT',
          'PSL_DEVICE_ID',
        ].includes(dtype);
        if (optional) {
          val =
            rid === 'PSL_DATA_USAGE_USER_CONTROL_OPTIONAL' ? 'true' : '';
        } else {
          val =
            rid === 'PSL_DATA_USAGE_USER_CONTROL_REQUIRED' ? 'true' : '';
        }
      } else if (aspect === 'DATA_USAGE_COLLECTION_PURPOSE') {
        const purposes = new Set(['PSL_APP_FUNCTIONALITY']);
        if (
          ['PSL_NAME', 'PSL_EMAIL', 'PSL_USER_ACCOUNT', 'PSL_PHONE'].includes(
            dtype
          )
        ) {
          purposes.add('PSL_ACCOUNT_MANAGEMENT');
        }
        val = purposes.has(rid) ? 'true' : '';
      } else if (aspect === 'DATA_USAGE_SHARING_PURPOSE') {
        val =
          SHARE.has(dtype) && rid === 'PSL_APP_FUNCTIONALITY' ? 'true' : '';
      }
    }
  }

  rows.push([qid, rid, val, req, label].map(quote).join(','));
}

// Fix SHARE types if COLLECTED_AND_SHARED exists: clear ONLY_* duplicates
const hasCombined = {};
for (const line of rows) {
  const cols = parseCSVLine(line).map(unquote);
  const qid = cols[0];
  const rid = cols[1];
  const m = qid.match(
    /^PSL_DATA_USAGE_RESPONSES:([^:]+):PSL_DATA_USAGE_COLLECTION_AND_SHARING$/
  );
  if (m && rid === 'PSL_DATA_USAGE_COLLECTED_AND_SHARED') {
    hasCombined[m[1]] = true;
  }
}

for (let i = 0; i < rows.length; i++) {
  const cols = parseCSVLine(rows[i]).map(unquote);
  const qid = cols[0];
  const rid = cols[1];
  const m = qid.match(
    /^PSL_DATA_USAGE_RESPONSES:([^:]+):PSL_DATA_USAGE_COLLECTION_AND_SHARING$/
  );
  if (!m || !SHARE.has(m[1]) || !hasCombined[m[1]]) continue;
  if (
    rid === 'PSL_DATA_USAGE_ONLY_COLLECTED' ||
    rid === 'PSL_DATA_USAGE_ONLY_SHARED'
  ) {
    cols[2] = '';
  } else if (rid === 'PSL_DATA_USAGE_COLLECTED_AND_SHARED') {
    cols[2] = 'true';
  }
  rows[i] = cols.map(quote).join(',');
}

fs.writeFileSync(dst, `${header}\n${rows.join('\n')}\n`, 'utf8');
const trueRows = rows.filter((r) => {
  const cols = parseCSVLine(r).map(unquote);
  return (cols[2] || '').toLowerCase() === 'true';
});
console.log('Wrote', dst);
console.log('TRUE count', trueRows.length);
trueRows.slice(0, 30).forEach((r) => console.log(r.slice(0, 160)));
