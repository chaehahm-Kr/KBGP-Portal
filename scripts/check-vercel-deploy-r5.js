const https = require('https');

const targetSha = '51a146d';
console.log(`Checking production deployment for SHA starting with ${targetSha}...`);

function check() {
  return new Promise((resolve) => {
    const req = https.get('https://portal.kselectnetwork.com/api/diagnostics', { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const liveSha = json.deployment?.commitSha || json.gitCommitSha || json.commitSha || 'unknown';
          console.log(`[Status ${res.statusCode}] Live SHA: ${liveSha}`);
          if (liveSha.startsWith(targetSha)) {
            console.log(`🎉 MATCH: Production deployment ${targetSha} is LIVE!`);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (e) {
          console.log('Error parsing response:', e.message);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.log('Request error:', err.message);
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      console.log('Request timed out');
      resolve(false);
    });
  });
}

async function main() {
  for (let i = 1; i <= 30; i++) {
    console.log(`\nAttempt ${i}/30:`);
    const success = await check();
    if (success) {
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
  console.log('Timeout waiting for deployment');
  process.exit(1);
}

main();
