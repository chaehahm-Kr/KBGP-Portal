const https = require('https');
const { execSync } = require('child_process');

const targetSha = process.argv[2] || execSync('git rev-parse HEAD').toString().trim();
const domain = process.argv[3] || 'https://admin.kselectnetwork.com';
const timeoutMs = 180000; // 3 minutes max timeout
const pollIntervalMs = 8000;
const startTime = Date.now();

console.log(`[DEPLOY VERIFY] Target Commit SHA: ${targetSha}`);
console.log(`[DEPLOY VERIFY] Domain: ${domain}`);

const checkAncestor = (ancestorSha, descendantSha) => {
  try {
    const output = execSync(`git merge-base --is-ancestor ${ancestorSha} ${descendantSha}`, { stdio: 'pipe' }).toString().trim();
    return true;
  } catch (e) {
    return false;
  }
};

const poll = () => {
  if (Date.now() - startTime > timeoutMs) {
    console.error(`[DEPLOY VERIFY] ERROR: Timeout after ${timeoutMs / 1000}s waiting for deployment of ${targetSha}`);
    process.exit(1);
  }

  const req = https.get(`${domain}/api/diagnostics`, { timeout: 10000 }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const liveSha = json.deployment?.commitSha || json.gitCommitSha || '';

        console.log(`[DEPLOY VERIFY] Live SHA: ${liveSha} | Target SHA: ${targetSha}`);

        if (liveSha.startsWith(targetSha.substring(0, 7))) {
          console.log(`[DEPLOY VERIFY] SUCCESS: Live Production SHA matches target commit exactly! (${liveSha})`);
          process.exit(0);
        } else if (checkAncestor(targetSha, liveSha)) {
          console.log(`[DEPLOY VERIFY] SUCCESS: Live Production SHA (${liveSha}) includes target commit (${targetSha}) as an ancestor!`);
          process.exit(0);
        } else {
          console.log(`[DEPLOY VERIFY] Pending... Live SHA is ${liveSha}. Retrying in ${pollIntervalMs / 1000}s...`);
          setTimeout(poll, pollIntervalMs);
        }
      } catch (e) {
        console.log(`[DEPLOY VERIFY] Diagnostics parse error (${e.message}). Retrying...`);
        setTimeout(poll, pollIntervalMs);
      }
    });
  });

  req.on('error', (err) => {
    console.log(`[DEPLOY VERIFY] Request error (${err.message}). Retrying...`);
    setTimeout(poll, pollIntervalMs);
  });
};

poll();
