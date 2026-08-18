'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import { ETICHETTE_STATO, STATI_CANDIDATURA, quotaProprietario, type StatoCandidatura } from '@/lib/candidature'

// ============================================================================
// CURATORE LOCALE
//
// Sostituisce la vecchia pagina dei "mandati di delega" col QR. Qui si vedono
// le due facce della stessa cosa:
//
//   - le candidature che HO INVIATO, per gestire la vendita di oggetti altrui;
//   - le candidature che HO RICEVUTO sui miei oggetti, da accettare o rifiutare.
//
// Tutte le scritture passano dalle route server, che verificano chi sta
// chiedendo dal token di sessione e rispondono con quante righe hanno
// davvero toccato. Leggendo e scrivendo dal browser, una policy RLS mancante
// non da' errore - PostgREST risponde "200 con zero righe" - e la pagina
// direbbe "fatto" senza che sia successo niente.
// ============================================================================

interface Candidatura {
  id: string
  stato: StatoCandidatura
  percentualeCuratore: number
  messaggio: string | null
  creataIl: string
  decisaIl: string | null
  annuncioId: string
  titolo: string
  prezzo: number | null
  immagine: string | null
  inArena: boolean
  curatoreId: string
  curatoreNome: string
  proprietarioId: string
  proprietarioNome: string
}

export default function CuratoreLocalePage() {
  const router = useRouter()
  const [inviate, setInviate] = useState<Candidatura[]>([])
  const [ricevute, setRicevute] = useState<Candidatura[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [inCorso, setInCorso] = useState<string | null>(null)

  async function token(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  async function carica() {
    const t = await token()
    if (!t) {
      router.push('/login?redirect=%2Fcuratore')
      return
    }
    setCaricamento(true)
    try {
      const res = await fetch('/api/curatore/elenco', { headers: { Authorization: `Bearer ${t}` } })
      const dati = await res.json()
      if (!res.ok || dati.error) {
        toast.error(dati.error || 'Errore nel caricamento.')
        return
      }
      setInviate(dati.inviate || [])
      setRicevute(dati.ricevute || [])
    } catch (err) {
      console.error('Errore caricamento candidature:', err)
      toast.error('Errore di connessione.')
    } finally {
      setCaricamento(false)
    }
  }

  useEffect(() => { carica() }, [])

  async function agisci(
    percorso: string,
    corpo: Record<string, unknown>,
    idRiga: string,
    messaggioRiuscito: string
  ) {
    const t = await token()
    if (!t) {
      toast.error('Sessione scaduta: rientra e riprova.')
      return
    }
    setInCorso(idRiga)
    try {
      const res = await fetch(percorso, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(corpo),
      })
      const dati = await res.json()
      if (!res.ok || dati.error) {
        toast.error(dati.error || 'Operazione non riuscita.')
        if (dati.requiresPayoutSetup) router.push('/profile')
        return
      }
      toast.success(messaggioRiuscito)
      await carica()
    } catch (err) {
      console.error('Errore azione candidatura:', err)
      toast.error('Errore di connessione.')
    } finally {
      setInCorso(null)
    }
  }

  const daRispondere = ricevute.filter(c => c.stato === STATI_CANDIDATURA.inAttesa)
  const attiveComeCuratore = inviate.filter(c => c.stato === STATI_CANDIDATURA.accettata)

  if (caricamento) {
    return (
      <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400 animate-pulse">
        Caricamento...
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-14 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">Curatore Locale</h1>
          <p className="text-stone-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">
            Vendi per altri, o fatti aiutare a vendere
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link href="/?cerca_curatore=1" className="bg-rose-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-900 transition-all shadow-md">
              Oggetti che cercano un curatore
            </Link>
            <Link href="/add" className="bg-stone-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 transition-all shadow-md">
              + Pubblica e cerca un curatore
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-10 space-y-14">

        {/* Spiegazione breve: senza, la pagina vuota non dice cosa fare. */}
        <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-6 md:p-8">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-stone-900 mb-4">Come funziona</h2>
          <ol className="space-y-2 text-xs font-bold text-stone-500 leading-relaxed list-decimal list-inside">
            <li>Chi ha un oggetto lo pubblica e spunta &ldquo;cerco un curatore&rdquo;, scegliendo che percentuale cedergli.</li>
            <li>Chi vuole occuparsene apre l&apos;oggetto e preme &ldquo;Candidati come curatore&rdquo;.</li>
            <li>Il proprietario accetta o rifiuta. Solo con l&apos;accettazione il curatore è autorizzato a gestire la vendita.</li>
            <li>A vendita conclusa l&apos;incasso si divide da solo: la quota del curatore, il resto al proprietario, meno il 10% di Re-love.</li>
          </ol>
          <p className="text-[10px] font-bold text-stone-400 mt-4 leading-relaxed">
            Gli oggetti in Arena si candidano solo dalla <Link href="/arena" className="text-rose-600 hover:underline">pagina Arena</Link>, dove sono spiegate le loro condizioni.
          </p>
        </div>

        {/* -------------------------------------------- RICEVUTE (decido io) */}
        <section>
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900 border-b border-stone-300 pb-4 mb-6 flex items-center gap-3">
            Candidature sui miei oggetti
            {daRispondere.length > 0 && (
              <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                {daRispondere.length}
              </span>
            )}
          </h2>

          {ricevute.length === 0 ? (
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center py-10">
              Nessuno si è ancora candidato sui tuoi oggetti.
            </p>
          ) : (
            <div className="space-y-3">
              {ricevute.map(c => (
                <RigaCandidatura
                  key={c.id}
                  c={c}
                  personaEtichetta="Si è candidato"
                  personaNome={c.curatoreNome}
                  occupato={inCorso === c.id}
                >
                  {c.stato === STATI_CANDIDATURA.inAttesa && (
                    <>
                      <button
                        onClick={() => agisci('/api/curatore/decidi', { candidaturaId: c.id, azione: 'accetta' }, c.id, 'Curatore accettato: ora può gestire la vendita.')}
                        disabled={inCorso === c.id}
                        className="bg-emerald-600 text-white text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        Accetta
                      </button>
                      <button
                        onClick={() => agisci('/api/curatore/decidi', { candidaturaId: c.id, azione: 'rifiuta' }, c.id, 'Candidatura rifiutata.')}
                        disabled={inCorso === c.id}
                        className="bg-stone-100 text-stone-600 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-stone-200 transition-all disabled:opacity-50"
                      >
                        Rifiuta
                      </button>
                    </>
                  )}
                  {c.stato === STATI_CANDIDATURA.accettata && (
                    <button
                      onClick={() => {
                        if (!confirm(`Vuoi revocare l'incarico di ${c.curatoreNome} per "${c.titolo}"? L'annuncio resta tuo e torna senza curatore.`)) return
                        agisci('/api/curatore/revoke', { candidaturaId: c.id }, c.id, 'Incarico revocato.')
                      }}
                      disabled={inCorso === c.id}
                      className="bg-rose-500/10 border border-rose-500/40 text-rose-600 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                    >
                      Revoca
                    </button>
                  )}
                </RigaCandidatura>
              ))}
            </div>
          )}
        </section>

        {/* ---------------------------------------------- INVIATE (mi candido) */}
        <section>
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900 border-b border-stone-300 pb-4 mb-6">
            Le mie candidature
            {attiveComeCuratore.length > 0 && (
              <span className="ml-3 text-[10px] text-emerald-600">{attiveComeCuratore.length} attive</span>
            )}
          </h2>

          {inviate.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Non ti sei ancora candidato per nessun oggetto.</p>
              <Link href="/?cerca_curatore=1" className="inline-block mt-4 bg-stone-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">
                Guarda chi cerca un curatore
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {inviate.map(c => (
                <RigaCandidatura
                  key={c.id}
                  c={c}
                  personaEtichetta="Proprietario"
                  personaNome={c.proprietarioNome}
                  occupato={inCorso === c.id}
                >
                  {c.stato === STATI_CANDIDATURA.inAttesa && (
                    <button
                      onClick={() => agisci('/api/curatore/decidi', { candidaturaId: c.id, azione: 'ritira' }, c.id, 'Candidatura ritirata.')}
                      disabled={inCorso === c.id}
                      className="bg-stone-100 text-stone-600 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-stone-200 transition-all disabled:opacity-50"
                    >
                      Ritira
                    </button>
                  )}
                  {c.stato === STATI_CANDIDATURA.accettata && (
                    <>
                      <Link href={`/announcement/${c.annuncioId}`} className="bg-stone-900 text-white text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-rose-600 transition-all">
                        Vedi oggetto
                      </Link>
                      <button
                        onClick={() => {
                          if (!confirm(`Vuoi lasciare l'incarico per "${c.titolo}"?`)) return
                          agisci('/api/curatore/revoke', { candidaturaId: c.id }, c.id, 'Hai lasciato l\'incarico.')
                        }}
                        disabled={inCorso === c.id}
                        className="bg-stone-100 text-stone-500 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-stone-200 transition-all disabled:opacity-50"
                      >
                        Lascia
                      </button>
                    </>
                  )}
                </RigaCandidatura>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function RigaCandidatura({
  c, personaEtichetta, personaNome, occupato, children,
}: {
  c: Candidatura
  personaEtichetta: string
  personaNome: string
  occupato: boolean
  children: React.ReactNode
}) {
  const etichetta = ETICHETTE_STATO[c.stato] || { testo: c.stato, colore: 'bg-stone-200 text-stone-500' }

  return (
    <div className={`bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${occupato ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {c.immagine && (
          <img loading="lazy" decoding="async" src={c.immagine} className="w-14 h-14 rounded-xl object-cover border border-stone-100 shrink-0" alt={c.titolo} />
        )}
        <div className="min-w-0">
          <p className="text-sm font-black text-stone-900 uppercase truncate">{c.titolo}</p>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">
            {personaEtichetta}: {personaNome}
            {c.inArena && <span className="ml-2 text-rose-500">· Arena</span>}
          </p>
          <p className="text-xs font-bold text-stone-600 mt-1">
            {c.prezzo !== null && <span className="text-rose-600">€ {Number(c.prezzo).toFixed(2)}</span>}
            <span className="text-emerald-700 ml-2">
              curatore {c.percentualeCuratore}% · proprietario {quotaProprietario(c.percentualeCuratore)}%
            </span>
          </p>
          {c.messaggio && (
            <p className="text-[11px] font-medium text-stone-500 mt-1.5 italic line-clamp-2">&ldquo;{c.messaggio}&rdquo;</p>
          )}
          <span className={`inline-block mt-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${etichetta.colore}`}>
            {etichetta.testo}
          </span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0 flex-wrap">{children}</div>
    </div>
  )
}
