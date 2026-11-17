// 首都高ナビ図：オフラインでも開けるようにするための仕組み（Service Worker）
// ファイルを更新して公開するときは VERSION を上げる（app.js の APP_VERSION も同じ値に）。
const VERSION = "v6";
const CACHE = "shuto-navi-" + VERSION;
const CORE = [
  "./", "index.html", "style.css", "theme.js", "data.js", "geo.js", "search.js", "app.js",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];
// 電波が弱いときに待つ最長時間。これを過ぎたら手元の控えを出す
const NET_TIMEOUT = 3000;

self.addEventListener("install", (e) => {
  // ブラウザの一時保存（最大10分）を通さず、必ずサーバーから最新を取る
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shuto-navi-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)); }

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  if (isFont) {
    // 文字の形（フォント）はめったに変わらないので、手元の控えを優先
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  // アプリのファイル：電波があれば最新（変わっていなければ確認だけで済む）、
  // 電波がない・弱いときは手元の控えを出す
  const key = req.mode === "navigate" ? "index.html" : req;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const network = fetch(req, { cache: "no-cache" }).then((res) => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    });
    try {
      return await Promise.race([network, timeout(NET_TIMEOUT)]);
    } catch (err) {
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) { e.waitUntil(network.catch(() => {})); return hit; }
      return network;
    }
  }));
});
