'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import QRCode from 'qrcode'

interface Mandate {
  id: string
  curator_id: string
  owner_id: string | null
  announcement_id: string | null
  custody_type: 'in_sede' | 'in_custodia'
  owner_percentage: number
  curator_percentage: number
  status: 'in_attesa_qr' | 'attivo' | 'revocato' | 'concluso'
  qr_token: string
  qr_expires_at: string
  draft_title: string
  draft_price: number
  draft_image_url: string | null
  created_at: string
}

// Funzione "pura" dichiarata FUORI dal componente: genera un nuovo token
// e la sua scadenza. Non tocca nessuno stato React, quindi puo' usare
// liberamente crypto.randomUUID() e Date.now() senza che il linter la
// scambi per codice eseguito "durante il render".
function generaNuovoTokenQr() {
  return {
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }
}

const STATO_LABEL: Record<Mandate['status'], { testo: string; colore: string }> = {
  in_attesa_qr: { testo: 'In attesa di approvazione', colore: 'bg-orange-100 text-orange-600' },
  attivo: { testo: 'Attivo', colore: 'bg-emerald-100 text-emerald-600' },
  revocato: { testo: 'Revocato', colore: 'bg-stone-200 text-stone-500' },
  concluso: { testo: 'Concluso', colore: 'bg-blue-100 text-blue-600' },
}

export default function CuratoreDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [asCurator, setAsCurator] = useState<Mandate[]>([])
  const [asOwner, setAsOwner] = useState<Mandate[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // Il token viene tenuto insieme all'immagine: serve a mostrarlo anche in
  // chiaro, come alternativa alla scansione (vedi app/curatore/scansiona).
  const [qrPreview, setQrPreview] = useState<{ mandateId: string; dataUrl: string; token: string } | null>(null)

  async function fetchMandates(userId: string) {
    setLoading(true)
    const [curatorRes, ownerRes] = await Promise.all([
      supabase.from('curator_mandates').select('*').eq('curator_id', userId).order('created_at', { ascending: false }),
      supabase.from('curator_mandates').select('*').eq('owner_id', userId).order('created_at', { ascending: false }),
    ])
    setAsCurator(curatorRes.data || [])
    setAsOwner(ownerRes.data || [])
    setLoading(false)
  }

  async function init() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)
    await fetchMandates(currentUser.id)
  }

  useEffect(() => {
    init()
  }, [])

  // Impostazioni condivise da tutti i QR di delega del sito: correzione
  // d'errore alta e margine ampio, perche' questi codici vengono quasi
  // sempre inquadrati DA UN TELEFONO SULLO SCHERMO DI UN ALTRO - la
  // condizione peggiore possibile per una lettura (riflessi, moire',
  // luminosita' bassa).
  const OPZIONI_QR = {
    width: 420,
    margin: 4,
    errorCorrectionLevel: 'H' as const,
    color: { dark: '#000000', light: '#FFFFFF' },
  }

  async function handleShowQr(mandate: Mandate) {
    // Un mandato vecchio potrebbe non avere il token (prima veniva lasciato
    // generare al database): meglio dirlo e offrire la rigenerazione, che
    // mostrare un QR contenente la scritta "undefined" - illeggibile per il
    // sistema ma indistinguibile a occhio da uno valido.
    if (!mandate.qr_token) {
      toast.error('Questo mandato non ha un codice valido: premi "Rigenera QR".')
      return
    }
    const qrContent = `RELOVE_MANDATE:${mandate.qr_token}`
    const dataUrl = await QRCode.toDataURL(qrContent, OPZIONI_QR)
    setQrPreview({ mandateId: mandate.id, dataUrl, token: mandate.qr_token })
  }

  async function handleRegenerateQr(mandate: Mandate) {
    setActionLoading(mandate.id)
    try {
      const { token: newToken, expiresAt: newExpiry } = generaNuovoTokenQr()

      const { error } = await supabase
        .from('curator_mandates')
        .update({ qr_token: newToken, qr_expires_at: newExpiry })
        .eq('id', mandate.id)

      if (error) throw error

      const qrContent = `RELOVE_MANDATE:${newToken}`
      const dataUrl = await QRCode.toDataURL(qrContent, OPZIONI_QR)
      setQrPreview({ mandateId: mandate.id, dataUrl, token: newToken })
      toast.success('Nuovo QR generato, valido 30 minuti.')
      fetchMandates(user.id)
    } catch (err) {
      console.error('Errore rigenerazione QR:', err)
      toast.error('Errore durante la rigenerazione del QR.')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRevoke(mandate: Mandate) {
    if (!confirm(`Vuoi revocare la delega per "${mandate.draft_title}"? L'annuncio sparirà subito e tornerà una bozza privata solo tua.`)) return

    setActionLoading(mandate.id)
    try {
      const res = await fetch('/api/curatore/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandateId: mandate.id, ownerId: user.id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Errore durante la revoca.')
        return
      }

      toast.success('Delega revocata. L\'oggetto è tornato una tua bozza privata.')
      fetchMandates(user.id)
    } catch (err) {
      console.error('Errore revoca:', err)
      toast.error('Errore di connessione.')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400 animate-pulse">Caricamento...</div>
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-14 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">Curatore Locale</h1>
          <p className="text-stone-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">I tuoi mandati di delega</p>
          <div className="flex gap-3 justify-center mt-6">
            <Link href="/curatore/nuovo" className="bg-rose-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-900 transition-all shadow-md">
              + Nuovo Mandato
            </Link>
            <Link href="/curatore/scansiona" className="bg-stone-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 transition-all shadow-md">
              📷 Approva Delega
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-10 space-y-14">

        {/* SEZIONE: MANDATI COME CURATORE */}
        <section>
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900 border-b border-stone-300 pb-4 mb-6">
            Oggetti che gestisci (come Curatore)
          </h2>
          {asCurator.length === 0 ? (
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center py-10">Non hai ancora creato nessun mandato.</p>
          ) : (
            <div className="space-y-3">
              {asCurator.map(m => (
                <div key={m.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {m.draft_image_url && (
                      <img src={m.draft_image_url} className="w-14 h-14 rounded-xl object-cover border border-stone-100 shrink-0" alt={m.draft_title} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-stone-900 uppercase truncate">{m.draft_title}</p>
                      <p className="text-xs font-bold text-rose-600">€ {Number(m.draft_price).toFixed(2)}</p>
                      <span className={`inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${STATO_LABEL[m.status].colore}`}>
                        {STATO_LABEL[m.status].testo}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {m.status === 'in_attesa_qr' && (
                      <>
                        <button
                          onClick={() => handleShowQr(m)}
                          className="bg-stone-100 text-stone-700 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-stone-200 transition-all"
                        >
                          Mostra QR
                        </button>
                        <button
                          onClick={() => handleRegenerateQr(m)}
                          disabled={actionLoading === m.id}
                          className="bg-stone-900 text-white text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-rose-600 transition-all disabled:opacity-50"
                        >
                          Rigenera QR
                        </button>
                      </>
                    )}
                    {m.status === 'attivo' && m.announcement_id && (
                      <Link href={`/announcement/${m.announcement_id}`} className="bg-stone-900 text-white text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-rose-600 transition-all">
                        Vedi Annuncio
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SEZIONE: MANDATI COME PROPRIETARIO */}
        <section>
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900 border-b border-stone-300 pb-4 mb-6">
            Oggetti che hai delegato (come Proprietario)
          </h2>
          {asOwner.length === 0 ? (
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest text-center py-10">Non hai ancora approvato nessuna delega.</p>
          ) : (
            <div className="space-y-3">
              {asOwner.map(m => (
                <div key={m.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {m.draft_image_url && (
                      <img src={m.draft_image_url} className="w-14 h-14 rounded-xl object-cover border border-stone-100 shrink-0" alt={m.draft_title} />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-stone-900 uppercase truncate">{m.draft_title}</p>
                      <p className="text-xs font-bold text-emerald-600">La tua quota: {m.owner_percentage}%</p>
                      <span className={`inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${STATO_LABEL[m.status].colore}`}>
                        {STATO_LABEL[m.status].testo}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {m.status === 'attivo' && m.announcement_id && (
                      <Link href={`/announcement/${m.announcement_id}`} className="bg-stone-100 text-stone-700 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-stone-200 transition-all">
                        Vedi Annuncio
                      </Link>
                    )}
                    {m.status === 'attivo' && (
                      <button
                        onClick={() => handleRevoke(m)}
                        disabled={actionLoading === m.id}
                        className="bg-rose-500/10 border border-rose-500/40 text-rose-600 text-[9px] font-black uppercase px-3 py-2 rounded-lg hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50"
                      >
                        {actionLoading === m.id ? '...' : 'Revoca'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MODALE QR */}
      {qrPreview && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm" onClick={() => setQrPreview(null)}>
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-black uppercase text-stone-400 tracking-widest mb-4">Fai scansionare questo QR al Proprietario</p>
            <img src={qrPreview.dataUrl} alt="QR di delega" className="w-full h-auto rounded-2xl border border-stone-200 bg-white" />

            {/* Alternativa alla scansione: con un solo telefono è
                impossibile inquadrare il proprio schermo. Il Proprietario
                può digitare questo codice nella pagina "Approva Delega". */}
            <div className="mt-5 bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left">
              <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest mb-2">
                Non riesce a inquadrarlo? Codice da digitare
              </p>
              <p className="font-mono text-[11px] font-bold text-stone-900 break-all select-all bg-white border border-stone-200 rounded-lg p-3">
                {qrPreview.token}
              </p>
              <button
                onClick={() => { navigator.clipboard.writeText(qrPreview.token); toast.success('Codice copiato.') }}
                className="w-full mt-3 bg-stone-900 text-white py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all"
              >
                Copia il codice
              </button>
            </div>

            <button onClick={() => setQrPreview(null)} className="mt-4 w-full bg-stone-100 text-stone-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all">
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
