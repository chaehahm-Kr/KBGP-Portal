const fs = require('fs');
const path = require('path');

function searchFiles(dir, matchStr) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
        results.push(...searchFiles(fullPath, matchStr));
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(matchStr)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const matches = searchFiles(__dirname + '/..', 'applications');
console.log("Files mentioning applications:", matches);
