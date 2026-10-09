const https = require('https');

async function pollDeployment() {
  const targetSha = '11c2fdb';
  console.log(`Polling https://portal.kselecthub.com/api/diagnostics for commit SHA starting with ${targetSha}...`);

  for (let i = 0; i < 40; i++) {
    await new Promise(res => setTimeout(res, 5000));
    try {
      await new Promise((resolve, reject) => {
        const req = https.get('https://portal.kselecthub.com/api/diagnostics', { timeout: 10000 }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const currentSha = json.deployment?.commitSha || '';
              console.log(`Attempt ${i + 1}: Live commitSha = ${currentSha}`);
              if (currentSha.startsWith(targetSha)) {
                console.log("🎉 Vercel Production deployment ready and verified!");
                process.exit(0);
              }
              resolve();
            } catch (e) {
              console.log(`Attempt ${i + 1}: Failed to parse JSON response`);
              resolve();
            }
          });
        });
        req.on('error', (err) => {
          console.log(`Attempt ${i + 1}: Request error: ${err.message}`);
          resolve();
        });
        req.on('timeout', () => {
          req.destroy();
          console.log(`Attempt ${i + 1}: Timeout`);
          resolve();
        });
      });
    } catch (e) {
      console.log(`Attempt ${i + 1}: Error: ${e.message}`);
    }
  }

  console.error("Timed out waiting for Vercel deployment.");
  process.exit(1);
}

pollDeployment();
