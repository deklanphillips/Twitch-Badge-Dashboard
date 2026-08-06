// Auto-pull the StreamDatabase Events page and merge its dates in — the
// automated version of the manual "upload HTML" step.
//
// Fetches https://www.streamdatabase.com/events, verifies it actually contains
// the Next.js data payload (not a bot-challenge/empty page), writes it to a
// temp file, then hands off to the existing, battle-tested merge script so all
// the non-destructive merge logic is reused exactly.
//
// Degrades safely: if the fetch fails, is blocked, or the page has no data, it
// logs and exits 0 WITHOUT touching availability-data.js — so a bad fetch can
// never corrupt the site, and the manual upload flow still works as a fallback.
//
// Usage:  node scripts/fetch-streamdatabase.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const URLS = [
  "https://www.streamdatabase.com/events",
  "https://streamdatabase.com/events",
];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Signs the fetched HTML is a bot challenge / not the real page.
const CHALLENGE = /Just a moment|cf-browser-verification|Checking your browser|Attention Required/i;

async function fetchPage() {
  for (const url of URLS) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });
      const html = await res.text();
      if (!res.ok) {
        console.warn(`fetch ${url}: HTTP ${res.status} — skipping`);
        continue;
      }
      if (CHALLENGE.test(html)) {
        console.warn(`fetch ${url}: looks like a bot-challenge page — skipping`);
        continue;
      }
      if (!html.includes('id="__NEXT_DATA__"')) {
        console.warn(`fetch ${url}: no __NEXT_DATA__ payload found — skipping`);
        continue;
      }
      console.log(`fetched ${url} (${html.length} bytes)`);
      return html;
    } catch (e) {
      console.warn(`fetch ${url} failed: ${e.message}`);
    }
  }
  return null;
}

async function main() {
  const html = await fetchPage();
  if (!html) {
    console.log("No usable StreamDatabase page fetched — leaving data unchanged.");
    return; // exit 0: nothing merged, manual flow still available
  }
  const tmp = path.join(os.tmpdir(), `streamdatabase-events-${process.pid}.html`);
  fs.writeFileSync(tmp, html);
  try {
    // Reuse the exact same non-destructive merge used for manual uploads.
    const out = execFileSync("node", [path.join(__dirname, "merge-availability.js"), tmp], {
      encoding: "utf8",
    });
    process.stdout.write(out);
  } finally {
    fs.unlinkSync(tmp);
  }
}

main().catch((err) => {
  // Never fail the job over a scrape hiccup — just report and move on.
  console.error("fetch-streamdatabase error:", err.message);
  process.exit(0);
});
