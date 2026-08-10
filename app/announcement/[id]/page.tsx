import { supabase } from '@/lib/supabase'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AnnouncementClientWrapper from './AnnouncementClient'

// FIX NEXT.JS 15: params ora è una Promise e va "aspettata" (await)
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params // Recuperiamo l'ID correttamente

  // Questa chiamata è protetta da try/catch. Un problema transitorio lato
  // Supabase (rete, riavvio, timeout) avrebbe altrimenti fatto crashare
  // l'intera generazione della pagina invece di mostrare un titolo generico -
  // impatta chiunque, ma è particolarmente rilevante qui perché
  // generateMetadata è anche ciò che WhatsApp/Instagram/Telegram interrogano
  // per costruire l'anteprima quando un annuncio viene condiviso: un crash
  // qui rompe la condivisione, non solo la pagina.
  let data: any = null
  try {
    const result = await supabase.from('announcements').select('*').eq('id', id).single()
    data = result.data

    // FIX: l'errore restituito da Supabase veniva ignorato del tutto. Il
    // try/catch qui sopra intercetta solo le eccezioni vere (rete caduta),
    // ma un rifiuto del database - tipicamente una regola di sicurezza (RLS)
    // che blocca la lettura - arriva come "result.error" SENZA lanciare
    // nulla. In quel caso "data" resta null e la pagina rispondeva
    // "Annuncio non trovato" per OGNI annuncio, senza lasciare la minima
    // traccia nei log di cosa stesse davvero succedendo. Distinguere il
    // "non esiste" dal "non ho potuto leggerlo" fa risparmiare ore.
    if (result.error && result.error.code !== 'PGRST116') {
      // PGRST116 = "nessuna riga trovata": è il caso normale di un annuncio
      // eliminato, non un guasto, quindi non lo segnaliamo come errore.
      console.error('generateMetadata: il database ha rifiutato la lettura dell\'annuncio', result.error)
    }
  } catch (err) {
    console.error('generateMetadata: errore nel recupero annuncio', err)
  }

  if (!data) return { title: 'Annuncio non trovato - Re-love' }

  // Per Regalo/Baratto il prezzo salvato è sempre 0 - il titolo condiviso
  // mostrava letteralmente "... a soli €0", che sembra un errore a chi lo
  // vede nell'anteprima su WhatsApp invece di capire che è gratis.
  const priceLabel =
    data.condition === 'Regalo' ? 'in Regalo'
    : data.condition === 'Baratto' ? 'da Barattare'
    : `a soli €${data.price}`

  // FIX: le anteprime dei link (WhatsApp, Telegram, Facebook) troncano la
  // descrizione intorno ai 160-200 caratteri, spesso tagliandola a metà
  // parola. Tagliandola noi a una lunghezza sensata e aggiungendo i puntini,
  // l'anteprima resta leggibile invece di finire a metà di una frase.
  const rawDescription = data.description || 'Vieni a scoprire questo annuncio su Re-love!'
  const shortDescription = rawDescription.length > 160
    ? rawDescription.slice(0, 157).trimEnd() + '...'
    : rawDescription

  return {
    title: `${data.title} - Re-love`,
    description: shortDescription,
    openGraph: {
      title: `${data.title} ${priceLabel}`,
      description: shortDescription,
      images: [data.image_url || '/usato.png'],
      type: 'website',
    },
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // FIX: prima questo id veniva passato come prop a AnnouncementClientWrapper,
  // ma il componente non lo usava mai - prende il proprio id da solo con
  // useParams(). Qui ci serve comunque, per il controllo 404 qui sotto.
  const { id } = await params

  // FIX: se l'annuncio non esiste (eliminato, link vecchio condiviso in
  // chat), prima la pagina rispondeva comunque "200 OK" e lasciava al
  // browser il compito di scrivere "Annuncio non trovato". Per un motore di
  // ricerca quello è un annuncio ancora valido, che finisce indicizzato e
  // continua a comparire nei risultati portando le persone su una pagina
  // vuota. Con notFound() la risposta è un 404 vero e proprio, come deve
  // essere. Il controllo è leggero: chiediamo solo l'id, non tutto il record.
  const { data: exists } = await supabase
    .from('announcements')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!exists) {
    notFound()
  }

  return <AnnouncementClientWrapper />
}
