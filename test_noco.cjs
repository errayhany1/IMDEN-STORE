const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if(key && val.length) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

async function run() {
    const url = env.VITE_NOCODB_URL + '/api/v2/tables/' + env.VITE_NOCODB_TABLE_ORDERS + '/records?limit=1';
    const token = env.VITE_NOCODB_API_TOKEN || env.VITE_NOCODB_ORDERS_TOKEN;
    const res = await fetch(url, { headers: { 'xc-token': token } });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
