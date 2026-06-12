// Shared data loader. Tries the local Node server's live API route first;
// if that's unavailable (e.g. hosted statically on GitHub Pages), falls back
// to the prebuilt JSON files in api/ written by scripts/fetch-data.js.
async function twitchData(serverPath, staticPath) {
  let serverError = null;
  try {
    const res = await fetch(serverPath);
    if (res.ok) return res.json();
    const body = await res.json().catch(() => ({}));
    serverError = new Error(body.error || `Request failed (${res.status})`);
  } catch (err) {
    serverError = err;
  }
  const res = await fetch(staticPath);
  if (!res.ok) throw serverError;
  return res.json();
}
