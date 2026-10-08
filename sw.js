/* ============================================================
   ЗАЛ — service worker
   Стратегия: сначала сеть, кеш только как запасной вариант.
   Это значит, что при каждом открытии ты получаешь свежую версию,
   а офлайн-режим работает как раньше.
   ============================================================ */
var VERSION = 'zal-v19';
var CACHE = VERSION + '-cache';

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(['./','./index.html']).catch(function(){});
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function(e){
  if(e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);

  // шрифты и внешние адреса — не трогаем, только кэшируем
  if(url.origin !== self.location.origin){
    e.respondWith(
      caches.open(CACHE).then(function(c){
        return c.match(req).then(function(hit){
          var net = fetch(req).then(function(res){
            if(res && res.status === 200) c.put(req, res.clone());
            return res;
          }).catch(function(){ return hit });
          return hit || net;
        });
      })
    );
    return;
  }

  // свой контент: сеть вперёд, кеш — только если сеть не ответила
  e.respondWith(
    fetch(req,{cache:'reload'}).then(function(res){
      if(res && res.status === 200 && res.type === 'basic'){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy) });
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});