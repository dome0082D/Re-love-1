import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar' // ← Importiamo il nuovo menu

export const metadata: Metadata = {
  title: 'Materiali - Vendi, Compra, Regala',
  description: 'Il marketplace dedicato ai materiali. Trova il nuovo, l\'usato o oggetti in regalo vicino a te.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="bg-stone-50 text-stone-900 font-sans antialiased min-h-screen flex flex-col">
        
        {/* IL NOSTRO NUOVO MENU DI NAVIGAZIONE COMPARES IN TUTTE LE PAGINE */}
        <Navbar />
        
        {/* IL CONTENUTO SPECIFICO DI OGNI PAGINA (Vetrina, Profilo, Annunci, ecc.) */}
        <main className="flex-grow">
          {children}
        </main>

      </body>
    </html>
  )
}