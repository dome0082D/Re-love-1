// public/sw.js
//
// FIX: questo file conteneva, dopo il codice, un intero blocco di testo in
// italiano ("AGGIUNTA PER public/sw.js ...") lasciato per errore. Per il
// browser non era un commento ma codice non valido: il service worker
// andava in errore di sintassi e non veniva MAI installato. Conseguenze
// reali: nessuna notifica push arrivava mai (nemmeno con le chiavi VAPID
// configurate), e l'app installata non aveva alcuna cache offline.
// Il blocco di istruzioni è stato rimosso e i due gestori che descriveva
// (push e notificationclick) sono stati incorporati qui sotto.

const CACHE_NAME = 'relove-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(['/']))
      // Se la home non è raggiungibile al momento dell'installazione, il
      // service worker deve installarsi lo stesso: senza questo .catch()
      // un singolo errore di rete impediva del tutto l'installazione (e
      // quindi anche le notifiche push, che dipendono da lui).
      .catch((err) => console.warn('[SW] Pre-cache non riuscita:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chiavi) =>
        Promise.all(chiavi.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // FIX: prima venivano intercettate TUTTE le richieste, comprese le POST
  // verso /api/... (pagamenti, offerte, messaggi). In caso di rete assente
  // il ripiego "caches.match" restituisce undefined, e un respondWith che
  // riceve undefined fa fallire la richiesta con un errore di rete opaco
  // invece del normale errore gestito dall'app. Intercettiamo solo le GET
  // dello stesso dominio, che sono le uniche che ha senso servire da cache.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(async () => {
      const daCache = await caches.match(request);
      if (daCache) return daCache;
      // Per una navigazione (apertura di una pagina) ripieghiamo sulla home
      // già in cache, così l'app installata mostra qualcosa invece della
      // schermata "sei offline" del browser.
      if (request.mode === 'navigate') {
        const home = await caches.match('/');
        if (home) return home;
      }
      return new Response('Contenuto non disponibile offline.', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })
  );
});

// ============================================================
// NOTIFICHE PUSH REALI - arrivano anche ad app chiusa o telefono bloccato
// ============================================================

// Scatta quando il server manda davvero una notifica (tramite
// /api/push/send). Senza questo gestore, l'iscrizione alle push
// funzionerebbe ma non succederebbe visivamente nulla quando arriva.
self.addEventListener('push', function (event) {
  let dati = { title: 'Re-love', body: 'Hai una nuova notifica.', url: '/' };
  try {
    if (event.data) dati = event.data.json();
  } catch (e) {
    // Se il contenuto non è JSON valido, usiamo il testo grezzo come corpo
    // invece di far fallire tutto silenziosamente.
    if (event.data) dati.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(dati.title || 'Re-love', {
      body: dati.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: dati.url || '/' },
    })
  );
});

// Scatta quando l'utente TOCCA la notifica: la chiude e apre (o riporta in
// primo piano) il sito, alla pagina giusta invece che sempre alla home.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Se il sito è già aperto in una scheda, la riusiamo invece di
      // aprirne una nuova - stessa esperienza di WhatsApp/Instagram.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
