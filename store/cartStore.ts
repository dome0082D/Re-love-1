import { create } from 'zustand'

export interface CartItem {
  id: string
  title: string
  price: number
  image_url?: string
  quantity: number
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

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  isCartOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  addItem: (item) => set((state) => {
    const existingItem = state.items.find((i) => i.id === item.id)
    if (existingItem) {
      return {
        items: state.items.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
        ),
      }
    }
    return { items: [...state.items, item] }
  }),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i))
  })),
  clearCart: () => set({ items: [] }),
}))
