const CACHE_NAME = 'relove-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
AGGIUNTA PER public/sw.js
==========================

Questo NON è un file completo - è il pezzo da aggiungere al service worker
che hai già (quello che rende il sito installabile come app). Non l'ho mai
visto per intero, quindi non te lo riscrivo da zero: rischierei di
cancellarti qualcosa che già funziona, come è già successo altre volte in
questa conversazione con file che non avevo davanti.

Apri public/sw.js e incolla questo blocco, fuori da qualunque altra
funzione già presente (alla fine del file va benissimo):


// ============================================================
// NOTIFICHE PUSH REALI - arrivano anche ad app chiusa o telefono bloccato
// ============================================================

// Scatta quando il server manda davvero una notifica (tramite
// /api/push/send). Senza questo gestore, l'iscrizione alle push
// funzionerebbe ma non succederebbe visivamente nulla quando arriva.
self.addEventListener('push', function (event) {
  let dati = { title: 'Re-love', body: 'Hai una nuova notifica.', url: '/' }
  try {
    if (event.data) dati = event.data.json()
  } catch (e) {
    // Se il contenuto non è JSON valido, usiamo il testo grezzo come corpo
    // invece di far fallire tutto silenziosamente.
    if (event.data) dati.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(dati.title || 'Re-love', {
      body: dati.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: dati.url || '/' },
    })
  )
})

// Scatta quando l'utente TOCCA la notifica: la chiude e apre (o riporta in
// primo piano) il sito, alla pagina giusta invece che sempre alla home.
self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Se il sito è già aperto in una scheda, la riusiamo invece di
      // aprirne una nuova - stessa esperienza di WhatsApp/Instagram.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})


Fatto questo, salva, e ricordati che un service worker aggiornato viene
davvero "adottato" dal browser solo dopo un ricaricamento completo (a volte
due) - se non vedi effetto subito su un dispositivo dove avevi già
installato l'app, disinstalla e reinstalla come abbiamo già fatto per la
barra nera.