import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Script from 'next/script'
import RealtimeNotifications from '@/components/RealtimeNotifications'
import { Toaster } from 'sonner' // <-- ECCO L'IMPORTAZIONE DEI TOAST ELEGANTI!

// FIX: senza metadataBase, Next.js risolve gli URL relativi nelle immagini
// di Open Graph (es. openGraph.images: ['/usato.png'] nelle pagine annuncio)
// usando "http://localhost:3000" come base ANCHE IN PRODUZIONE - le anteprime
// dei link condivisi su WhatsApp, Instagram, Telegram risultavano quindi
// rotte per chiunque non avesse un'immagine caricata. Il try/catch evita che
// una NEXT_PUBLIC_SITE_URL impostata male (es. senza "https://") mandi in
// crash l'intera app al build.
// IMPORTANTE: imposta la variabile d'ambiente NEXT_PUBLIC_SITE_URL su Vercel
// con il tuo dominio reale (es. https://re-love.it) - quello qui sotto è
// solo un valore di fallback segnaposto.
function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'https://re-love.vercel.app'
  try {
    return new URL(raw)
  } catch {
    return new URL('https://re-love.vercel.app')
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: 'Re-love - Dai nuova vita all\'usato',
  description: 'Il marketplace sostenibile per vendere e comprare.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#f43f5e',
  // FIX ANDROID: senza "cover", il browser calcola sempre a 0 le variabili
  // CSS "env(safe-area-inset-*)" - quelle che servono a sapere quanto spazio
  // occupano le barre di sistema del telefono (qui, la barra di navigazione
  // Android in basso: indietro/home/recenti). Con "cover" il sito può
  // disegnare fin sotto quelle barre, ma sa anche di quanto spazio si tratta
  // per spostare sopra i contenuti importanti (come i 5 pulsanti fissi).
  viewportFit: 'cover',
  // FIX ANDROID: senza questo, quando si apre la tastiera virtuale su Chrome
  // Android, gli elementi "fixed" (come la barra di invio messaggi nella
  // chat) restano ancorati all'altezza originale della pagina invece di
  // spostarsi sopra la tastiera - il campo di testo finisce nascosto
  // proprio dove serve di più, mentre si sta scrivendo. "resizes-content"
  // dice al browser di ridimensionare davvero il viewport quando la
  // tastiera compare, così il layout si adatta correttamente.
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  // Su Android, in modalità privata/incognito o con storage limitato,
                  // la registrazione può fallire silenziosamente: senza il .catch()
                  // l'errore risultava una unhandledrejection non gestita che alcuni
                  // WebView Android trattano come crash del contesto JS della pagina.
                  console.warn('Service worker non registrato:', err);
                });
              });
            }
          `}
        </Script>
      </head>
      {/* FIX: "bg-white" tolto da qui - uno sfondo solido sul body avrebbe
          coperto per intero il nuovo sfondo fisso qui sotto, rendendolo
          invisibile ovunque. Il colore di base per le pagine che NON
          personalizzano ancora il proprio sfondo è ora quello dietro
          l'immagine (vedi .site-fixed-background in globals.css). */}
      <body className="text-stone-900 font-sans antialiased min-h-screen flex flex-col relative">
        {/* SFONDO FISSO DEL SITO (vedi globals.css per i dettagli):
            resta fermo mentre la pagina scorre sopra di lui, su tutte le
            pagine. Nella Home, page.tsx aggiunge un pannello opaco che lo
            copre esclusivamente dietro l'hero, così lì non si vede. */}
        <div className="site-fixed-background" aria-hidden="true" />

        <Navbar />
        
        {/* IL NOSTRO MAGICO POPUP IN TEMPO REALE */}
        <RealtimeNotifications />
        
        <main className="flex-grow relative z-[1]">
          {children}
        </main>

        {/* IL COMPONENTE CHE GESTISCE LE NOTIFICHE A SCOMPARSA */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
