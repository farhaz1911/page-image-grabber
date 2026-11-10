const tabId = Number(new URLSearchParams(location.search).get("tabId"));
const $ = (id) => document.getElementById(id);
const log = (m) => { $("log").textContent += m + "\n"; $("log").scrollTop = 1e9; };

// Runs in the page: scrolls through it so lazy-loaded images get loaded.
async function autoScroll() {
  const startY = window.scrollY;
  let y = 0, steps = 0;
  while (y < document.documentElement.scrollHeight && steps++ < 120) {
    window.scrollTo(0, y);
    y += window.innerHeight * 0.8;
    await new Promise((r) => setTimeout(r, 150));
  }
  await new Promise((r) => setTimeout(r, 500));
  window.scrollTo(0, startY);
}

// Runs in the page: returns one group per image, each a list of candidate URLs
// ordered from highest to lowest quality.
function collectImages() {
  const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|svg|bmp|tiff?)(\?|#|$)/i;
  const BIG_NAME = /full|large|zoom|orig|hi-?res|big|retina|2x|raw/i;
  const abs = (u) => { try { const a = new URL(u, document.baseURI).href; return a.startsWith("blob:") ? null : a; } catch { return null; } };

  const parseSrcset = (str, el) => {
    const out = [];
    if (!str) return out;
    for (const part of str.split(/,\s+/)) {
      const [u, d] = part.trim().replace(/,$/, "").split(/\s+/);
      if (!u) continue;
      let score = el.naturalWidth || 1;
      if (d && d.endsWith("w")) score = parseFloat(d);
      else if (d && d.endsWith("x")) score = parseFloat(d) * (el.clientWidth || 300);
      out.push([u, score]);
    }
    return out;
  };

  const groups = [];
  document.querySelectorAll("img").forEach((img) => {
    const cand = new Map();
    const add = (u, score) => {
      const a = u && abs(u);
      if (a && (!cand.has(a) || cand.get(a) < score)) cand.set(a, score);
    };
    const nw = img.naturalWidth || 1;
    add(img.currentSrc, nw);
    add(img.src, nw);
    parseSrcset(img.srcset, img).forEach(([u, s]) => add(u, s));
    parseSrcset(img.dataset.srcset, img).forEach(([u, s]) => add(u, s));
    const pic = img.closest("picture");
    if (pic) pic.querySelectorAll("source").forEach((s) => {
      parseSrcset(s.srcset, img).forEach(([u, sc]) => add(u, sc));
      parseSrcset(s.dataset.srcset, img).forEach(([u, sc]) => add(u, sc));
    });
    // data-* attributes: lazy-load sources and "full / large / zoom / original" variants
    for (const attr of img.attributes) {
      if (!attr.name.startsWith("data-") || !attr.value || attr.name.includes("srcset")) continue;
      if (IMG_EXT.test(attr.value) || /src|img|image|url/i.test(attr.name) || BIG_NAME.test(attr.name)) {
        if (/^(https?:|\/|\.|data:image)/i.test(attr.value)) add(attr.value, BIG_NAME.test(attr.name) ? 5e8 : nw);
      }
    }
    // a link wrapping the image that points to an image file is usually the full-size original
    const a = img.closest("a");
    if (a && a.href && IMG_EXT.test(a.href)) add(a.href, 1e9);

    const urls = [...cand.entries()].sort((x, y) => y[1] - x[1]).map((e) => e[0]);
    if (urls.length) groups.push(urls);
  });

  document.querySelectorAll("input[type=image]").forEach((i) => { const a = abs(i.src); if (a) groups.push([a]); });
  document.querySelectorAll("*").forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      for (const m of bg.matchAll(/url\(["']?(.*?)["']?\)/g)) {
        const a = abs(m[1]);
        if (a) groups.push([a]);
      }
    }
  });

  // drop duplicates: skip a group if its best URL is already covered by an earlier group
  const claimed = new Set(), result = [];
  for (const g of groups) {
    if (claimed.has(g[0])) continue;
    g.forEach((u) => claimed.add(u));
    result.push(g);
  }
  return { title: document.title, groups: result };
}

let groups = [];

(async () => {
  try {
    $("status").textContent = "Scrolling page to load lazy images…";
    await chrome.scripting.executeScript({ target: { tabId }, func: autoScroll });
    $("status").textContent = "Scanning for the highest-quality versions…";
    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: collectImages });
    groups = res.result.groups;
    $("page").textContent = res.result.title;
    $("status").textContent = `Found ${groups.length} images.`;
    $("go").disabled = groups.length === 0;
  } catch (e) {
    $("status").textContent = "Couldn't read that page (browser pages like chrome:// are blocked). " + e.message;
  }
})();

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "image/svg+xml": "svg", "image/avif": "avif", "image/bmp": "bmp", "image/x-icon": "ico" };
const KNOWN = new Set(Object.values(EXT).concat(["jpeg", "jfif", "tif", "tiff"]));

function makeName(url, mime, used) {
  let base = "image";
  if (!url.startsWith("data:")) {
    try { base = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "image"); } catch {}
  }
  base = base.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
  const dot = base.lastIndexOf(".");
  let ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  let stem = dot > 0 ? base.slice(0, dot) : base;
  if (!KNOWN.has(ext)) { stem = base; ext = EXT[mime] || "img"; }
  let name = `${stem}.${ext}`, n = 1;
  while (used.has(name.toLowerCase())) name = `${stem}_${n++}.${ext}`;
  used.add(name.toLowerCase());
  return name;
}

// Try each candidate (best first) until one downloads and is really an image.
async function fetchBest(urls) {
  let lastErr;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const blob = await r.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not an image (" + blob.type + ")");
      return { url: u, blob };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

$("go").onclick = async () => {
  let dir;
  try { dir = await window.showDirectoryPicker({ mode: "readwrite" }); }
  catch { return; }

  $("go").disabled = true;
  $("bar").hidden = false;
  $("bar").max = groups.length;
  const used = new Set();
  let ok = 0, fail = 0;

  for (let i = 0; i < groups.length; i++) {
    try {
      const { url, blob } = await fetchBest(groups[i]);
      const name = makeName(url, blob.type, used);
      const fh = await dir.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      ok++;
      log("✓ " + name);
    } catch (e) {
      fail++;
      log("✗ " + groups[i][0].slice(0, 90) + " — " + e.message);
    }
    $("bar").value = i + 1;
    $("status").textContent = `Saved ${ok} of ${groups.length}` + (fail ? ` (${fail} failed)` : "");
  }
  $("status").textContent = `Done: ${ok} saved, ${fail} failed.`;
  $("go").disabled = false;
};
