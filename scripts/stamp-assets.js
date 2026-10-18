// Cache-bust local assets so browsers never serve a stale availability-data.js
// (or any JS/CSS) after a deploy. Rewrites every <script src="/x.js"> and
// <link href="/x.css"> across the HTML pages to carry ?v=<content-hash>, so the
// URL changes only when that file's contents change — forcing a fresh fetch on
// change and allowing normal caching otherwise.
//
// Run after the data is generated, before committing. Idempotent.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");

// Find every .html file in the repo (skip node_modules / .git / mobile).
function htmlFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "mobile") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) htmlFiles(full, acc);
    else if (name.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const hashCache = new Map();
function hashOf(rel) {
  if (hashCache.has(rel)) return hashCache.get(rel);
  const file = path.join(ROOT, rel);
  let h = null;
  try { h = crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex").slice(0, 10); }
  catch { h = null; } // file doesn't exist (e.g. external) — leave untouched
  hashCache.set(rel, h);
  return h;
}

// Match src/href pointing at a root-absolute local .js/.css, with optional ?v=.
const RE = /\b(src|href)="(\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g;

let changed = 0;
for (const file of htmlFiles(ROOT)) {
  const orig = fs.readFileSync(file, "utf8");
  const next = orig.replace(RE, (m, attr, urlPath) => {
    const h = hashOf(urlPath.slice(1)); // "/x.js" -> "x.js"
    return h ? `${attr}="${urlPath}?v=${h}"` : m;
  });
  if (next !== orig) { fs.writeFileSync(file, next); changed++; }
}
console.log(`stamped assets in ${changed} HTML file(s)`);
