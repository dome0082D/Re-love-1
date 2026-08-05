'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PublicProfilePage() {
  const { id } = useParams()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  
  // Stati per la form di recensione
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (id) fetchUserData()
  }, [id])

  async function fetchUserData() {
    setLoading(true)
    setLoadError(false)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    // Carica i dati pubblici del profilo
    const { data: prof, error: profError } = await supabase.from('profiles').select('first_name, city, average_rating, total_reviews').eq('id', id).single()

    // FIX: prima un errore di RETE nel caricare il profilo mostrava "Utente
    // non trovato" - la stessa identica pagina di chi visita un profilo
    // davvero inesistente. Un semplice calo di connessione (Android
    // instabile) affermava falsamente che quella persona non esiste.
    if (profError) {
      console.error('Errore caricamento profilo:', profError)
      setLoadError(true)
      setLoading(false)
      return
    }
    if (prof) setProfile(prof)

    // Carica gli annunci di questo utente
    const { data: ads } = await supabase.from('announcements').select('*').eq('user_id', id).order('created_at', { ascending: false })
    if (ads) setAnnouncements(ads)

    // FIX (SCHEMA): questa pagina leggeva le recensioni filtrando per
    // "receiver_id", ma le recensioni vere vengono create altrove (dopo un
    // acquisto, in app/dashboard/acquisti) con la colonna "reviewed_user_id"
    // - nomi diversi. Con "receiver_id" qui non sarebbe mai comparsa
    // nessuna delle recensioni lasciate nel modo normale.
    const { data: revs } = await supabase.from('reviews').select('*').eq('reviewed_user_id', id).order('created_at', { ascending: false })
    if (revs) setReviews(revs)

    setLoading(false)
  }

  async function handleSubmitReview(e: any) {
    e.preventDefault()
    if (!currentUser) { alert('Devi accedere per lasciare una recensione.'); return; }
    if (currentUser.id === id) { alert('Non puoi recensire te stesso.'); return; }

    setIsSubmitting(true)
    // FIX (SCHEMA): stesso problema del punto sopra, ma in scrittura - questa
    // funzione salvava la recensione con le colonne "author_id"/"receiver_id",
    // diverse da "reviewer_id"/"reviewed_user_id" usate ovunque altrove
    // nell'app per la stessa tabella. Con ogni probabilità il salvataggio
    // falliva subito perché quelle colonne non esistono davvero nel database;
    // anche nel caso esistessero, la recensione sarebbe stata invisibile
    // alla dashboard staff e al resto dell'app.
    // Aggiunto anche il try/catch - senza, un fallimento di rete lasciava
    // "Pubblica Recensione" bloccato per sempre su "Pubblicazione...".
    try {
      const { error } = await supabase.from('reviews').insert([{
        reviewer_id: currentUser.id,
        reviewed_user_id: id,
        rating: rating,
        comment: comment
      }])

      if (error) {
        alert('Errore: ' + error.message)
        return
      }

      alert('Recensione pubblicata con successo!')
      setComment('')
      setRating(5)
      // FIX: sostituito il ricaricamento completo della pagina (perdeva la
      // posizione di scroll e mostrava un flash bianco) con un semplice
      // ricaricamento dei soli dati, più fluido.
      fetchUserData()
    } catch (err: any) {
      console.error('Errore invio recensione:', err)
      alert('Errore di connessione. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <div className="p-10 font-black uppercase text-xs text-center">Caricamento profilo...</div>
  if (loadError) return (
    <div className="p-10 text-center">
      <p className="font-black uppercase text-xs text-red-500 mb-4">Errore di caricamento. Controlla la connessione.</p>
      <button onClick={fetchUserData} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
        Riprova
      </button>
    </div>
  )
  if (!profile) return <div className="p-10 font-black uppercase text-xs text-center text-red-500">Utente non trovato.</div>

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* INTESTAZIONE PROFILO PUBBLICO */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Profilo di {profile.first_name || 'Utente'}</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Di: {profile.city || 'Località Sconosciuta'}</p>
          </div>
          
          <div className="bg-stone-50 border border-stone-100 p-4 rounded-2xl text-center min-w-[150px] shadow-sm">
             <div className="text-xl font-black text-emerald-500 mb-1">
               {profile.average_rating > 0 ? `★ ${profile.average_rating}/5` : 'Nessun Voto'}
             </div>
             <p className="text-[9px] font-bold text-stone-400 uppercase">{profile.total_reviews} Recensioni Ricevute</p>
          </div>
        </div>

        {/* SEZIONE ANNUNCI */}
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Annunci di {profile.first_name || 'questo utente'}</h2>
        
        {announcements.length === 0 ? (
            <p className="text-sm font-bold text-stone-400 uppercase mb-12">Nessun annuncio attivo al momento.</p>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16">
              {announcements.map(ann => (
                <Link href={`/announcement/${ann.id}`} key={ann.id} className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm flex flex-col group hover:border-stone-400 transition-all">
                  <div className="h-32 bg-stone-50 relative border-b border-stone-100">
                    <img src={ann.image_url || "/usato.png"} className="w-full h-full object-cover" />
                    {ann.type === 'offered' && <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase shadow-sm">Regalo</span>}
                  </div>
                  <div className="p-3 flex flex-col flex-grow justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold uppercase truncate text-stone-800">{ann.title}</h4>
                        <p className="text-[13px] font-black mt-1 text-stone-900">{ann.type === 'offered' ? 'GRATIS' : `€ ${ann.price}`}</p>
                      </div>
                    <button className="mt-3 w-full bg-stone-50 text-stone-800 text-[9px] font-black uppercase py-2 rounded-lg group-hover:bg-stone-900 group-hover:text-white transition-colors">Vedi Dettagli</button>
                  </div>
                </Link>
              ))}
            </div>
        )}

        {/* SEZIONE RECENSIONI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Lascia una Recensione (Nascosta se è il proprio profilo) */}
            {currentUser && currentUser.id !== id && (
              <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
                <h2 className="text-lg font-black uppercase italic text-stone-900 mb-6">Lascia un Feedback</h2>
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase text-stone-400 block mb-2">Voto (da 1 a 5 stelle)</label>
                    <input type="range" min="1" max="5" value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full cursor-pointer accent-emerald-500" />
                    <div className="text-center text-xl text-emerald-500 mt-2">{'★'.repeat(rating)}{'☆'.repeat(5-rating)}</div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-stone-400 block mb-2">Il tuo commento</label>
                    <textarea required placeholder="Come ti sei trovato con questo utente?" value={comment} onChange={(e) => setComment(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none focus:border-stone-400 min-h-[100px]"></textarea>
                  </div>
                  <button disabled={isSubmitting} className="w-full bg-stone-900 text-white p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all shadow-md">
                    {isSubmitting ? 'Pubblicazione...' : 'Pubblica Recensione'}
                  </button>
                </form>
              </div>
            )}

            {/* Lista dei Feedback Ricevuti */}
            <div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Feedback Ricevuti</h2>
               {reviews.length === 0 ? (
                  <p className="text-sm font-bold text-stone-400 uppercase">Ancora nessuna recensione.</p>
               ) : (
                  <div className="space-y-4">
                    {reviews.map(rev => (
                      <div key={rev.id} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col">
                        <div className="text-emerald-500 text-lg mb-2 tracking-widest">{'★'.repeat(rev.rating)}{'☆'.repeat(5-rev.rating)}</div>
                        <p className="text-sm text-stone-700 italic">"{rev.comment}"</p>
                        <p className="text-[8px] font-black text-stone-300 uppercase mt-4">{new Date(rev.created_at).toLocaleDateString('it-IT')}</p>
                      </div>
                    ))}
                  </div>
               )}
            </div>
        </div>

        <div className="mt-16 text-center pt-8 border-t border-stone-200">
            <Link href="/" className="text-[10px] font-black uppercase text-stone-400 hover:text-stone-900 transition-colors">← Torna alla Vetrina Principale</Link>
        </div>
      </div>
    </div>
  )
}
