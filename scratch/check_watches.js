import axios from 'axios';

const API_URL = 'https://app.nocodb.com';
const API_TOKEN = 'cS08dEn6AOnGAyJKONkV_iX58WCeNN8YFDgAzVg1';
const TABLE_ID = 'mpdn1jwettle7mj';

async function check() {
    let all = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
        const res = await axios.get(`${API_URL}/api/v2/tables/${TABLE_ID}/records`, {
            headers: { 'xc-token': API_TOKEN },
            params: { limit: 100, offset }
        });
        const list = res.data.list || [];
        all = [...all, ...list];
        if (list.length < 100) hasMore = false;
        else offset += 100;
    }
    
    // Find all products that mention watch or ساعة or ساعات in Title, SKU, or Jumia_Category
    const matched = all.filter(r => {
        const title = r.Title || '';
        const sku = r.SKU || '';
        const wooCat = r.Woo_Cat_Name || '';
        const cleanTitle = title.toLowerCase();
        const cleanSku = sku.toLowerCase();
        const cleanWoo = wooCat.toLowerCase();
        
        return cleanTitle.includes('watch') || cleanTitle.includes('ساعة') || cleanTitle.includes('ساعات') ||
               cleanSku.includes('watch') || cleanSku.includes('ساعة') || cleanSku.includes('ساعات') ||
               cleanWoo.includes('watch') || cleanWoo.includes('ساعة') || cleanWoo.includes('ساعات');
    });
    
    console.log(`Total watch matches in DB: ${matched.length}`);
    matched.forEach(r => {
        console.log(`Id: ${r.Id} | Title: ${r.Title} | SKU: ${r.SKU} | Category_ID: ${r.Category_ID} | POSTEBL: ${r.POSTEBL} | Woo_Cat_Name: ${r.Woo_Cat_Name}`);
    });
}

check().catch(e => console.error(e));
