const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith(".tsx") && !file.includes("-Chae_2024")) {
      results.push(filePath);
    }
  });
  return results;
}

const dirs = [
  "components/portal",
  "components/product",
  "components/company",
  "components/support",
  "components/shared",
  "components/inquiries",
  "components/application",
  "components/finance",
  "components/retailer",
];

const allFiles = dirs.flatMap((d) => walk(d));

allFiles.forEach((f) => {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  const matches = [];
  lines.forEach((l, i) => {
    if (
      (l.includes("bg-rose-50") || l.includes("bg-red-50") || l.includes("bg-rose-100") || l.includes("bg-red-100") || l.includes("border-red-200") || l.includes("border-rose-200") || l.includes("border-red-100") || l.includes("border-rose-100")) &&
      (!l.includes("dark:bg-") || !l.includes("dark:border-") || !l.includes("dark:text-"))
    ) {
      matches.push(`  L${i + 1}: ${l.trim().slice(0, 140)}`);
    }
  });
  if (matches.length > 0) {
    console.log(`\n=== File: ${f} ===`);
    matches.forEach((m) => console.log(m));
  }
});
