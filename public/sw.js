/* 糖糖地理通 Service Worker：装到主屏后离线也能打开刷题。
   整个应用是单文件（React/数据/样式全内联），所以只要缓存首页即可完全离线。
   策略：导航请求「网络优先，失败回退缓存」——联网时永远拿到最新，断网时用上次缓存。 */
const CACHE = "tangtang-dili-v1";
const SHELL = ["/", "/index.html"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () {})
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  // 打开/刷新页面：网络优先，成功则顺手更新缓存；断网回退到缓存的首页。
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put("/", copy); });
        return res;
      }).catch(function () {
        return caches.match("/").then(function (r) { return r || caches.match("/index.html"); });
      })
    );
    return;
  }

  // 其他同源 GET 资源：缓存优先，回退网络。
  e.respondWith(caches.match(req).then(function (r) { return r || fetch(req); }));
});
