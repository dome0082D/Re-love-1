'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EditAnnouncementPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    price: 0,
    shippingCost: 0,
    quantity: 1,
    category: 'Altro / Varie',
    condition: 'Usato',
    description: '',
    address: ''
  })

  // Coordinate trovate a partire dall'indirizzo. Servono al Radar Zona e ai
  // segnaposti sulla Mappa: senza, l'annuncio resta invisibile a entrambi.
  const [coords, setCoords] = useState<{ lat: number; lng: number; city: string; label: string } | null>(null)
  const [geocoding, setGeocoding] = useState(false)

  useEffect(() => {
    async function fetchAnnouncement() {
      // 1. Controlla chi è loggato
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 2. Scarica i vecchi dati dell'annuncio
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single()

      // FIX: prima un errore di RETE e un annuncio DAVVERO inesistente
      // mostravano lo stesso identico messaggio "Annuncio non trovato" e
      // rimandavano subito al profilo - un semplice calo di connessione
      // (Android instabile) ti buttava fuori dalla modifica come se
      // l'annuncio non esistesse più, anche se esiste benissimo.
      if (error) {
        alert("Errore di connessione nel caricare l'annuncio. Riprova.")
        router.push('/profile')
        return
      }
      if (!data) {
        alert("Annuncio non trovato.")
        router.push('/profile')
        return
      }

      // 3. SICUREZZA: Solo il proprietario può modificare
      if (data.user_id !== currentUser.id) {
        alert("Non sei autorizzato a modificare questo annuncio.")
        router.push('/profile')
        return
      }

      // 4. Inserisce i vecchi dati nel modulo pronti per essere cambiati
      setFormData({
        title: data.title || '',
        price: data.price || 0,
        shippingCost: data.shipping_cost || 0,
        quantity: data.quantity !== undefined ? data.quantity : 1,
        category: data.category || 'Altro / Varie',
        condition: data.condition || 'Usato',
        description: data.description || '',
        address: data.address || ''
      })
      
      setLoading(false)
    }
    
    if (id) fetchAnnouncement()
  }, [id, router])

  // Cerca le coordinate dell'indirizzo. Stesso servizio usato nella pagina
  // "Inserisci Annuncio": qui serve per dare una posizione anche agli
  // annunci pubblicati PRIMA che il campo indirizzo esistesse, senza
  // doverli ripubblicare da zero.
  async function handleCercaIndirizzo() {
    if (!formData.address.trim()) {
      alert('Scrivi prima un indirizzo.')
      return
    }
    setGeocoding(true)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: formData.address.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        alert(data.error || 'Indirizzo non trovato.')
        setCoords(null)
        return
      }
      setCoords({ lat: data.latitude, lng: data.longitude, city: data.city, label: data.displayName })
    } catch (err) {
      console.error('Errore geocodifica:', err)
      alert('Errore di connessione. Riprova.')
      setCoords(null)
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSave(e: any) {
    e.preventDefault()
    setSaving(true)

    // FIX: aggiunto try/catch - senza, un fallimento di rete durante il
    // salvataggio (non solo un errore restituito da Supabase, ma
    // un'eccezione vera e propria) lasciava "Salva Modifiche" bloccato su
    // "Salvataggio..." per sempre.
    try {
      // 5. Salva i nuovi dati sovrascrivendo i vecchi
      const { error } = await supabase
        .from('announcements')
        .update({
          title: formData.title,
          price: formData.price,
          shipping_cost: formData.shippingCost,
          quantity: formData.quantity,
          category: formData.category,
          condition: formData.condition,
          description: formData.description,
          address: formData.address.trim() || null,
          // Se l'utente ha cercato un nuovo indirizzo usiamo quelle
          // coordinate; altrimenti lasciamo intatte quelle già salvate
          // (non le azzeriamo per sbaglio modificando solo il titolo).
          ...(coords ? { city: coords.city, latitude: coords.lat, longitude: coords.lng } : {})
        })
        .eq('id', id)
        .eq('user_id', user.id) // Doppia sicurezza

      if (error) {
        alert("Errore durante il salvataggio: " + error.message)
        return
      }

      alert("Annuncio aggiornato con successo!")
      router.push('/profile') // Torna al profilo
    } catch (err: any) {
      console.error('Errore salvataggio annuncio:', err)
      alert("Errore di connessione. Riprova.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 text-center font-black uppercase text-xs text-stone-500">Caricamento annuncio...</div>

  return (
    <div className="min-h-screen p-6 font-sans text-stone-900 pb-20 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
        
        <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
          <h1 className="text-2xl font-black uppercase italic text-stone-900">Modifica Annuncio</h1>
          <Link href="/profile" className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">
            ← Annulla
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Titolo dell'oggetto *</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 flex justify-between">
                Prezzo (€) *
                <span className="text-rose-500">-10% Comm.</span>
              </label>
              <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Quantità Disponibile *</label>
              <input required type="number" min="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Spese di Spedizione (€)</label>
              <input type="number" step="0.10" min="0" value={formData.shippingCost} onChange={e => setFormData({...formData, shippingCost: parseFloat(e.target.value) || 0})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" placeholder="0.00 (Gratis)" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Tu Guadagni (sul prezzo)</label>
              <div className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-black text-emerald-700 flex items-center h-[46px]">
                € {(Number(formData.price) * 0.90).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* FIX: queste voci non corrispondevano alle categorie usate nel
                  resto del sito (i filtri della Home) - un annuncio con una
                  categoria "vera" (es. "Elettronica e Informatica") non
                  trovava corrispondenza qui, il menu ricadeva sulla prima
                  voce senza avviso, e salvando la categoria veniva
                  silenziosamente cambiata. Allineate alla lista reale. */}
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Categoria</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                <option value="Abbigliamento e Accessori">👕 Abbigliamento e Accessori</option>
                <option value="Elettronica e Informatica">💻 Elettronica e Informatica</option>
                <option value="Casa, Arredamento e Giardino">🛋️ Casa, Arredo, Giardino</option>
                <option value="Alimentari e Bevande">🍎 Alimentari e Bevande</option>
                <option value="Libri, Film e Musica">📚 Libri, Film e Musica</option>
                <option value="Salute e Bellezza">💄 Salute e Bellezza</option>
                <option value="Sport e Tempo Libero">⚽ Sport e Tempo Libero</option>
                <option value="Motori e Veicoli">🚗 Motori e Veicoli</option>
                <option value="Altro / Varie">📦 Altro / Varie</option>
              </select>
            </div>
            <div>
              {/* FIX: mancavano "Regalo" e "Baratto" - modificare un annuncio
                  con una di queste due condizioni lo avrebbe silenziosamente
                  trasformato in "Nuovo" al salvataggio, con tutto quello che
                  ne consegue (un regalo che improvvisamente mostra un prezzo
                  invece di "Gratis" nel resto del sito). */}
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Condizione</label>
              <select value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                <option value="Nuovo">✨ Nuovo</option>
                <option value="Usato">♻️ Usato</option>
                <option value="Regalo">🎁 In Regalo</option>
                <option value="Baratto">🤝 Baratto</option>
              </select>
            </div>
          </div>

          <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">
              Dove si trova l&apos;oggetto? (Via e Citt&agrave;)
            </label>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-2">
              Serve per il Radar Zona e per comparire sulla mappa
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Es. Via Roma 12, Milano"
                value={formData.address}
                onChange={e => { setFormData({...formData, address: e.target.value}); setCoords(null) }}
                className="flex-1 p-4 bg-white border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleCercaIndirizzo}
                disabled={geocoding || !formData.address.trim()}
                className="shrink-0 bg-stone-900 text-white px-5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-40"
              >
                {geocoding ? '...' : 'Trova'}
              </button>
            </div>
            {coords && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">Nuova posizione</p>
                <p className="text-xs font-bold text-emerald-800 leading-snug">{coords.label}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Descrizione / Note</label>
            <textarea rows={5} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 resize-none"></textarea>
          </div>

          <button disabled={saving} type="submit" className="w-full bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest p-4 rounded-xl hover:bg-emerald-600 transition-colors mt-8 shadow-sm">
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </form>
      </div>
    </div>
  )
}
