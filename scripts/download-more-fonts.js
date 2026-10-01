const fs = require("fs");
const path = require("path");
const https = require("https");

const fontDir = path.join(process.cwd(), "private_assets/fonts");

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}, status: ${response.statusCode}`));
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          console.log(`Successfully downloaded ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`);
          resolve();
        });
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const fonts = [
    {
      name: "DancingScript-Bold.ttf",
      url: "https://raw.githubusercontent.com/google/fonts/main/ofl/dancingscript/static/DancingScript-Bold.ttf",
    },
    {
      name: "Caveat-Bold.ttf",
      url: "https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/static/Caveat-Bold.ttf",
    }
  ];

  for (const f of fonts) {
    const dest = path.join(fontDir, f.name);
    try {
      await downloadFile(f.url, dest);
    } catch (err) {
      console.error(`Error downloading ${f.name}:`, err.message);
    }
  }
}

main().catch(console.error);
