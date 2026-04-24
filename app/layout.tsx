import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Script from 'next/script'

// METADATI PER SEO E PWA
export const metadata: Metadata = {
  title: 'Re-love - LIBERO SCAMBIO',
  description: 'Il marketplace professionale dedicato ai materiali edili. Trova il nuovo, l\'usato o oggetti in regalo vicino a te.',
  manifest: '/manifest.json',
}

// COLORE DELLA BARRA DI STATO SU ANDROID
export const viewport: Viewport = {
  themeColor: '#059669',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
        {/* Script per registrare il Service Worker e attivare la PWA */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(registration) {
                  console.log('Re-love: Service Worker registrato con successo');
                }, function(err) {
                  console.log('Re-love: Registrazione Service Worker fallita: ', err);
                });
              });
            }
          `}
        </Script>
      </head>
      <body className="bg-stone-50 text-stone-900 font-sans antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  )
}