'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { srcFoto, srcSetFoto, fotoQuadrata } from '@/lib/immagini'

interface ProfileData {
  first_name?: string;
  last_name?: string;
  city?: string;
  full_address?: string;
  stripe_account_id?: string;
  nickname?: string;
  bio?: string;
  phone?: string;
  avatar_url?: string;
  latitude?: number;
  longitude?: number;
}

interface EditForm {
  first_name: string;
  last_name: string;
  city: string;
  full_address: string;
  nickname: string;
  bio: string;
  phone: string;
  avatar_url: string;
}

interface AdItem {
  id: string;
  title: string;
  price: number;
  image_url: string;
  quantity?: number;
  user_id?: string;
}

// Stripe elenca cio' che manca con nomi tecnici in inglese
// ("individual.verification.document"). Tradotti, perche' un utente non ha
// modo di capire cosa gli venga chiesto.
const RICHIESTE_STRIPE: Record<string, string> = {
  'individual.verification.document': "Documento d'identità",
  'individual.verification.additional_document': 'Un secondo documento',
  'individual.id_number': 'Codice fiscale',
  'individual.address.line1': 'Indirizzo di residenza',
  'individual.dob.day': 'Data di nascita',
  'individual.dob.month': 'Data di nascita',
  'individual.dob.year': 'Data di nascita',
  'individual.first_name': 'Nome',
  'individual.last_name': 'Cognome',
  'individual.phone': 'Numero di telefono',
  'individual.email': 'Indirizzo email',
  'external_account': 'IBAN su cui ricevere i pagamenti',
  'business_profile.url': 'Sito o profilo di vendita',
  'business_profile.mcc': 'Categoria di attività',
  'tos_acceptance.date': 'Accettazione delle condizioni Stripe',
  'tos_acceptance.ip': 'Accettazione delle condizioni Stripe',
}

function descriviRichiestaStripe(voce: string): string {
  if (RICHIESTE_STRIPE[voce]) return RICHIESTE_STRIPE[voce]
  // Voce non prevista: almeno la rendiamo leggibile invece di mostrarla grezza.
  return voce.split('.').pop()?.replace(/_/g, ' ') || voce
}

function ProfileContent() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(false)
  // null = verifica ancora in corso
  const [statoStripe, setStatoStripe] = useState<{
    collegato: boolean
    pronto: boolean
    mancante: string | null
    daCompletare?: string[]
    scadenza?: string | null
    inVerifica?: boolean
  } | null>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({ 
    first_name: '', last_name: '', city: '', full_address: '', 
    nickname: '', bio: '', phone: '', avatar_url: '' 
  })
  const [saving, setSaving] = useState(false)

  const [myAds, setMyAds] = useState<AdItem[]>([])
  const [soldAds, setSoldAds] = useState<AdItem[]>([])
  const [boughtAds, setBoughtAds] = useState<AdItem[]>([])
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOnboardingSuccess = searchParams.get('onboarding') === 'success'

  useEffect(() => {
    loadProfile()
    // Al rientro da Stripe (?onboarding=success) forziamo la rilettura: la
    // risposta appena messa in cache lato server sarebbe quella di prima
    // dell'attivazione, e mostrerebbe "incompleto" a chi ha appena finito.
    verificaStatoStripe(isOnboardingSuccess)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)

    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
    
    if (data) {
      setProfile(data as ProfileData)
      setEditForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        city: data.city || '',
        full_address: data.full_address || '',
        nickname: data.nickname || '',
        bio: data.bio || '',
        phone: data.phone || '',
        avatar_url: data.avatar_url || ''
      })
    }

    const { data: ads } = await supabase
      .from('announcements')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })

    if (ads) {
      const typedAds = ads as AdItem[]
      setMyAds(typedAds.filter(a => (a.quantity !== undefined ? a.quantity : 1) > 0))
      setSoldAds(typedAds.filter(a => (a.quantity !== undefined ? a.quantity : 1) <= 0))
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
      if (bought) {
        setBoughtAds(bought as AdItem[])
      }
    }

    setLoading(false)
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('avatars') 
      .upload(filePath, file)

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setEditForm({ ...editForm, avatar_url: publicUrl })
    } else {
      alert("Errore caricamento foto: " + uploadError.message)
    }
    setSaving(false)
  }

  async function getCoordinatesFromCity(city: string): Promise<{ lat: number, lon: number } | null> {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', Italy')}`)
      const data = await response.json()
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      }
      return null
    } catch (error) {
      console.error("Errore Geocoding:", error)
      return null
    }
  }

  async function saveProfile() {
    if (!editForm.nickname?.trim() || !editForm.first_name?.trim() || !editForm.last_name?.trim() || !editForm.city?.trim() || !editForm.full_address?.trim()) {
      alert("Nickname, Nome, Cognome, Città e Indirizzo sono obbligatori.")
      return
    }

    setSaving(true)
    try {
      let lat = null;
      let lon = null;
      if (editForm.city) {
        const coords = await getCoordinatesFromCity(editForm.city);
        if (coords) {
          lat = coords.lat;
          lon = coords.lon;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          nickname: editForm.nickname,
          bio: editForm.bio,
          phone: editForm.phone,
          avatar_url: editForm.avatar_url,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          city: editForm.city,
          full_address: editForm.full_address,
          latitude: lat,
          longitude: lon
        })
        .eq('id', user?.id)

      if (error) throw error
      
      setProfile({ ...profile, ...editForm, latitude: lat || undefined, longitude: lon || undefined })
      setIsEditing(false)
      if(lat && lon) {
          alert("Profilo aggiornato! La tua città è stata posizionata sul Radar. 📍")
      } else {
          alert("Profilo aggiornato! (Non è stato possibile mappare esattamente la città sul Radar)")
      }

    } catch (error: unknown) { 
      const err = error as Error
      alert("Errore salvataggio: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Chiede al server lo stato REALE del conto Stripe (charges_enabled e
  // payouts_enabled), invece di dedurlo dalla presenza di stripe_account_id.
  // "forza" serve al rientro da Stripe: senza, si leggerebbe la risposta
  // ancora in cache di pochi secondi prima, quando il conto non era attivo.
  async function verificaStatoStripe(forza = false) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch('/api/stripe/account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ forza }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setStatoStripe({ collegato: false, pronto: false, mancante: data.error || 'Verifica non riuscita.' })
        return
      }
      setStatoStripe({
        collegato: !!data.collegato,
        pronto: !!data.pronto,
        mancante: data.mancante || null,
        daCompletare: data.daCompletare || [],
        scadenza: data.scadenza || null,
        inVerifica: !!data.inVerifica,
      })
    } catch (err) {
      console.error('Errore verifica conto Stripe:', err)
      setStatoStripe({ collegato: false, pronto: false, mancante: 'Verifica non riuscita.' })
    }
  }

  async function handleStripeOnboarding() {
    setStripeLoading(true)
    try {
      const res = await fetch('/api/stripe/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, email: user?.email })
      })
      const data = await res.json()
      if (data.giaPronto) {
        // Il conto risultava già abilitato: niente da riprendere.
        await verificaStatoStripe(true)
        setStripeLoading(false)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert("Errore Stripe: " + data.error)
      }
    } catch (err) {
      console.error(err)
      alert("Errore collegamento Stripe.")
    } finally {
      setStripeLoading(false)
    }
  }

  // FIX: qui l'eliminazione era riservata alla sola email dello staff. Ma
  // questa griglia mostra I TUOI annunci, sul TUO profilo: il risultato era
  // che nessun utente poteva togliere un proprio annuncio da nessuna parte
  // del sito, e chi provava si sentiva rispondere "Solo lo staff può
  // cancellare gli annunci" sulla propria roba. Ora l'autore cancella i
  // propri, e controlliamo quante righe sono state davvero rimosse invece di
  // fidarci dell'assenza di errore.
  async function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;
    if (!window.confirm("Vuoi davvero eliminare questo annuncio? L'azione è definitiva.")) return;

    const { data, error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // non si tocca la roba di altri, nemmeno per sbaglio
      .select('id');

    if (error) {
      alert("Errore durante l'eliminazione: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert("L'annuncio non è stato eliminato. Ricarica la pagina e riprova.");
      return;
    }

    setMyAds(myAds.filter(a => a.id !== id));
    setSoldAds(soldAds.filter(a => a.id !== id));
  }

  const renderGrid = (items: AdItem[], emptyMessage: string, isOwner: boolean = false) => {
    if (items.length === 0) return <p className="text-[10px] font-bold text-stone-400 italic py-4">{emptyMessage}</p>
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((ann) => (
          <div key={ann.id} className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm flex flex-col hover:border-rose-300 transition-all">
            <Link href={`/announcement/${ann.id}`} className="aspect-square bg-stone-50 relative block overflow-hidden">
              <img loading="lazy" decoding="async" src={fotoQuadrata(ann.image_url, 400).src || "/usato.png"} srcSet={fotoQuadrata(ann.image_url, 400).srcSet} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" alt={ann.title} />
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
                   {/* Il pulsante compariva solo all'email dello staff: sul
                       proprio profilo, l'autore non poteva togliere i propri
                       annunci. Ora lo vede chi li ha pubblicati. */}
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
        
        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-8 border-b border-stone-100 pb-4">
            <h1 className="text-2xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400">Il mio profilo</h1>
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-rose-500 transition-colors bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-100">Modifica Dati</button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setIsEditing(false)} className="text-[10px] font-black uppercase text-stone-400 hover:bg-stone-50 px-3 py-1.5 rounded-lg">Annulla</button>
                <button onClick={saveProfile} disabled={saving} className="text-[10px] font-black uppercase bg-stone-900 text-white px-4 py-2 rounded-xl hover:bg-rose-500 transition-all shadow-md">{saving ? '...' : 'Salva'}</button>
              </div>
            )}
          </div>

          {/* Il tuo id utente. Non serve per candidarsi come curatore (lì
              basta il pulsante: il sito sa già chi sei), ma è l'unico modo
              di farsi identificare senza ambiguità quando si scrive
              all'assistenza o ci si accorda a voce con qualcuno. */}
          {user?.id && (
            <div className="mb-6 bg-stone-50 border border-stone-200 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-2">Il tuo id utente</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 min-w-0 font-mono text-[11px] font-bold text-stone-700 break-all select-all bg-white border border-stone-200 rounded-lg px-3 py-2">
                  {user.id}
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(user.id)
                      toast.success('Id copiato.')
                    } catch {
                      // Negli appunti non si può sempre scrivere (navigazione
                      // privata, browser dentro le app): mostrarlo è meglio
                      // che non fare niente.
                      window.prompt('Copia il tuo id utente:', user.id)
                    }
                  }}
                  className="shrink-0 bg-stone-900 text-white px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all"
                >
                  Copia
                </button>
              </div>
            </div>
          )}

          {/* NUOVO: riquadro fisso ben visibile, richiesto esplicitamente -
              sempre nel flusso normale della pagina (mai "absolute"), con
              margine proprio sopra e sotto, quindi non si sovrappone mai a
              nessun campo o pulsante, su nessuna risoluzione. */}
          <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-2xl px-5 py-4 mb-6">
            <p className="text-xs font-black uppercase tracking-widest text-rose-700">
              📋 Inserire i propri dati
            </p>
            <p className="text-[10px] font-bold text-stone-600 mt-1 leading-relaxed">
              Nickname, città e indirizzo sono obbligatori per poter vendere e ricevere pacchi correttamente.
            </p>
          </div>

          <div className="space-y-6">
            {isEditing ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 border-b border-stone-100 pb-6">
                  <div className="w-16 h-16 bg-stone-100 rounded-full overflow-hidden relative group shadow-sm flex-shrink-0">
                    <img loading="lazy" decoding="async" src={editForm.avatar_url || `https://ui-avatars.com/api/?name=${editForm.nickname || 'U'}`} className="w-full h-full object-cover" alt="avatar" />
                    <label className="absolute inset-0 bg-stone-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <span className="text-[8px] font-black text-white uppercase">Foto</span>
                      <input type="file" className="hidden" onChange={uploadAvatar} accept="image/*" />
                    </label>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[8px] font-black uppercase text-rose-500 ml-1">Nickname (Visibile a tutti)</p>
                    <input type="text" placeholder="Es: VintageLover99" value={editForm.nickname} onChange={(e) => setEditForm({...editForm, nickname: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Bio / A proposito di me</p>
                  <textarea value={editForm.bio} onChange={(e) => setEditForm({...editForm, bio: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400 min-h-[80px]" placeholder="Racconta chi sei agli acquirenti..." />
                </div>
                
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Telefono (Privato)</p>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm({...editForm, phone: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" placeholder="+39 ..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Nome Reale (Privato)</p>
                    <input type="text" value={editForm.first_name} onChange={(e) => setEditForm({...editForm, first_name: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Cognome Reale (Privato)</p>
                    <input type="text" value={editForm.last_name} onChange={(e) => setEditForm({...editForm, last_name: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Città (Viene usata per il Radar)</p>
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({...editForm, city: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" placeholder="Es: Milano, Roma..." />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black uppercase text-stone-400 ml-1">Indirizzo completo (Privato)</p>
                  <input type="text" value={editForm.full_address} onChange={(e) => setEditForm({...editForm, full_address: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-rose-400" />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-stone-100 rounded-full overflow-hidden border-2 border-stone-100 shadow-sm flex-shrink-0">
                    <img loading="lazy" decoding="async" src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.nickname || 'U'}`} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Nickname Pubblico</p>
                    <p className="text-xl font-black uppercase italic text-stone-900">{profile?.nickname || 'Non impostato'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-stone-100">
                  <div>
                    <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-stone-800 lowercase">{user?.email}</p>
                      <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-emerald-100">✓</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Telefono (Privato)</p>
                    <p className="text-sm font-bold uppercase italic">{profile?.phone || 'Non specificato'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1">Nome e Cognome (Privato)</p>
                    <p className="text-sm font-bold uppercase italic text-stone-600">{profile?.first_name} {profile?.last_name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1">Indirizzo di Spedizione (Privato)</p>
                    <p className="text-sm font-bold uppercase italic text-stone-600 truncate">{profile?.full_address || 'Non specificato'}</p>
                  </div>
                  <div className="md:col-span-2 flex justify-between items-center bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div>
                      <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Città Pubblica (Radar)</p>
                      <p className="text-sm font-bold uppercase italic">{profile?.city || 'Non specificata'}</p>
                    </div>
                    {profile?.latitude && profile?.longitude ? (
                       <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">📍 Su Mappa</span>
                    ) : (
                       <span className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Mappa Offline</span>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-1">Bio</p>
                    <p className="text-sm font-medium italic text-stone-500 bg-stone-50 p-4 rounded-xl border border-stone-100">{profile?.bio || 'Nessuna biografia inserita.'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FIX: qui bastava "?onboarding=success" nell'indirizzo, OPPURE la
            semplice presenza di stripe_account_id, per dichiarare
            "Sei pronto a ricevere pagamenti reali". Ma quell'id viene
            scritto sul profilo appena si preme il pulsante, prima ancora di
            vedere la prima schermata di Stripe: aprire Stripe e chiuderlo
            bastava a risultare abilitato senza aver inserito nulla. Ora lo
            stato viene chiesto a Stripe (charges_enabled / payouts_enabled)
            e ha tre esiti distinti: non collegato, iniziato ma incompleto,
            davvero pronto. */}
        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm">
          <h2 className="text-lg font-black uppercase italic text-stone-900 mb-2">Ricezione pagamenti</h2>

          {statoStripe === null ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 py-4 animate-pulse">
              Verifica del conto in corso...
            </p>
          ) : statoStripe.pronto ? (
            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-4 mt-2">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Portafoglio Collegato</p>
                <p className="text-[11px] text-emerald-600 font-bold italic">Sei pronto a ricevere pagamenti reali.</p>
              </div>
            </div>
          ) : statoStripe.collegato ? (
            <>
              <div className="bg-orange-50 border border-orange-200 p-6 rounded-[2rem] flex items-start gap-4 mt-2 mb-5">
                <span className="text-xl">{statoStripe.inVerifica ? '🔍' : '⏳'}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-orange-700 tracking-widest">
                    {statoStripe.inVerifica ? 'Verifica in corso' : 'Configurazione da completare'}
                  </p>
                  <p className="text-[11px] text-orange-700 font-bold italic mt-1">
                    {statoStripe.mancante || 'Stripe non ha ancora abilitato il tuo conto.'}
                  </p>

                  {/* NUOVO: il dettaglio di cosa manca davvero. Prima l'utente
                      leggeva solo "configurazione da completare" e non aveva
                      modo di sapere quali documenti Stripe stesse aspettando. */}
                  {statoStripe.daCompletare && statoStripe.daCompletare.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {statoStripe.daCompletare.slice(0, 6).map(voce => (
                        <li key={voce} className="text-[10px] font-bold text-orange-800 flex gap-2">
                          <span className="text-orange-400">•</span>
                          <span className="break-words">{descriviRichiestaStripe(voce)}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {statoStripe.scadenza && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mt-3">
                      Scadenza: {new Date(statoStripe.scadenza).toLocaleDateString('it-IT')}
                    </p>
                  )}

                  <p className="text-[10px] text-orange-600 font-bold mt-3">
                    Finché non è completata non puoi vendere né ricevere denaro.
                  </p>
                </div>
              </div>
              <button onClick={handleStripeOnboarding} disabled={stripeLoading} className="w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl hover:scale-[1.02] transition-all shadow-md">
                {stripeLoading ? 'Connessione in corso...' : 'Riprendi la configurazione'}
              </button>
              <button
                onClick={() => verificaStatoStripe(true)}
                className="w-full text-stone-400 font-black uppercase text-[9px] tracking-[0.2em] py-3 mt-2 hover:text-rose-500 transition-colors"
              >
                Ho appena finito su Stripe - ricontrolla
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-stone-500 mb-6 italic">Configura Stripe per incassare i soldi delle tue vendite.</p>
              <button onClick={handleStripeOnboarding} disabled={stripeLoading} className="w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl hover:scale-[1.02] transition-all shadow-md">
                {stripeLoading ? 'Connessione in corso...' : 'Attiva ricezione pagamenti'}
              </button>
            </>
          )}
        </div>

        {/* FIX: questi due riquadri avevano l'aspetto di pulsanti - cursore a
            manina, effetto al passaggio del mouse - ma NON erano collegati a
            niente: né Link né onClick. Toccarli non faceva assolutamente
            nulla. Ora portano davvero dove promettono. */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/dashboard/acquisti" className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm text-center flex flex-col items-center justify-center group hover:border-rose-300 transition-all">
            <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📦</span>
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">I miei acquisti</p>
          </Link>
          <Link href="/dashboard/preferiti" className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm text-center flex flex-col items-center justify-center group hover:border-rose-300 transition-all">
            <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">❤️</span>
            <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">I miei preferiti</p>
          </Link>
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-rose-500 rounded-full"></span> IN VENDITA
          </h2>
          {renderGrid(myAds, "Non hai ancora inserito nessun annuncio.", true)}
        </div>

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
