import axios from 'axios';

const API_URL = 'https://app.nocodb.com';
const API_TOKEN = 'cS08dEn6AOnGAyJKONkV_iX58WCeNN8YFDgAzVg1';
const TABLE_ID = 'mpdn1jwettle7mj';

async function check() {
    let offset = 0;
    let limit = 100;
    let hasMore = true;
    let pageNum = 1;
    
    while (hasMore) {
        const res = await axios.get(`${API_URL}/api/v2/tables/${TABLE_ID}/records`, {
            headers: { 'xc-token': API_TOKEN },
            params: { limit, offset, sort: '-Id' }
        });
        const list = res.data.list || [];
        
        const watches = list.filter(r => String(r.Category_ID) === '3' && r.POSTEBL === 'POSTEBL');
        console.log(`Page ${pageNum} (offset ${offset}): Total active watches: ${watches.length}`);
        watches.forEach(w => {
            console.log(`  - Id: ${w.Id} | Title: ${w.Title} | SKU: ${w.SKU}`);
        });
        
        if (list.length < limit) hasMore = false;
        else offset += limit;
        pageNum++;
    }
}

check().catch(e => console.error(e));
