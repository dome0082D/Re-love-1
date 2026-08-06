import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  id: string
  title: string
  price: number
  // FIX: la Navbar legge l'immagine come "imageUrl", ma qui il campo era
  // dichiarato solo come "image_url" (il nome usato dal database). Risultato:
  // nel carrello ogni prodotto mostrava SEMPRE il segnaposto /usato.png,
  // mai la foto vera. Ora accettiamo entrambe le forme e la funzione
  // addItem qui sotto le allinea da sola, così funziona comunque sia
  // scritto il codice che aggiunge al carrello.
  image_url?: string
  imageUrl?: string
  quantity: number
  // FIX: la Navbar usa "maxQuantity" per non far superare i pezzi
  // disponibili, ma non era mai stato dichiarato qui - quindi TypeScript non
  // lo conosceva e la Navbar era costretta a forzarlo con "as any".
  maxQuantity?: number
}

interface CartStore {
  items: CartItem[]
  isCartOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
}

// Storage a prova di WebView: stessa protezione già usata in lib/supabase.ts.
// I browser in-app di Instagram/Facebook/TikTok su Android bloccano spesso
// localStorage: senza questo controllo, il carrello manderebbe in errore
// l'app all'avvio invece di limitarsi a non ricordare gli acquisti.
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Silenzioso di proposito: non poter salvare il carrello è un
      // fastidio, non un motivo per interrompere l'acquisto in corso.
    }
  },
  removeItem: (name: string): void => {
    try {
      window.localStorage.removeItem(name)
    } catch {}
  },
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      isCartOpen: false,
      openCart: () => set({ isCartOpen: true }),
      closeCart: () => set({ isCartOpen: false }),
      addItem: (item) => set((state) => {
        // Allinea i due nomi possibili dell'immagine, così chi legge il
        // carrello trova sempre valorizzati entrambi i campi.
        const immagine = item.imageUrl || item.image_url
        const normalizzato: CartItem = {
          ...item,
          image_url: immagine,
          imageUrl: immagine,
        }

        const existingItem = state.items.find((i) => i.id === item.id)
        if (existingItem) {
          // FIX: prima si sommava la quantità senza NESSUN limite - tornando
          // sull'annuncio e premendo "aggiungi" più volte si potevano mettere
          // nel carrello 10 pezzi di un oggetto che ne ha 2 disponibili,
          // scoprendolo solo al pagamento (o peggio, mai).
          const tetto = normalizzato.maxQuantity ?? existingItem.maxQuantity
          const nuovaQuantita = existingItem.quantity + item.quantity
          return {
            items: state.items.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    ...normalizzato,
                    quantity: tetto ? Math.min(nuovaQuantita, tetto) : nuovaQuantita,
                  }
                : i
            ),
          }
        }
        return { items: [...state.items, normalizzato] }
      }),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map((i) => {
          if (i.id !== id) return i
          // Il limite minimo (1) c'era già; ora rispettiamo anche il massimo
          // disponibile, quando lo conosciamo.
          const limitata = i.maxQuantity
            ? Math.min(Math.max(1, quantity), i.maxQuantity)
            : Math.max(1, quantity)
          return { ...i, quantity: limitata }
        })
      })),
      clearCart: () => set({ items: [] }),
    }),
    {
      // FIX: prima il carrello viveva solo in memoria - bastava ricaricare
      // la pagina, tornare indietro col tasto del telefono o riaprire l'app
      // per perdere tutto quello che si era messo dentro. Su un marketplace
      // è la strada più diretta per perdere una vendita già decisa.
      name: 'relove-cart',
      storage: createJSONStorage(() => safeStorage),
      // Salviamo solo gli articoli: se il carrello era APERTO al momento
      // della chiusura, non ha senso ritrovarselo spalancato al ritorno.
      partialize: (state) => ({ items: state.items }),
      // Il ripristino non parte da solo (vedi sotto il perché).
      skipHydration: true,
    }
  )
)

// Il ripristino del carrello salvato avviene qui, un attimo DOPO il primo
// disegno della pagina. Se avvenisse subito, il server (che non può leggere
// il salvataggio del browser) genererebbe una pagina con carrello vuoto
// mentre il browser ne mostrerebbe uno pieno: React se ne accorge e segnala
// un errore di disallineamento. Rimandandolo di un istante, entrambi
// partono da vuoto e il carrello si riempie subito dopo, senza conflitti.
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useCartStore.persist.rehydrate()
  }, 0)
}