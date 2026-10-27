const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createFixtures() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // 1x1 transparent PNG buffer
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // 1. Normal valid email package
  const zip = new JSZip();
  const sampleHtml = `<!DOCTYPE html>
<html>
<head><title>Autumn Beauty Showcase</title></head>
<body>
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h1>Discover K-Beauty Trends</h1>
    <img src="./images/hero.png" alt="Hero Banner" style="max-width: 100%; display: block;" />
    <p>Explore curated premium skincare collections direct from Seoul.</p>
    <a href="https://example.com/shop" style="background:#0F172A; color:#FFF; padding:12px 24px; text-decoration:none;">View Catalog</a>
    <img src="images/logo.png" alt="Brand Logo" width="120" />
  </div>
</body>
</html>`;

  zip.file('index.html', sampleHtml);
  zip.file('images/hero.png', png1x1);
  zip.file('images/logo.png', png1x1);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const validZipPath = path.join(fixturesDir, 'valid-email-package.zip');
  fs.writeFileSync(validZipPath, zipBuffer);
  console.log('Created:', validZipPath, zipBuffer.length, 'bytes');

  // 2. Malicious path traversal zip
  const evilZip = new JSZip();
  evilZip.file('index.html', '<h1>Evil</h1>');
  evilZip.file('../traversal.txt', 'evil content');
  const evilBuffer = await evilZip.generateAsync({ type: 'nodebuffer' });
  const evilZipPath = path.join(fixturesDir, 'traversal-attack.zip');
  fs.writeFileSync(evilZipPath, evilBuffer);
  console.log('Created:', evilZipPath, evilBuffer.length, 'bytes');
}

createFixtures().catch(err => {
  console.error(err);
  process.exit(1);
});
