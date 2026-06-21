#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const viewsDir = path.join(__dirname, "..", "views");

const headRegex = /<!DOCTYPE html>[\s\S]*?<body[^>]*>\n?/i;
const footRegex = /<footer class="page-footer">[\s\S]*?<\/html>\s*$/i;
const footRegex2 = /<script src="\/js\/app\.js"><\/script>[\s\S]*?<\/html>\s*$/i;

function migrate(file, opts = {}) {
  const fp = path.join(viewsDir, file);
  if (!fs.existsSync(fp)) return;
  let html = fs.readFileSync(fp, "utf8");

  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const pageTitle = opts.pageTitle || (titleMatch ? titleMatch[1] : "HERSTYLE");

  let extraHead = opts.extraHead || "";
  if (opts.chartJs) {
    extraHead +=
      '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>';
  }

  const bodyClass = opts.bodyClass ? ` class="${opts.bodyClass}"` : "";
  const headInclude = `<%- include('partials/head', { pageTitle: '${pageTitle.replace(/'/g, "\\'")}'${opts.bodyClass ? `, bodyClass: '${opts.bodyClass}'` : ""}${extraHead ? `, extraHead: '${extraHead.replace(/'/g, "\\'")}'` : ""} }) %>\n`;

  html = html.replace(headRegex, headInclude);
  if (!html.includes("partials/header")) {
    html = html.replace(headInclude, headInclude + "<%- include('partials/header') %>\n");
  }

  // Remove duplicate old header includes if head was replaced but header was in old block
  html = html.replace(/<%- include\('partials\/header'\) %>\n<%- include\('partials\/header'\) %>/g, "<%- include('partials/header') %>");

  // Extract trailing scripts before </body>
  let extraScripts = "";
  const scriptTail = html.match(/(<script[\s\S]*?<\/script>\s*)+<\/body>\s*<\/html>\s*$/i);
  if (scriptTail) {
    extraScripts = scriptTail[0]
      .replace(/<\/body>\s*<\/html>\s*$/, "")
      .replace(/<script src="\/js\/app\.js"><\/script>\s*/g, "");
  }

  html = html.replace(footRegex, "");
  html = html.replace(footRegex2, "");
  html = html.replace(/<\/body>\s*<\/html>\s*$/, "");

  const footerInclude = extraScripts
    ? `<%- include('partials/footer', { extraScripts: \`${extraScripts.replace(/`/g, "\\`")}\` }) %>`
    : `<%- include('partials/footer') %>`;

  html = html.trimEnd() + "\n" + footerInclude + "\n";
  fs.writeFileSync(fp, html);
  console.log("Migrated:", file);
}

const standard = [
  "cart.ejs",
  "search.ejs",
  "wishlist.ejs",
  "checkout.ejs",
  "orders.ejs",
  "profile.ejs",
  "stylist.ejs",
  "about.ejs",
  "_collection.ejs",
  "_product.ejs",
  "home.ejs",
];

standard.forEach((f) => migrate(f));
migrate("admin.ejs", { bodyClass: "admin-page", chartJs: true, pageTitle: "Admin | HERSTYLE" });

// Auth pages - custom minimal nav, no main header
["login.ejs", "signin.ejs", "forgot-password.ejs", "reset-password.ejs"].forEach((f) => {
  const fp = path.join(viewsDir, f);
  let html = fs.readFileSync(fp, "utf8");
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const pageTitle = titleMatch ? titleMatch[1] : "HERSTYLE";
  html = html.replace(headRegex, `<%- include('partials/head', { pageTitle: '${pageTitle}', bodyClass: 'auth-page' }) %>\n`);
  html = html.replace(/<header class="navbar">[\s\S]*?<\/header>\n\n?/i, "");
  html = html.replace(/<link rel="stylesheet" href="\/css\/[^"]+">\n/g, "");
  if (!html.includes("auth-nav")) {
    html = html.replace(
      `<%- include('partials/head'`,
      `<%- include('partials/head'`
    );
    const authNav = `<nav class="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-gray-100 bg-white/95 px-6 backdrop-blur-md md:px-10">
  <a href="/" class="font-serif text-lg font-semibold tracking-[0.15em]">HERSTYLE</a>
  <a href="${f.includes("login") || f.includes("forgot") || f.includes("reset") ? "/signin" : "/login"}" class="text-sm font-medium text-gray-600 hover:text-brand-gold">${f.includes("signin") ? "Login" : "Sign Up"}</a>
</nav>\n\n`;
    html = html.replace(/(<%- include\('partials\/head'[^%]+%\)\s*%>\n)/, `$1${authNav}`);
  }
  let extraScripts = "";
  const m = html.match(/(<script>[\s\S]*?<\/script>\s*)+<\/body>\s*<\/html>/);
  if (m) {
    extraScripts = m[0].replace(/<\/body>\s*<\/html>/, "");
  }
  html = html.replace(/<\/body>\s*<\/html>\s*$/, "");
  html = html.trimEnd() + "\n" + (extraScripts ? `<%- include('partials/footer', { extraScripts: \`${extraScripts.replace(/`/g, "\\`")}\` }) %>\n` : `<%- include('partials/footer') %>\n`);
  fs.writeFileSync(fp, html);
  console.log("Migrated auth:", f);
});

console.log("Done");
