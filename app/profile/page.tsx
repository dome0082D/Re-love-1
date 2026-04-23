'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ProfileContent() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(false)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({ first_name: '', last_name: '', city: '', full_address: '' })
  const [saving, setSaving] = useState(false)

  // LE TUE VETRINE ORIGINALI
  const [myAds, setMyAds] = useState<any[]>([])
  const [soldAds, setSoldAds] = useState<any[]>([])
  const [boughtAds, setBoughtAds] = useState<any[]>([])
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOnboardingSuccess = searchParams.get('onboarding') === 'success'

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

    // --- CARICAMENTO ANNUNCI E ACQUISTI (LA TUA LOGICA ORIGINALE) ---
    const { data: ads } = await supabase
      .from('announcements')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })

    if (ads) {
      setMyAds(ads.filter(a => (a.quantity !== undefined ? a.quantity : 1) > 0))
      setSoldAds(ads.filter(a => (a.quantity !== undefined ? a.quantity : 1) <= 0))
    }

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
      alert("Tutti i campi sono obbligatori.")
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
      alert("Errore salvataggio: " + error.message)
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
        window.location.href = data.url
      } else {
        alert("Errore Stripe: " + data.error)
      }
    } catch (err) {
      alert("Errore collegamento Stripe.")
    } finally {
      setStripeLoading(false)
    }
  }

  async function handleDelete(e: any, id: string) {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("Vuoi davvero eliminare questo annuncio?")) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (!error) {
      setMyAds(myAds.filter(a => a.id !== id));
      setSoldAds(soldAds.filter(a => a.id !== id));
    }
  }

  // IL TUO RENDERGRID ORIGINALE CON STILE RE-LOVE
  const renderGrid = (items: any[], emptyMessage: string, isOwner: boolean = false) => {
    if (items.length === 0) return <p className="text-[10px] font-bold text-stone-400 italic py-4">{emptyMessage}</p>
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map(ann => (
          <div key={ann.id} className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm flex flex-col hover:border-rose-300 transition-all">
            <Link href={`/announcement/${ann.id}`} className="aspect-square bg-stone-50 relative block overflow-hidden">
              <img src={ann.image_url || "/usato.png"} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" alt={ann.title} />
            </Link>
            <div className="p-3 flex flex-col justify-between flex-grow">
               <div>
                  <h4 className="text-[10px] font-black uppercase truncate text-stone-800">{ann.title}</h4>
                  <p className="text-xs font-black text-rose-500 mt-1">
                    {ann.price === 0 ? 'GRATIS' : `€ ${ann.price}`}
                  </p>
               </div>
               {isOwner ? (
                 <div className="mt-3 grid grid-cols-2 gap-2">
                   <Link href={`/edit/${ann.id}`} className="text-center bg-stone-100 text-stone-600 text-[8px] font-black uppercase py-2 rounded-lg hover:bg-stone-900 hover:text-white transition-all">
                     ✏️ Modifica
                   </Link>
                   <button onClick={(e) => handleDelete(e, ann.id)} className="bg-stone-50 text-rose-500 text-[8px] font-black uppercase py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                     🗑️ Elimina
                   </button>
                 </div>
               ) : (
                 <Link href={`/announcement/${ann.id}`} className="mt-3 block text-center w-full bg-stone-50 text-stone-800 text-[9px] font-black uppercase py-2 rounded-lg hover:bg-stone-900 hover:text-white transition-all">
                   Vedi Dettagli
                 </Link>
               )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-stone-400">Caricamento...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 font-sans text-stone-900 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* DATI PERSONALI (CON TUA FUNZIONE EDITING) */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400">Il mio profilo</h1>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-rose-500 transition-colors">Modifica</button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setIsEditing(false)} className="text-[10px] font-black uppercase text-stone-400">Annulla</button>
                <button onClick={saveProfile} disabled={saving} className="text-[10px] font-black uppercase bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-rose-500 transition-all">{saving ? '...' : 'Salva'}</button>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Nome</p>
                    <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Cognome</p>
                    <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Città</p>
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({...editForm, city: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Indirizzo completo</p>
                  <input type="text" value={editForm.full_address} onChange={(e) => setEditForm({...editForm, full_address: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Nome e Cognome</p>
                  <p className="text-sm font-bold uppercase italic">{profile?.first_name} {profile?.last_name}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-stone-800 lowercase">{user?.email}</p>
                    <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-emerald-100">✓ Verificata</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Città</p>
                  <p className="text-sm font-bold uppercase italic">{profile?.city || 'Non specificata'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Indirizzo</p>
                  <p className="text-sm font-bold uppercase italic truncate">{profile?.full_address || 'Non specificato'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STRIPE SECTION */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm">
          <h2 className="text-lg font-black uppercase italic text-stone-900 mb-2">Ricezione pagamenti</h2>
          {(isOnboardingSuccess || profile?.stripe_account_id) ? (
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-4 mt-2">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Portafoglio Collegato</p>
                <p className="text-[11px] text-emerald-600 font-bold italic">Sei pronto a ricevere pagamenti reali.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-stone-500 mb-6 italic">Configura Stripe per incassare i soldi delle tue vendite.</p>
              <button onClick={handleStripeOnboarding} disabled={stripeLoading} className="w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl hover:scale-[1.02] transition-all shadow-md">
                {stripeLoading ? 'Connessione in corso...' : 'Attiva ricezione pagamenti'}
              </button>
            </>
          )}
        </div>

        {/* PULSANTI RAPIDI */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm text-center flex flex-col items-center justify-center group cursor-pointer hover:border-rose-300 transition-all">
            <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📦</span>
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">I miei acquisti</p>
          </div>
          <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm text-center flex flex-col items-center justify-center group cursor-pointer hover:border-rose-300 transition-all">
            <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">❤️</span>
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">I miei preferiti</p>
          </div>
        </div>

        {/* VETRINA ANNUNCI IN VENDITA */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full"></span> IN VENDITA
          </h2>
          {renderGrid(myAds, "Non hai ancora inserito nessun annuncio.", true)}
        </div>

        {/* VETRINA OGGETTI ACQUISTATI */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-400 rounded-full"></span> OGGETTI ACQUISTATI
          </h2>
          {renderGrid(boughtAds, "Non hai ancora effettuato acquisti.", false)}
        </div>

      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-black uppercase text-stone-400 text-xs tracking-widest animate-pulse">Re-love sta arrivando...</div>}>
      <ProfileContent />
    </Suspense>
  )
}