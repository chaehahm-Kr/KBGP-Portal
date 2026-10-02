const fs = require('fs');
const path = require('path');

const baseDir = path.join(process.cwd(), 'Manuals', 'MAN-B-FAQ-001_Knowledge-FAQ');
const dirs = [
  path.join(baseDir, '01_SOURCE'),
  path.join(baseDir, '02_CLAUDE_PACKAGE'),
  path.join(baseDir, '03_PUBLISHED'),
  path.join(baseDir, '04_ARCHIVE')
];

dirs.forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
    console.log(`Created directory: ${d}`);
  }
});
