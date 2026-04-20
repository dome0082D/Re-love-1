import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'LIBERO SCAMBIO - Il tuo Marketplace professionale',
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
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  )
}
