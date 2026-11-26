/* বাজারের তালিকা — offline cache + update handling.
   To release an update: upload the new files, and change the number below (bazar-v6 -> bazar-v6). */
var VERSION = "bazar-v6";
var CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-512-maskable.png"];

self.addEventListener("install", function (e) {
  // No skipWaiting here: a new version waits until the person taps "এখনই নিন" in the app.
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (e) {
  var d = e.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  else if (d.type === "VERSION" && e.source) e.source.postMessage({ type: "VERSION", v: VERSION });
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in background
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(VERSION).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (r) { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Pages: network first, fall back to the saved copy offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(VERSION).then(function (c) { c.put("index.html", copy); });
        return r;
      }).catch(function () { return caches.match("index.html"); })
    );
    return;
  }

  // Everything else on this site: saved copy first
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req); }));
});
