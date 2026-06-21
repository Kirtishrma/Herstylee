#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const viewsDir = path.join(__dirname, "..", "views");

for (const file of fs.readdirSync(viewsDir).filter((f) => f.endsWith(".ejs"))) {
  const fp = path.join(viewsDir, file);
  let html = fs.readFileSync(fp, "utf8");
  if (!html.includes("extraScripts:")) continue;

  const start = html.indexOf("<%- include('partials/footer', { extraScripts:");
  if (start === -1) continue;

  const scriptStart = html.indexOf("<script", start);
  const scriptEnd = html.lastIndexOf("</script>") + "</script>".length;
  const scripts = html.slice(scriptStart, scriptEnd);

  html = html.slice(0, start).trimEnd();
  html += "\n<%- include('partials/footer') %>\n";
  html += "<script src=\"/js/app.js\"></script>\n";
  if (scripts.includes("chart.js")) {
    html += "<script src=\"https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js\"></script>\n";
  }
  if (!scripts.includes('src="/js/app.js"') && !scripts.includes("chart.js")) {
    html += scripts.replace(/\\`/g, "`") + "\n";
  } else if (scripts.includes("<script>")) {
    const inner = scripts.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "").replace(/\\`/g, "`");
    html += `<script>${inner}</script>\n`;
  }
  html += "<%- include('partials/end') %>\n";

  fs.writeFileSync(fp, html);
  console.log("Fixed:", file);
}

// Simple pages without scripts
for (const file of ["about.ejs", "_collection.ejs"]) {
  const fp = path.join(viewsDir, file);
  let html = fs.readFileSync(fp, "utf8");
  if (html.includes("partials/end")) continue;
  html = html.replace(/<%- include\('partials\/footer'\) %>\s*$/, "<%- include('partials/footer') %>\n<%- include('partials/end') %>\n");
  fs.writeFileSync(fp, html);
  console.log("Added end:", file);
}

console.log("Done");
