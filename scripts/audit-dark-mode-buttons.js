const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith(".") && file !== "node_modules") {
        results = results.concat(walk(filePath));
      }
    } else if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
      results.push(filePath);
    }
  });
  return results;
}

const files = [...walk("components"), ...walk("app")];

const findings = [];

files.forEach((file) => {
  // Exclude backup files like -Chae_2024.tsx
  if (file.includes("-Chae_2024")) return;

  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. Destructive buttons without dark classes or with dark mode low contrast
    if (
      (line.includes("bg-rose-50") || line.includes("bg-red-50") || line.includes("bg-rose-100") || line.includes("bg-red-100")) &&
      (line.includes("text-rose-") || line.includes("text-red-") || line.includes("삭제") || line.includes("Delete") || line.includes("Remove") || line.includes("button")) &&
      !line.includes("dark:bg-")
    ) {
      findings.push({
        type: "Destructive Button Missing dark:bg-",
        file,
        lineNum,
        line: line.trim(),
      });
    }

    if (
      (line.includes("border-red-200") || line.includes("border-rose-200") || line.includes("border-red-300") || line.includes("border-rose-300")) &&
      !line.includes("dark:border-")
    ) {
      findings.push({
        type: "Red Border Missing dark:border-",
        file,
        lineNum,
        line: line.trim(),
      });
    }

    if (
      (line.includes("text-red-600") || line.includes("text-red-650") || line.includes("text-rose-600") || line.includes("text-rose-700")) &&
      !line.includes("dark:text-") &&
      (line.includes("button") || line.includes("onClick") || line.includes("className="))
    ) {
      findings.push({
        type: "Red Text Missing dark:text-",
        file,
        lineNum,
        line: line.trim(),
      });
    }

    // 2. Secondary / Cancel / Outline buttons missing dark mode borders or text
    if (
      (line.includes("border-zinc-200") || line.includes("border-zinc-300")) &&
      (line.includes("bg-white") || line.includes("text-zinc-700") || line.includes("text-zinc-600") || line.includes("text-zinc-800")) &&
      (line.includes("<button") || line.includes("type=\"button\"") || line.includes("type=\"submit\"")) &&
      (!line.includes("dark:border-") || !line.includes("dark:text-") || !line.includes("dark:bg-"))
    ) {
      findings.push({
        type: "Button Missing dark: variant",
        file,
        lineNum,
        line: line.trim(),
      });
    }

    // 3. Low contrast text like text-zinc-400 or text-zinc-500 on buttons
    if (
      (line.includes("text-zinc-400") || line.includes("text-zinc-500")) &&
      (line.includes("<button") || line.includes("button") || line.includes("onClick")) &&
      !line.includes("dark:text-zinc-") &&
      !line.includes("dark:text-white")
    ) {
      findings.push({
        type: "Muted Button Text Missing dark:text-",
        file,
        lineNum,
        line: line.trim(),
      });
    }
  });
});

console.log(`Total Findings: ${findings.length}`);
const grouped = {};
findings.forEach((f) => {
  if (!grouped[f.type]) grouped[f.type] = [];
  grouped[f.type].push(f);
});

Object.keys(grouped).forEach((type) => {
  console.log(`\n=== ${type} (${grouped[type].length}) ===`);
  grouped[type].slice(0, 15).forEach((f) => {
    console.log(`  ${f.file}:${f.lineNum} -> ${f.line.slice(0, 100)}...`);
  });
  if (grouped[type].length > 15) {
    console.log(`  ... and ${grouped[type].length - 15} more`);
  }
});
