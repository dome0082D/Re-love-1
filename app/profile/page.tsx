'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(false)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({ first_name: '', last_name: '', city: '', full_address: '' })
  const [saving, setSaving] = useState(false)

  // STATI PER LA VETRINA PERSONALE
  const [myAds, setMyAds] = useState<any[]>([])
  const [soldAds, setSoldAds] = useState<any[]>([])
  const [boughtAds, setBoughtAds] = useState<any[]>([])
  
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)

    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
    setProfile(data)
    
    if (data) {
      setEditForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        city: data.city || '',
        full_address: data.full_address || ''
      })
    }

    // --- CARICAMENTO ANNUNCI E ACQUISTI ---
    
    // 1. Prendi gli annunci creati da questo utente
    const { data: ads } = await supabase
      .from('announcements')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })

    if (ads) {
      setMyAds(ads.filter(a => (a.quantity !== undefined ? a.quantity : 1) > 0))
      setSoldAds(ads.filter(a => (a.quantity !== undefined ? a.quantity : 1) <= 0))
    }

    // 2. Prendi i MIEI ACQUISTI (interroga la tabella transactions)
    const { data: txs } = await supabase
      .from('transactions')
      .select('*')
      .eq('buyer_id', currentUser.id)

    if (txs && txs.length > 0) {
      const annIds = txs.map(t => t.announcement_id)
      const { data: bought } = await supabase
        .from('announcements')
        .select('*')
        .in('id', annIds)
      if (bought) setBoughtAds(bought)
    }

    setLoading(false)
  }

  async function saveProfile() {
    if (!editForm.first_name?.trim() || !editForm.last_name?.trim() || !editForm.city?.trim() || !editForm.full_address?.trim()) {
      alert("Tutti i campi sono obbligatori. Compila tutti i dati per salvare il profilo.")
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          city: editForm.city,
          full_address: editForm.full_address
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile({ ...profile, ...editForm })
      setIsEditing(false)
    } catch (error: any) {
      alert("Errore durante il salvataggio: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStripeOnboarding() {
    setStripeLoading(true)
    try {
      const res = await fetch('/api/stripe/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      })
      const data = await res.json()
      
      if (data.url) {
        // LA CORREZIONE È QUI: AGGIUNTO IL PUNTO INTERROGATIVO
        if (!profile?.stripe_account_id) { 
          await supabase.from('profiles').update({ stripe_account_id: data.accountId }).eq('id', user.id)
        }
        window.location.href = data.url
      } else {
        alert("Errore Stripe: " + data.error)
      }
    } catch (err) {
      console.error(err)
      alert("Errore durante il collegamento a Stripe.")
    } finally {
      setStripeLoading(false)
    }
  }

  // NUOVA FUNZIONE: ELIMINA ANNUNCIO
  async function handleDelete(e: any, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Vuoi davvero eliminare questo annuncio? L'operazione è irreversibile.")) return;
    
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      alert("Errore durante l'eliminazione: " + error.message);
    } else {
      // Aggiorna la vista eliminandolo istantaneamente dallo schermo
      setMyAds(myAds.filter(a => a.id !== id));
      setSoldAds(soldAds.filter(a => a.id !== id));
    }
  }

  if (loading) return <div className="p-10 text-center text-sm text-stone-500">Caricamento profilo...</div>

  // FUNZIONE GRAFICA PER DISEGNARE LE GRIGLIE
  const renderGrid = (items: any[], emptyMessage: string, isOwner: boolean = false) => {
    if (items.length === 0) return <p className="text-sm text-stone-500 italic px-2">{emptyMessage}</p>
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(ann => (
          <div key={ann.id} className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm flex flex-col relative hover:border-stone-400 transition-all">
            <Link href={`/announcement/${ann.id}`} className="aspect-square bg-stone-50 relative block group">
              <img src={ann.image_url || "/usato.png"} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" alt={ann.title} />
            </Link>
            <div className="p-3 flex flex-col justify-between flex-grow">
               <Link href={`/announcement/${ann.id}`} className="block">
                  <h4 className="text-[11px] font-bold uppercase truncate">{ann.title}</h4>
                  <p className="text-[13px] font-black mt-1">
                    {ann.type === 'offered' ? 'GRATIS' : `€ ${ann.price}`}
                  </p>
               </Link>
               
               {isOwner ? (
                 <div className="mt-3 grid grid-cols-2 gap-2">
                   {/* Tasto Modifica */}
                   <Link href={`/edit/${ann.id}`} className="text-center bg-stone-100 text-stone-600 text-[9px] font-black uppercase py-2 rounded-lg hover:bg-blue-500 hover:text-white transition-colors">
                     ✏️ Modifica
                   </Link>
                   {/* Tasto Elimina */}
                   <button onClick={(e) => handleDelete(e, ann.id)} className="w-full bg-stone-100 text-stone-600 text-[9px] font-black uppercase py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                     🗑️ Elimina
                   </button>
                 </div>
               ) : (
                 <Link href={`/announcement/${ann.id}`} className="mt-3 block text-center w-full bg-stone-50 text-stone-800 text-[9px] font-black uppercase py-2 rounded-lg hover:bg-stone-900 hover:text-white transition-colors">
                   Vedi Dettagli
                 </Link>
               )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans text-stone-900 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* INTESTAZIONE E DATI PERSONALI */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-stone-900"></div>
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-stone-900">Il mio profilo</h1>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)} 
                className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
              >
                Modifica
              </button>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  onClick={saveProfile} 
                  disabled={saving}
                  className="text-sm font-medium bg-stone-900 text-white px-4 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  {saving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            )}
          </div>
          
          <div className="space-y-5">
            {isEditing ? (
              /* MODALITÀ MODIFICA */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1">Nome *</p>
                    <input 
                      type="text" 
                      value={editForm.first_name} 
                      onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                      className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1">Cognome *</p>
                    <input 
                      type="text" 
                      value={editForm.last_name} 
                      onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                      className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-1">Email (Non modificabile)</p>
                  <input 
                    type="text" 
                    value={user?.email || ''} 
                    disabled 
                    className="w-full p-2 border border-stone-100 bg-stone-50 rounded-xl text-sm text-stone-400"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1">Città *</p>
                    <input 
                      type="text" 
                      value={editForm.city} 
                      onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                      className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1">Indirizzo completo *</p>
                    <input 
                      type="text" 
                      placeholder="Via, Civico, CAP"
                      value={editForm.full_address} 
                      onChange={(e) => setEditForm({...editForm, full_address: e.target.value})}
                      className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* MODALITÀ VISUALIZZAZIONE */
              <>
                <div>
                  <p className="text-xs font-medium text-stone-500">Nome e Cognome</p>
                  <p className="text-base">{profile?.first_name} {profile?.last_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500">Email di contatto</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-base">{user?.email}</p>
                    <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                      ✓ Verificata
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-stone-500">Città</p>
                    <p className="text-base capitalize">{profile?.city || 'Non specificata'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500">Indirizzo completo</p>
                    <p className="text-base capitalize">{profile?.full_address || 'Non specificato'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RICEZIONE PAGAMENTI STRIPE */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Ricezione pagamenti</h2>
          <p className="text-sm text-stone-500 mb-6">Per vendere oggetti e ricevere i soldi sul tuo conto, devi configurare il tuo portafoglio Stripe.</p>
          <button 
            onClick={handleStripeOnboarding} 
            disabled={stripeLoading}
            className="w-full bg-[#008953] text-white font-bold py-3 rounded-xl hover:bg-[#007044] transition-colors disabled:opacity-50"
          >
            {stripeLoading ? 'Connessione in corso...' : 'Attiva ricezione pagamenti'}
          </button>
        </div>

        {/* PULSANTI RAPIDI */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm text-center flex flex-col items-center justify-center">
            <span className="text-2xl block mb-2">📦</span>
            <p className="text-xs font-bold text-stone-700">I miei acquisti</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm text-center flex flex-col items-center justify-center">
            <span className="text-2xl block mb-2">❤️</span>
            <p className="text-xs font-bold text-stone-700">I miei preferiti</p>
          </div>
        </div>

        {/* IN VENDITA */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
            <span>💸</span> IN VENDITA
          </h2>
          {renderGrid(myAds, "Non hai ancora inserito nessun annuncio.", true)}
        </div>

        {/* OGGETTI ACQUISTATI */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-4 flex items-center gap-2">
            <span>🛍️</span> OGGETTI ACQUISTATI
          </h2>
          {renderGrid(boughtAds, "Non hai ancora effettuato nessun acquisto.", false)}
        </div>

      </div>
    </div>
  )
}
