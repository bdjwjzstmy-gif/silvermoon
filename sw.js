/* ============================================================
   银月冒险家协会 · Service Worker
   - 壳 precache：断网也能看历史页面
   - API 运行时缓存：stale-while-revalidate
   - 离线时返回降级页（demo 模式下 API 走 localStorage，本文件即兜底）
   ============================================================ */
const VERSION = 'smg-v1';
const SHELL = [
  '/',
  '/index.html',
  '/mobile.css',
  '/app.js',
  '/mobile.js',
  '/native-bridge.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/splash.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION + '-shell').then(function (c) {
      return c.addAll(SHELL.map(function (u) { return u; }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== VERSION + '-shell' && k !== VERSION + '-api') return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 降级页：API 走不通时给一个能用的壳 */
var FALLBACK = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"><title>银月公会 · 离线</title>' +
  '<style>body{font-family:-apple-system,"PingFang SC",sans-serif;background:#0a0814;color:#e9e6f5;' +
  'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}' +
  '.s{width:80px;height:80px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#5a4a8a,#2a2248);' +
  'border:2px solid #e8c86a;display:flex;align-items:center;justify-content:center;font-size:38px;margin-bottom:20px}' +
  'h1{color:#e8c86a;font-size:1.5rem;margin-bottom:10px}' +
  'p{color:#a89fd0;font-size:.95rem;max-width:420px;line-height:1.7}' +
  'button{margin-top:22px;background:#e8c86a;color:#201a3d;border:none;padding:12px 26px;border-radius:10px;font-size:1rem;font-weight:700}' +
  '</style></head><body><div class="s">月</div><h1>公会大厅暂时失联</h1>' +
  '<p>当前处于离线状态，已为你保留本地缓存内容。<br>恢复网络后会自动同步最新委托。</p>' +
  '<button onclick="location.reload()">重新连接</button></body></html>';

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* API 请求：stale-while-revalidate */
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      caches.open(VERSION + '-api').then(function (api) {
        return api.match(req).then(function (cached) {
          var net = fetch(req).then(function (res) {
            if (res && res.status === 200 && res.type === 'basic') {
              api.put(req, res.clone());
            }
            return res;
          }).catch(function () { return cached; });
          return cached || net.then(function (r) { return r; }).catch(function () {
            return new Response(FALLBACK, { headers: { 'Content-Type': 'text/html' } });
          });
        });
      })
    );
    return;
  }

  /* 静态资源 / 页面：cache-first */
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && (res.type === 'basic' || url.origin === self.location.origin)) {
          var c = caches.open(VERSION + '-shell');
          c.then(function (cache) { cache.put(req, res.clone()); });
        }
        return res;
      }).catch(function () {
        if (req.headers.get('accept') && req.headers.get('accept').indexOf('text/html') > -1) {
          return caches.match('/index.html').then(function (h) { return h || new Response(FALLBACK, { headers: { 'Content-Type': 'text/html' } }); });
        }
        return new Response('', { status: 504 });
      });
    })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
