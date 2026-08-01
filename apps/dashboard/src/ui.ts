export function renderPage(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Azoth</title>
<style>
:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 56rem; margin-inline: auto; }
.hidden { display: none; }
input, button { font: inherit; padding: 0.4rem 0.6rem; }
.stat { font-size: 2.5rem; font-weight: 700; margin: 0; }
.muted { color: #777; }
.row { display: flex; gap: 2rem; flex-wrap: wrap; margin: 1.5rem 0; }
form { display: flex; gap: 0.5rem; }
#trend { width: 100%; height: auto; }
.error { color: #c33; }
</style>
</head>
<body>
<header>
  <h1>Azoth</h1>
  <div class="row">
    <label>Site ID <input id="site" placeholder="my-site"></label>
    <button id="load">Load</button>
    <button id="logout" class="hidden">Log out</button>
  </div>
</header>
<section id="login" class="hidden">
  <form id="login-form">
    <input id="secret" type="password" placeholder="AUTH_SECRET" autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
  <p id="login-error" class="error hidden"></p>
</section>
<main id="dashboard" class="hidden">
  <div class="row">
    <div><p class="stat" id="pageviews">—</p><p class="muted">pageviews</p></div>
    <div><p class="stat" id="uniques">—</p><p class="muted">unique visitors</p></div>
  </div>
  <svg id="trend" viewBox="0 0 800 160" role="img" aria-label="Pageviews over time"></svg>
  <p id="error" class="error hidden"></p>
</main>
<script>
const $ = (id) => document.getElementById(id);
const site = $("site");
site.value = localStorage.getItem("azoth_site") ?? "";

async function api(path) {
  const res = await fetch(path, { credentials: "include" });
  if (res.status === 401) { showLogin(); return null; }
  if (!res.ok) throw new Error((await res.json()).error ?? "request failed");
  return res.json();
}

function showLogin() {
  $("login").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("logout").classList.add("hidden");
}

async function load() {
  const siteId = site.value.trim();
  if (siteId === "") return;
  localStorage.setItem("azoth_site", siteId);
  $("dashboard").classList.remove("hidden");
  $("login").classList.add("hidden");
  $("error").classList.add("hidden");
  $("logout").classList.remove("hidden");
  const to = Date.now();
  const from = to - 30 * 24 * 3600 * 1000;
  const q = new URLSearchParams({ siteId, from: String(from), to: String(to), bucket: "day" });
  try {
    const [pv, uniq] = await Promise.all([
      api("/api/pageviews?" + q),
      api("/api/uniques?" + q),
    ]);
    if (pv === null || uniq === null) return;
    $("pageviews").textContent = String(pv.total);
    $("uniques").textContent = String(uniq.uniques);
    renderTrend(pv.series);
  } catch (err) {
    $("error").textContent = String(err.message);
    $("error").classList.remove("hidden");
  }
}

function renderTrend(series) {
  const svg = $("trend");
  const W = 800, H = 160, P = 20;
  const values = series.map((d) => Number(d.pageviews) || 0);
  const max = Math.max(1, ...values);
  const n = Math.max(2, values.length);
  const step = (W - P * 2) / (n - 1);
  const pts = values.map((v, i) => [P + i * step, H - P - (v / max) * (H - P * 2)]);
  const line = pts.map(([x, y]) => x + "," + y).join(" ");
  const last = pts.length ? pts[pts.length - 1] : [P, H - P];
  svg.innerHTML = '<path d="M ' + line + '" fill="none" stroke="currentColor" stroke-width="2"></path>' +
    '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="currentColor"></circle>';
}

$("load").addEventListener("click", load);
$("logout").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST", credentials: "include" });
  showLogin();
});
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const secret = $("secret").value;
  const res = await fetch("/api/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  if (res.ok) { $("login").classList.add("hidden"); await load(); }
  else {
    const err = await res.json().catch(() => ({}));
    $("login-error").textContent = err.error ?? "Sign in failed";
    $("login-error").classList.remove("hidden");
  }
});
load();
</script>
</body>
</html>`;
}
