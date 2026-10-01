const fs = require("fs");
const path = require("path");

function searchDir(dir, searchTerms) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (f === "node_modules" || f === ".next" || f === ".git" || f === "scratch") continue;
    if (fs.statSync(full).isDirectory()) {
      searchDir(full, searchTerms);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      const content = fs.readFileSync(full, "utf8");
      searchTerms.forEach(term => {
        if (content.includes(term)) {
          console.log(`[${term}] -> ${full}`);
        }
      });
    }
  }
}

console.log("=== Searching for DAL & Redirect Usage ===");
searchDir(".", ["requireCompanyMembership", "requireCompanyAdmin", "redirect(\"/portal\")", "redirect('/portal')"]);
