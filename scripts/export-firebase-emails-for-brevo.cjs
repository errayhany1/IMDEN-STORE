/**
 * Export Firebase Auth + Firestore offersLeads emails for Brevo.
 *
 * Preferred (no service account needed if Firebase CLI is logged in):
 *   npx firebase-tools auth:export tmp/firebase-auth-users.json --format=json --project imden-errayany
 *   node scripts/export-firebase-emails-for-brevo.cjs
 *
 * Or pass a JSON dump:
 *   node scripts/export-firebase-emails-for-brevo.cjs tmp/firebase-auth-users.json
 *
 * Output: tmp/firebase-customers-brevo.csv
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const outCsv = path.join(root, 'tmp', 'firebase-customers-brevo.csv');
const defaultDump = path.join(root, 'tmp', 'firebase-auth-users.json');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function collectFromAuthDump(dump) {
  const users = dump.users || dump || [];
  const byEmail = new Map();
  for (const u of users) {
    const email = String(u.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) continue;
    byEmail.set(email, {
      EMAIL: email,
      FIRSTNAME: String(u.displayName || '').trim(),
      SMS: String(u.phoneNumber || '').trim(),
      UID: String(u.localId || u.uid || '').trim(),
      SOURCE: 'firebase-auth',
    });
  }
  return byEmail;
}

function ensureAuthDump(inputPath) {
  if (inputPath && fs.existsSync(inputPath)) return inputPath;
  if (fs.existsSync(defaultDump)) return defaultDump;

  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  console.log('Exporting Firebase Auth users via firebase-tools...');
  try {
    execSync(
      `npx --yes firebase-tools auth:export "${defaultDump}" --format=json --project imden-errayany`,
      { stdio: 'inherit', cwd: root }
    );
  } catch (e) {
    console.error('\nFailed to export Auth users. Login first:');
    console.error('  npx firebase-tools login');
    console.error('Then re-run this script.\n');
    process.exit(1);
  }
  return defaultDump;
}

(async () => {
  const dumpPath = ensureAuthDump(process.argv[2]);
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  const byEmail = collectFromAuthDump(dump);

  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  const header = ['EMAIL', 'FIRSTNAME', 'SMS', 'UID', 'SOURCE'];
  const lines = [header.join(',')];
  for (const row of byEmail.values()) {
    lines.push(header.map((k) => csvEscape(row[k])).join(','));
  }
  fs.writeFileSync(outCsv, lines.join('\n'), 'utf8');

  console.log(`Wrote ${byEmail.size} emails → ${outCsv}`);
  console.log('Import this CSV into Brevo → Contacts → Wholesale customers');
})();
