const fs = require('fs');
const path = require('path');
function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === 'node_modules' || f === '.next' || f === '.git') continue;
    if (fs.statSync(full).isDirectory()) search(full);
    else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('products') && (c.includes('.insert(') || c.includes('.upsert('))) {
        console.log('Match:', full);
      }
    }
  }
}
search('.');
