'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { caricaDatiStaff, azioneStaff, type DatiStaff, type AnnuncioStaff } from '@/lib/staffClient'
import { srcFoto, srcSetFoto } from '@/lib/immagini'
import {
  Crown, Users, Package, Star, Scale, ShieldAlert, FileText, Sparkles,
  Handshake, Search, RefreshCw, Trash2, Ban, CheckCircle2, Truck, Pencil, X, Settings, AlertTriangle,
} from 'lucide-react'

// ============================================================================
// PANNELLO STAFF
//
// Rifatto per due motivi insieme.
//
// 1. FUNZIONAVA A META'. Leggeva e scriveva tutto dal browser con la chiave
//    anonima: per il database lo staff e' un utente come gli altri, quindi la
//    RLS gli nascondeva le righe altrui e gli rifiutava le scritture. Provato
//    in produzione con una sessione autenticata:
//        SELECT transactions    -> 0 righe   (sezione Ordini sempre vuota)
//        SELECT chat_violations -> 0 righe   (Segnalazioni sempre vuota)
//        UPDATE profiles (ban)  -> 0 righe   (nessuno e' mai stato bloccato)
//        UPDATE disputes        -> 0 righe   (nessuna pratica mai chiusa)
//        DELETE reviews         -> 0 righe   (nessuna recensione mai rimossa)
//    E siccome PostgREST risponde 200 e non un errore, il pannello diceva
//    "fatto" ogni volta. Ora tutto passa da /api/staff/*, che verifica chi
//    chiede e riferisce quante righe ha davvero toccato.
//
// 2. ERA DISORDINATO. Sezioni una sotto l'altra in una pagina unica
//    lunghissima, senza modo di cercare né di filtrare. Ora: riepilogo in
//    cima, schede per area, ricerca in ogni elenco.
// ============================================================================

type Scheda = 'riepilogo' | 'utenti' | 'ordini' | 'annunci' | 'tribunale' | 'segnalazioni' | 'recensioni' | 'vetrina' | 'baratti' | 'sistema'

const SCHEDE: { id: Scheda; titolo: string; icona: React.ReactNode }[] = [
  { id: 'riepilogo', titolo: 'Riepilogo', icona: <Crown size={15} /> },
  { id: 'utenti', titolo: 'Utenti', icona: <Users size={15} /> },
  { id: 'ordini', titolo: 'Ordini', icona: <Package size={15} /> },
  { id: 'annunci', titolo: 'Annunci', icona: <FileText size={15} /> },
  { id: 'tribunale', titolo: 'Controversie', icona: <Scale size={15} /> },
  { id: 'segnalazioni', titolo: 'Segnalazioni', icona: <ShieldAlert size={15} /> },
  { id: 'recensioni', titolo: 'Recensioni', icona: <Star size={15} /> },
  { id: 'vetrina', titolo: 'Vetrina', icona: <Sparkles size={15} /> },
  { id: 'baratti', titolo: 'Baratti', icona: <Handshake size={15} /> },
  { id: 'sistema', titolo: 'Sistema', icona: <Settings size={15} /> },
]

interface VenditoreDiagnosi {
  email: string
  stato: string
  mancante: string | null
}

interface Diagnosi {
  error?: string
  configurazione?: Record<string, string | null>
  amazon?: Record<string, string | null>
  stripeRaggiungibile?: boolean
  dettaglioStripe?: string | null
  contiCollegati?: number
  venditoriPronti?: number
  venditori?: VenditoreDiagnosi[]
}

const STATI_ORDINE = ['held', 'Pagato', 'Spedito', 'Ricevuto', 'Concluso', 'In Contestazione', 'Rimborsato']

export default function PannelloStaff() {
  const router = useRouter()
  const [dati, setDati] = useState<DatiStaff | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [scheda, setScheda] = useState<Scheda>('riepilogo')
  const [cerca, setCerca] = useState('')
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [modificaAnnuncio, setModificaAnnuncio] = useState<AnnuncioStaff | null>(null)
  const [diagnosi, setDiagnosi] = useState<Diagnosi | null>(null)
  const [caricoDiagnosi, setCaricoDiagnosi] = useState(false)

  // La diagnosi si carica solo quando serve: interroga Stripe conto per
  // conto, quindi non ha senso farlo a ogni apertura del pannello.
  async function caricaDiagnosi() {
    setCaricoDiagnosi(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/staff/stripe-check', { headers: { Authorization: `Bearer ${session?.access_token}` } })
      setDiagnosi(await res.json())
    } catch {
      setDiagnosi({ error: 'Diagnosi non riuscita.' })
    } finally {
      setCaricoDiagnosi(false)
    }
  }

  async function carica(silenzioso = false) {
    if (!silenzioso) setCaricamento(true)
    const { dati: d, errore: e } = await caricaDatiStaff()
    if (e) {
      setErrore(e)
      setDati(null)
    } else {
      setErrore(null)
      setDati(d!)
    }
    setCaricamento(false)
  }

  useEffect(() => {
    async function avvia() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      await carica()
    }
    avvia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ogni azione passa di qui: una sola conferma, un solo punto in cui si
  // gestiscono errore e ricarica.
  async function esegui(chiave: string, corpo: Record<string, unknown>, conferma?: string, successo?: string) {
    if (conferma && !confirm(conferma)) return
    setInCorso(chiave)
    const { ok, errore: err } = await azioneStaff(corpo)
    setInCorso(null)
    if (!ok) {
      toast.error(err || 'Operazione non riuscita.')
      return
    }
    toast.success(successo || 'Fatto.')
    carica(true)
  }

  const filtra = <T,>(elenco: T[], campi: (v: T) => (string | null | undefined)[]) => {
    const q = cerca.trim().toLowerCase()
    if (!q) return elenco
    return elenco.filter(v => campi(v).some(c => (c || '').toLowerCase().includes(q)))
  }

  const r = dati?.riepilogo

  const schedeConBadge = useMemo(() => {
    if (!r) return {} as Record<string, number>
    return {
      tribunale: r.controversieAperte,
      segnalazioni: r.segnalazioniDaEsaminare,
      ordini: r.ordiniInContestazione,
    } as Record<string, number>
  }, [r])

  // ---------------------------------------------------------------- schermate
  if (caricamento) {
    return <div className="min-h-screen flex items-center justify-center text-[11px] font-black uppercase tracking-[0.3em] text-stone-400 animate-pulse">Caricamento pannello...</div>
  }

  if (errore) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-[2rem] shadow-sm p-10 max-w-md text-center">
          <ShieldAlert size={48} className="text-rose-500 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-lg font-black uppercase italic text-stone-900 mb-2">Accesso non consentito</h1>
          <p className="text-xs font-bold text-stone-500 mb-6">{errore}</p>
          <Link href="/" className="inline-block bg-stone-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors">
            Torna alla Home
          </Link>
        </div>
      </div>
    )
  }

  if (!dati || !r) return null

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32 bg-stone-50">

      {/* ------------------------------------------------------- INTESTAZIONE */}
      <div className="bg-stone-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-rose-500 flex items-center justify-center shrink-0">
              <Crown size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black uppercase italic tracking-tight leading-none">Pannello Staff</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400 mt-1.5">Moderazione Re-love</p>
            </div>
          </div>
          <button
            onClick={() => carica()}
            className="flex items-center gap-2 h-11 px-4 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            <RefreshCw size={14} /> Aggiorna
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ SCHEDE */}
      <div className="bg-white border-b border-stone-200 sticky top-16 md:top-20 z-30">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto custom-scrollbar">
          {SCHEDE.map(s => (
            <button
              key={s.id}
              onClick={() => { setScheda(s.id); setCerca('') }}
              className={`shrink-0 flex items-center gap-2 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                scheda === s.id
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {s.icona} {s.titolo}
              {schedeConBadge[s.id] > 0 && (
                <span className="bg-rose-500 text-white text-[9px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full">
                  {schedeConBadge[s.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8">

        {/* --------------------------------------------------------- RICERCA */}
        {scheda !== 'riepilogo' && (
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={cerca}
              onChange={e => setCerca(e.target.value)}
              placeholder="Cerca in questa sezione..."
              className="w-full h-12 pl-11 pr-4 bg-white border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-rose-400 transition-colors"
            />
          </div>
        )}

        {/* ------------------------------------------------------- RIEPILOGO */}
        {scheda === 'riepilogo' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Riquadro titolo="Utenti" valore={r.utenti} nota={`${r.utentiBloccati} bloccati`} />
            <Riquadro titolo="Annunci attivi" valore={r.annunciAttivi} nota={`${r.annunciTotali} in totale`} />
            <Riquadro titolo="Ordini in corso" valore={r.ordiniInCorso} nota={`${r.ordiniTotali} in totale`} />
            <Riquadro titolo="Commissioni" valore={`€ ${r.incassoCommissioni.toFixed(2)}`} nota="10% sugli ordini conclusi" />
            <Riquadro titolo="Controversie aperte" valore={r.controversieAperte} nota="da giudicare" allerta={r.controversieAperte > 0} />
            <Riquadro titolo="Segnalazioni" valore={r.segnalazioniDaEsaminare} nota="da esaminare" allerta={r.segnalazioniDaEsaminare > 0} />
            <Riquadro titolo="In contestazione" valore={r.ordiniInContestazione} nota="ordini bloccati" allerta={r.ordiniInContestazione > 0} />
            <Riquadro titolo="Baratti" valore={dati.baratti.length} nota="scambi registrati" />
          </div>
        )}

        {/* ----------------------------------------------------------- UTENTI */}
        {scheda === 'utenti' && (
          <Elenco vuoto="Nessun utente trovato.">
            {filtra(dati.profili, p => [p.email, p.nickname, p.first_name, p.last_name, p.city]).map(p => (
              <Riga key={p.id}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-stone-900 truncate">{p.nickname || p.first_name || 'Senza nome'}</span>
                    {p.is_banned && <Etichetta tono="rosso">Bloccato</Etichetta>}
                    {p.role === 'staff' && <Etichetta tono="scuro">Staff</Etichetta>}
                    {p.stripe_account_id && <Etichetta tono="verde">Stripe</Etichetta>}
                  </div>
                  <p className="text-[11px] font-bold text-stone-500 truncate mt-0.5">{p.email}</p>
                  {p.is_banned && p.banned_reason && (
                    <p className="text-[10px] font-bold text-rose-600 mt-1">Motivo: {p.banned_reason}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link href={`/staff/users/${p.id}`} className="h-9 px-3 flex items-center bg-stone-100 text-stone-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-stone-200 transition-colors">
                    Scheda
                  </Link>
                  <Bottone
                    tono={p.is_banned ? 'verde' : 'ambra'}
                    attivo={inCorso === `ban-${p.id}`}
                    onClick={() => {
                      if (p.is_banned) {
                        esegui(`ban-${p.id}`, { azione: 'sblocca-utente', userId: p.id }, 'Sbloccare questo utente?', 'Utente sbloccato.')
                      } else {
                        const motivo = prompt('Motivo del blocco (lo vedrà anche l\'utente):', 'Violazione delle regole della community')
                        if (motivo === null) return
                        esegui(`ban-${p.id}`, { azione: 'blocca-utente', userId: p.id, motivo }, undefined, 'Utente bloccato.')
                      }
                    }}
                  >
                    {p.is_banned ? <><CheckCircle2 size={12} /> Sblocca</> : <><Ban size={12} /> Blocca</>}
                  </Bottone>
                  <Bottone
                    tono="scuro"
                    attivo={inCorso === `ruolo-${p.id}`}
                    onClick={() => esegui(
                      `ruolo-${p.id}`,
                      { azione: 'cambia-ruolo', userId: p.id, ruolo: p.role === 'staff' ? 'user' : 'staff' },
                      p.role === 'staff' ? 'Togliere i permessi di staff?' : 'Dare i permessi di staff a questo utente?',
                      'Ruolo aggiornato.'
                    )}
                  >
                    {p.role === 'staff' ? 'Togli staff' : 'Rendi staff'}
                  </Bottone>
                  <Bottone
                    tono="rosso"
                    attivo={inCorso === `del-${p.id}`}
                    onClick={() => esegui(
                      `del-${p.id}`,
                      { azione: 'elimina-utente', userId: p.id },
                      `ELIMINARE DEFINITIVAMENTE ${p.email}?\n\nVengono rimossi profilo, annunci, messaggi e accesso. Non si torna indietro.`,
                      'Utente eliminato.'
                    )}
                  >
                    <Trash2 size={12} />
                  </Bottone>
                </div>
              </Riga>
            ))}
          </Elenco>
        )}

        {/* ----------------------------------------------------------- ORDINI */}
        {scheda === 'ordini' && (
          <Elenco vuoto="Nessun ordine trovato.">
            {filtra(dati.transazioni, t => [t.buyerEmail, t.sellerEmail, t.status, t.announcements?.title]).map(t => (
              <Riga key={t.id} colonna>
                <div className="flex items-start justify-between gap-3 w-full">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-stone-900 truncate">{t.announcements?.title || 'Annuncio rimosso'}</p>
                    <p className="text-[11px] font-bold text-stone-500 mt-0.5 truncate">
                      {t.buyerEmail} → {t.sellerEmail}
                    </p>
                    <p className="text-[10px] font-bold text-stone-400 mt-1">
                      € {Number(t.announcements?.price || 0).toFixed(2)} · {new Date(t.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <Etichetta tono={t.status === 'In Contestazione' ? 'rosso' : t.status === 'Concluso' ? 'verde' : 'ambra'}>
                    {t.status}
                  </Etichetta>
                </div>

                <div className="flex flex-wrap gap-2 w-full">
                  <select
                    defaultValue=""
                    onChange={e => {
                      const stato = e.target.value
                      e.target.value = ''
                      if (!stato) return
                      esegui(`stato-${t.id}`, { azione: 'stato-ordine', transactionId: t.id, stato }, `Forzare lo stato a "${stato}"?`, 'Stato aggiornato.')
                    }}
                    className="h-9 px-3 bg-stone-100 border border-stone-200 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer"
                  >
                    <option value="">Forza stato...</option>
                    {STATI_ORDINE.filter(s => s !== t.status).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <Bottone
                    tono="scuro"
                    attivo={inCorso === `sped-${t.id}`}
                    onClick={() => {
                      const corriere = prompt('Corriere:', t.courier_name || '')
                      if (corriere === null) return
                      const tracking = prompt('Numero di tracking:', t.tracking_number || '')
                      if (tracking === null) return
                      esegui(`sped-${t.id}`, { azione: 'spedizione', transactionId: t.id, corriere, tracking }, undefined, 'Spedizione registrata.')
                    }}
                  >
                    <Truck size={12} /> Spedizione
                  </Bottone>

                  {t.tracking_number && (
                    <span className="h-9 px-3 flex items-center bg-stone-50 border border-stone-200 rounded-lg text-[10px] font-bold text-stone-500">
                      {t.courier_name} · {t.tracking_number}
                    </span>
                  )}
                </div>
              </Riga>
            ))}
          </Elenco>
        )}

        {/* ---------------------------------------------------------- ANNUNCI */}
        {scheda === 'annunci' && (
          <Elenco vuoto="Nessun annuncio trovato.">
            {filtra(dati.annunci, a => [a.title, a.autore, a.condition, a.city]).map(a => (
              <Riga key={a.id}>
                <img loading="lazy" decoding="async" src={srcFoto(a.image_url, 112) || '/usato.png'} srcSet={srcSetFoto(a.image_url, 112)} alt="" className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/announcement/${a.id}`} className="text-sm font-black text-stone-900 truncate hover:text-rose-600 transition-colors">{a.title}</Link>
                    {a.is_sponsored && <Etichetta tono="ambra">Vetrina</Etichetta>}
                    {a.is_arena && <Etichetta tono="scuro">Arena</Etichetta>}
                    {(a.quantity ?? 1) <= 0 && <Etichetta tono="rosso">Esaurito</Etichetta>}
                  </div>
                  <p className="text-[11px] font-bold text-stone-500 truncate mt-0.5">
                    € {Number(a.price).toFixed(2)} · {a.condition} · {a.autore}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Bottone tono="scuro" onClick={() => setModificaAnnuncio(a)}>
                    <Pencil size={12} /> Modifica
                  </Bottone>
                  <Bottone
                    tono="rosso"
                    attivo={inCorso === `ann-${a.id}`}
                    onClick={() => esegui(
                      `ann-${a.id}`,
                      { azione: 'elimina-annuncio', announcementId: a.id },
                      `Rimuovere l'annuncio "${a.title}"? L'autore riceverà un avviso.`,
                      'Annuncio rimosso.'
                    )}
                  >
                    <Trash2 size={12} />
                  </Bottone>
                </div>
              </Riga>
            ))}
          </Elenco>
        )}

        {/* ------------------------------------------------------- TRIBUNALE */}
        {scheda === 'tribunale' && (
          <Elenco vuoto="Nessuna controversia.">
            {filtra(dati.controversie, d => [d.reason, d.description, d.status]).map(d => {
              const chiusa = String(d.status || '').startsWith('Risolta')
              return (
                <Riga key={d.id} colonna>
                  <div className="flex items-start justify-between gap-3 w-full">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-stone-900">{d.reason || 'Contestazione'}</p>
                      <p className="text-[11px] font-bold text-stone-500 mt-1 line-clamp-3">{d.description}</p>
                      <p className="text-[10px] font-bold text-stone-400 mt-1.5">
                        {d.transaction?.announcements?.title || 'Ordine non collegato'} · {new Date(d.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <Etichetta tono={chiusa ? 'verde' : 'rosso'}>{chiusa ? 'Chiusa' : 'Aperta'}</Etichetta>
                  </div>

                  {!chiusa && (
                    <div className="flex flex-wrap gap-2 w-full">
                      <Bottone
                        tono="verde"
                        attivo={inCorso === `disp-${d.id}`}
                        onClick={() => esegui(
                          `disp-${d.id}`,
                          { azione: 'risolvi-controversia', disputeId: d.id, esitoScelto: 'Fondi al Venditore', buyerId: d.buyer_id, sellerId: d.seller_id },
                          'Chiudere a favore del VENDITORE?',
                          'Pratica chiusa.'
                        )}
                      >
                        Dai ragione al venditore
                      </Bottone>
                      <Bottone
                        tono="ambra"
                        attivo={inCorso === `disp-${d.id}`}
                        onClick={() => esegui(
                          `disp-${d.id}`,
                          { azione: 'risolvi-controversia', disputeId: d.id, esitoScelto: 'Rimborso Acquirente', buyerId: d.buyer_id, sellerId: d.seller_id },
                          'Chiudere a favore dell\'ACQUIRENTE?',
                          'Pratica chiusa.'
                        )}
                      >
                        Dai ragione all&apos;acquirente
                      </Bottone>
                    </div>
                  )}
                </Riga>
              )
            })}
          </Elenco>
        )}

        {/* ---------------------------------------------------- SEGNALAZIONI */}
        {scheda === 'segnalazioni' && (
          <Elenco vuoto="Nessuna segnalazione.">
            {filtra(dati.segnalazioni, v => [v.senderEmail, v.receiverEmail, v.message_content]).map(v => (
              <Riga key={v.id} colonna>
                <div className="flex items-start justify-between gap-3 w-full">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-stone-500">
                      {v.senderEmail} → {v.receiverEmail}
                    </p>
                    <p className="text-sm font-bold text-stone-900 mt-1 bg-stone-50 border border-stone-200 rounded-lg p-3 break-words">
                      {v.message_content}
                    </p>
                  </div>
                  <Etichetta tono={v.reviewed ? 'verde' : 'rosso'}>{v.reviewed ? 'Esaminata' : 'Nuova'}</Etichetta>
                </div>
                <div className="flex flex-wrap gap-2 w-full">
                  {!v.reviewed && (
                    <Bottone tono="scuro" attivo={inCorso === `viol-${v.id}`}
                      onClick={() => esegui(`viol-${v.id}`, { azione: 'archivia-segnalazione', violationId: v.id }, undefined, 'Segnalazione archiviata.')}>
                      <CheckCircle2 size={12} /> Archivia
                    </Bottone>
                  )}
                  <Bottone tono="ambra" attivo={inCorso === `vban-${v.sender_id}`}
                    onClick={() => {
                      const motivo = prompt('Motivo del blocco:', 'Scambio di contatti in chat')
                      if (motivo === null) return
                      esegui(`vban-${v.sender_id}`, { azione: 'blocca-utente', userId: v.sender_id, motivo }, undefined, 'Mittente bloccato.')
                    }}>
                    <Ban size={12} /> Blocca mittente
                  </Bottone>
                  <Bottone tono="rosso" attivo={inCorso === `vdel-${v.id}`}
                    onClick={() => esegui(`vdel-${v.id}`, { azione: 'elimina-segnalazione', violationId: v.id }, 'Eliminare questa segnalazione?', 'Segnalazione eliminata.')}>
                    <Trash2 size={12} />
                  </Bottone>
                </div>
              </Riga>
            ))}
          </Elenco>
        )}

        {/* ------------------------------------------------------- RECENSIONI */}
        {scheda === 'recensioni' && (
          <Elenco vuoto="Nessuna recensione.">
            {filtra(dati.recensioni, x => [x.comment, x.reviewerEmail, x.reviewedEmail]).map(x => (
              <Riga key={x.id}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-900">{'★'.repeat(Number(x.rating) || 0)}<span className="text-stone-300">{'★'.repeat(5 - (Number(x.rating) || 0))}</span></p>
                  <p className="text-[13px] font-medium text-stone-700 mt-1 break-words">{x.comment}</p>
                  <p className="text-[10px] font-bold text-stone-400 mt-1.5 truncate">{x.reviewerEmail} → {x.reviewedEmail}</p>
                </div>
                <Bottone tono="rosso" attivo={inCorso === `rev-${x.id}`}
                  onClick={() => esegui(`rev-${x.id}`, { azione: 'elimina-recensione', reviewId: x.id }, 'Eliminare questa recensione?', 'Recensione rimossa.')}>
                  <Trash2 size={12} />
                </Bottone>
              </Riga>
            ))}
          </Elenco>
        )}

        {/* ---------------------------------------------------------- VETRINA */}
        {scheda === 'vetrina' && (
          <Elenco vuoto="Nessuna voce in Vetrina.">
            {filtra(dati.vetrina, v => [v.title, v.autore, v.external_url]).map(v => (
              <Riga key={v.id}>
                <img loading="lazy" decoding="async" src={srcFoto(v.image_url, 112) || '/usato.png'} srcSet={srcSetFoto(v.image_url, 112)} alt="" className="w-14 h-14 rounded-xl object-contain bg-stone-50 border border-stone-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-stone-900 truncate">{v.title || 'Annuncio interno'}</span>
                    <Etichetta tono={v.type === 'esterna' ? 'scuro' : 'ambra'}>{v.type}</Etichetta>
                    {!v.is_active && <Etichetta tono="rosso">Non attiva</Etichetta>}
                  </div>
                  <p className="text-[11px] font-bold text-stone-500 truncate mt-0.5">
                    {v.price ? `€ ${Number(v.price).toFixed(2)} · ` : ''}{v.autore} · {v.clicks || 0} click
                  </p>
                </div>
                <Bottone tono="rosso" attivo={inCorso === `vet-${v.id}`}
                  onClick={() => esegui(`vet-${v.id}`, { azione: 'elimina-voce-vetrina', itemId: v.id }, 'Rimuovere questa voce dalla Vetrina?', 'Voce rimossa.')}>
                  <Trash2 size={12} />
                </Bottone>
              </Riga>
            ))}
          </Elenco>
        )}

        {/* ---------------------------------------------------------- SISTEMA */}
        {scheda === 'sistema' && (
          <div className="space-y-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-black uppercase text-stone-900">Diagnosi pagamenti</h3>
                  <p className="text-[11px] font-bold text-stone-500 mt-1">
                    Controlla chiavi, raggiungibilità di Stripe e quali venditori possono davvero incassare.
                  </p>
                </div>
                <button
                  onClick={caricaDiagnosi}
                  disabled={caricoDiagnosi}
                  className="h-10 px-4 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors disabled:opacity-50"
                >
                  {caricoDiagnosi ? 'Controllo...' : 'Esegui diagnosi'}
                </button>
              </div>
            </div>

            {diagnosi && !diagnosi.error && (
              <>
                {diagnosi.configurazione?.problemaChiave && (
                  <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex gap-3">
                    <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black uppercase text-rose-700">Pagamenti non funzionanti</p>
                      <p className="text-[12px] font-bold text-rose-700 mt-1.5">{diagnosi.configurazione.problemaChiave}</p>
                      <p className="text-[11px] font-bold text-rose-600 mt-2">
                        Finché non è corretta: nessun acquisto, nessun conto venditore, nessun bonifico.
                      </p>
                    </div>
                  </div>
                )}

                {/* Diagnosi dell'API Amazon: e' quella che fornisce il
                    prezzo dei link in Vetrina dal sito pubblicato. */}
                {diagnosi.amazon && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4">Amazon (prezzi Vetrina)</h4>
                    <div className="space-y-2">
                      {Object.entries(diagnosi.amazon).map(([k, v]) => (
                        <div key={k} className="flex items-start justify-between gap-3 py-2 border-b border-stone-100 last:border-0">
                          <span className="text-[12px] font-bold text-stone-600 shrink-0">{k}</span>
                          <span className={`text-[11px] font-bold text-right break-words ${String(v).includes('MANCANTE') || String(v).includes('FALLITA') ? 'text-rose-600' : 'text-stone-500'}`}>
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-stone-200 rounded-2xl p-5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4">Configurazione</h4>
                  <div className="space-y-2">
                    {Object.entries(diagnosi.configurazione || {})
                      .filter(([k]) => k !== 'problemaChiave')
                      .map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-3 py-2 border-b border-stone-100 last:border-0">
                          <span className="text-[12px] font-bold text-stone-600">{k}</span>
                          <Etichetta tono={String(v) === 'ok' ? 'verde' : 'rosso'}>{String(v)}</Etichetta>
                        </div>
                      ))}
                    <div className="flex items-center justify-between gap-3 py-2">
                      <span className="text-[12px] font-bold text-stone-600">Stripe raggiungibile</span>
                      <Etichetta tono={diagnosi.stripeRaggiungibile ? 'verde' : 'rosso'}>
                        {diagnosi.stripeRaggiungibile ? 'sì' : (diagnosi.dettaglioStripe || 'no')}
                      </Etichetta>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-5">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1">Conti venditore</h4>
                  <p className="text-[11px] font-bold text-stone-500 mb-4">
                    {diagnosi.venditoriPronti} pronti su {diagnosi.contiCollegati} collegati
                  </p>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(diagnosi.venditori || []).map((v: VenditoreDiagnosi) => (
                      <div key={v.email} className="flex items-start justify-between gap-3 py-2 border-b border-stone-100 last:border-0">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-stone-700 truncate">{v.email}</p>
                          {v.mancante && <p className="text-[10px] font-bold text-stone-400 mt-0.5">{v.mancante}</p>}
                        </div>
                        <Etichetta tono={v.stato === 'pronto' ? 'verde' : 'ambra'}>{v.stato}</Etichetta>
                      </div>
                    ))}
                    {(diagnosi.venditori || []).length === 0 && (
                      <p className="text-[11px] font-bold text-stone-400 py-3">
                        Nessun conto verificabile (Stripe non raggiungibile).
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {diagnosi?.error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                <p className="text-[12px] font-bold text-rose-700">{diagnosi.error}</p>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------- BARATTI */}
        {scheda === 'baratti' && (
          <Elenco vuoto="Nessun baratto registrato.">
            {filtra(dati.baratti, b => [b.proponente, b.destinatario, b.status]).map(b => (
              <Riga key={b.id}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-stone-900 truncate">{b.proponente} → {b.destinatario}</p>
                  <p className="text-[10px] font-bold text-stone-400 mt-1">{new Date(b.created_at).toLocaleDateString('it-IT')}</p>
                </div>
                <Etichetta tono={b.status === 'accepted_chat_unlocked' ? 'verde' : b.status === 'rejected' ? 'rosso' : 'ambra'}>
                  {b.status}
                </Etichetta>
              </Riga>
            ))}
          </Elenco>
        )}
      </div>

      {/* ------------------------------------------- MODALE MODIFICA ANNUNCIO */}
      {modificaAnnuncio && (
        <ModaleModifica
          annuncio={modificaAnnuncio}
          onChiudi={() => setModificaAnnuncio(null)}
          onSalva={async campi => {
            const { ok, errore: err } = await azioneStaff({ azione: 'modifica-annuncio', announcementId: modificaAnnuncio.id, campi })
            if (!ok) { toast.error(err || 'Modifica non riuscita.'); return }
            toast.success('Annuncio aggiornato.')
            setModificaAnnuncio(null)
            carica(true)
          }}
        />
      )}
    </div>
  )
}

// ============================================================ pezzi riusabili

function Riquadro({ titolo, valore, nota, allerta }: { titolo: string; valore: string | number; nota?: string; allerta?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 ${allerta ? 'border-rose-300' : 'border-stone-200'}`}>
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">{titolo}</p>
      <p className={`text-2xl font-black mt-2 ${allerta ? 'text-rose-600' : 'text-stone-900'}`}>{valore}</p>
      {nota && <p className="text-[10px] font-bold text-stone-400 mt-1">{nota}</p>}
    </div>
  )
}

function Elenco({ children, vuoto }: { children: React.ReactNode; vuoto: string }) {
  const vuotoDavvero = !children || (Array.isArray(children) && children.length === 0)
  if (vuotoDavvero) {
    return (
      <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-14 text-center">
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{vuoto}</p>
      </div>
    )
  }
  return <div className="space-y-3">{children}</div>
}

function Riga({ children, colonna }: { children: React.ReactNode; colonna?: boolean }) {
  return (
    <div className={`bg-white border border-stone-200 rounded-2xl p-4 flex gap-4 ${colonna ? 'flex-col items-start' : 'items-center'}`}>
      {children}
    </div>
  )
}

function Etichetta({ children, tono }: { children: React.ReactNode; tono: 'rosso' | 'verde' | 'ambra' | 'scuro' }) {
  const toni = {
    rosso: 'bg-rose-100 text-rose-700',
    verde: 'bg-emerald-100 text-emerald-700',
    ambra: 'bg-orange-100 text-orange-700',
    scuro: 'bg-stone-900 text-white',
  }
  return <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${toni[tono]}`}>{children}</span>
}

function Bottone({ children, onClick, tono, attivo }: { children: React.ReactNode; onClick: () => void; tono: 'rosso' | 'verde' | 'ambra' | 'scuro'; attivo?: boolean }) {
  const toni = {
    rosso: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    verde: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    ambra: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
    scuro: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
  }
  return (
    <button
      onClick={onClick}
      disabled={attivo}
      className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${toni[tono]}`}
    >
      {attivo ? '...' : children}
    </button>
  )
}

function ModaleModifica({ annuncio, onChiudi, onSalva }: { annuncio: AnnuncioStaff; onChiudi: () => void; onSalva: (campi: Record<string, unknown>) => void }) {
  const [titolo, setTitolo] = useState(annuncio.title || '')
  const [prezzo, setPrezzo] = useState(String(annuncio.price ?? ''))
  const [quantita, setQuantita] = useState(String(annuncio.quantity ?? 1))
  const [citta, setCitta] = useState(annuncio.city || '')
  const [vetrina, setVetrina] = useState(!!annuncio.is_sponsored)
  const [arena, setArena] = useState(!!annuncio.is_arena)

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm" onClick={onChiudi}>
      <div className="bg-white rounded-[2rem] shadow-2xl p-7 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-black uppercase italic text-stone-900">Modifica annuncio</h2>
          <button onClick={onChiudi} className="w-9 h-9 flex items-center justify-center text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <Campo etichetta="Titolo"><input value={titolo} onChange={e => setTitolo(e.target.value)} className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-rose-400 transition-colors" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etichetta="Prezzo (€)"><input type="number" step="0.01" value={prezzo} onChange={e => setPrezzo(e.target.value)} className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-rose-400 transition-colors" /></Campo>
            <Campo etichetta="Quantità"><input type="number" value={quantita} onChange={e => setQuantita(e.target.value)} className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-rose-400 transition-colors" /></Campo>
          </div>
          <Campo etichetta="Città"><input value={citta} onChange={e => setCitta(e.target.value)} className="w-full h-11 px-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-rose-400 transition-colors" /></Campo>

          <label className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer">
            <input type="checkbox" checked={vetrina} onChange={e => setVetrina(e.target.checked)} className="w-5 h-5 accent-rose-600" />
            <span className="text-[11px] font-black uppercase tracking-widest text-stone-700">In Vetrina</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer">
            <input type="checkbox" checked={arena} onChange={e => setArena(e.target.checked)} className="w-5 h-5 accent-rose-600" />
            <span className="text-[11px] font-black uppercase tracking-widest text-stone-700">In Arena</span>
          </label>
        </div>

        <button
          onClick={() => onSalva({
            title: titolo.trim(),
            price: Number(prezzo) || 0,
            quantity: Number(quantita) || 0,
            city: citta.trim() || null,
            is_sponsored: vetrina,
            is_arena: arena,
          })}
          className="w-full mt-7 bg-stone-900 text-white h-12 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 transition-colors"
        >
          Salva modifiche
        </button>
      </div>
    </div>
  )
}

function Campo({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-400 ml-1">{etichetta}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}
