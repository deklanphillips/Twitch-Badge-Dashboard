// Shared data loader. In local dev (the Node server) it uses the live API
// route; when hosted statically (GitHub Pages) it reads the prebuilt JSON in
// api/ written by scripts/fetch-data.js. We skip the server attempt entirely
// off localhost so the static host doesn't fire a guaranteed-404 request.
async function twitchData(serverPath, staticPath) {
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
  if (isLocal) {
    try {
      const res = await fetch(serverPath, { cache: "no-store" });
      if (res.ok) return res.json();
    } catch { /* fall through to static */ }
  }
  const res = await fetch(staticPath, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);
  return res.json();
}
