const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith(".") && file !== "node_modules" && file !== ".next") {
        results = results.concat(walk(filePath));
      }
    } else if ((file.endsWith(".tsx") || file.endsWith(".jsx")) && !file.includes("-Chae_2024")) {
      results.push(filePath);
    }
  });
  return results;
}

const files = [...walk("components"), ...walk("app")];

const issues = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. Destructive Button / Badges with missing dark classes
    if (
      (line.includes("bg-rose-50") || line.includes("bg-red-50") || line.includes("bg-rose-100") || line.includes("bg-red-100")) &&
      !line.includes("dark:bg-")
    ) {
      issues.push({
        category: "Destructive/Alert Background missing dark:bg-",
        file,
        lineNum,
        snippet: line.trim(),
      });
    }

    if (
      (line.includes("border-red-200") || line.includes("border-rose-200") || line.includes("border-red-300") || line.includes("border-rose-300") || line.includes("border-rose-100") || line.includes("border-red-100")) &&
      !line.includes("dark:border-")
    ) {
      issues.push({
        category: "Destructive/Alert Border missing dark:border-",
        file,
        lineNum,
        snippet: line.trim(),
      });
    }

    if (
      (line.includes("text-red-600") || line.includes("text-red-700") || line.includes("text-red-800") || line.includes("text-red-650") || line.includes("text-rose-600") || line.includes("text-rose-700") || line.includes("text-rose-800")) &&
      !line.includes("dark:text-") &&
      (line.includes("<button") || line.includes("<a") || line.includes("<Link") || line.includes("className=") || line.includes("<span") || line.includes("<div"))
    ) {
      issues.push({
        category: "Red/Rose text missing dark:text-",
        file,
        lineNum,
        snippet: line.trim(),
      });
    }

    // 2. Buttons with border-zinc-200 / border-zinc-300 but missing dark:border-
    if (
      (line.includes("<button") || line.includes("type=\"button\"") || line.includes("type=\"submit\"") || line.includes("className=\"rounded") || line.includes("className=\"inline-flex") || line.includes("className=\"flex items-center")) &&
      (line.includes("border border-zinc-200") || line.includes("border border-zinc-300") || line.includes("border-zinc-200") || line.includes("border-zinc-300")) &&
      !line.includes("dark:border-")
    ) {
      issues.push({
        category: "Button border missing dark:border-",
        file,
        lineNum,
        snippet: line.trim(),
      });
    }

    // 3. Buttons with bg-white or bg-zinc-50/100 missing dark:bg-
    if (
      (line.includes("<button") || line.includes("type=\"button\"") || line.includes("type=\"submit\"")) &&
      (line.includes("bg-white") || line.includes("bg-zinc-50") || line.includes("bg-zinc-100")) &&
      !line.includes("dark:bg-")
    ) {
      issues.push({
        category: "Button background missing dark:bg-",
        file,
        lineNum,
        snippet: line.trim(),
      });
    }

    // 4. Modal close / icon-only buttons with text-zinc-400/500 missing dark:text-
    if (
      line.includes("<button") &&
      (line.includes("text-zinc-400") || line.includes("text-zinc-500")) &&
      !line.includes("dark:text-") &&
      !line.includes("dark:hover:text-")
    ) {
      issues.push({
        category: "Icon/Close button missing dark:text-",
        file,
        lineNum,
        snippet: line.trim(),
      });
    }

    // 5. Disabled state with opacity only or missing dark disabled
    if (
      line.includes("disabled:opacity-50") &&
      (line.includes("<button") || line.includes("className=")) &&
      (line.includes("bg-zinc-900") || line.includes("bg-zinc-800") || line.includes("text-zinc-400")) &&
      !line.includes("dark:disabled:")
    ) {
      // low risk, but good to inspect
    }
  });
});

console.log("==================================================");
console.log(`Deep Dark Mode Audit: Found ${issues.length} Potential Issues`);
console.log("==================================================");

const grouped = {};
issues.forEach((i) => {
  if (!grouped[i.category]) grouped[i.category] = [];
  grouped[i.category].push(i);
});

Object.keys(grouped).forEach((cat) => {
  console.log(`\n### ${cat} (${grouped[cat].length} instances)`);
  grouped[cat].forEach((item, idx) => {
    if (idx < 20) {
      console.log(`  [${item.file}:${item.lineNum}] ${item.snippet.slice(0, 120)}`);
    }
  });
  if (grouped[cat].length > 20) {
    console.log(`  ... and ${grouped[cat].length - 20} more`);
  }
});
