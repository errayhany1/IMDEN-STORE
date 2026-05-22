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
    
    const nullTitles = all.filter(r => (r.POSTEBL === 'POSTEBL' || r.POSTEBL === 'NO POSTEBL') && !r.Title);
    console.log(`Total active records with null Title: ${nullTitles.length}`);
    
    // Sample 5 records to see what fields have text
    nullTitles.slice(0, 10).forEach(r => {
        console.log(`Id: ${r.Id} | SKU: ${r.SKU} | Arabic_Title: ${r.Arabic_Title} | Woo_Title: ${r.Woo_Title} | Woo_Cat_Name: ${r.Woo_Cat_Name} | Jumia_Category: ${r.Jumia_Category}`);
    });
}

check().catch(e => console.error(e));
