const fs = require('fs');
const p = 'C:/Users/pc/Documents/WholesaleCatalog/data-safety-errayhany.csv';
let t = fs.readFileSync(p, 'utf8');
const before = (t.match(/EPHEMERAL,,false/g) || []).length;
t = t
  .split('\n')
  .map((line) => {
    if (line.includes('EPHEMERAL') && line.includes(',false,')) {
      return line.replace(',false,', ',,');
    }
    return line;
  })
  .join('\n');
fs.writeFileSync(p, t);
const after = (t.match(/EPHEMERAL,,false/g) || []).length;
console.log({ before, after, size: fs.statSync(p).size });
