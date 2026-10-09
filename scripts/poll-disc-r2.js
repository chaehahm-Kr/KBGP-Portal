const https = require('https');

const targetShas = ['fe901f3', '7bacfaf'];

function check() {
  https.get('https://portal.kselecthub.com/api/diagnostics', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const currentSha = data.deployment?.commitSha || '';
        console.log(new Date().toISOString(), 'Live SHA:', currentSha);
        if (targetShas.some(sha => currentSha.startsWith(sha))) {
          console.log('Target SHA is LIVE:', currentSha);
          process.exit(0);
        } else {
          setTimeout(check, 4000);
        }
      } catch (e) {
        setTimeout(check, 4000);
      }
    });
  }).on('error', () => setTimeout(check, 4000));
}

check();
