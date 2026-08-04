import { supabase } from '@/lib/supabase'
import { Metadata, ResolvingMetadata } from 'next'
import AnnouncementClientWrapper from './AnnouncementClient'

// FIX NEXT.JS 15: params ora è una Promise e va "aspettata" (await)
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params // Recuperiamo l'ID correttamente

  // FIX: questa chiamata non era protetta da try/catch. Un problema
  // transitorio lato Supabase (rete, riavvio, timeout) avrebbe fatto
  // crashare l'intera generazione della pagina invece di mostrare un
  // titolo generico - impatta chiunque, ma è particolarmente rilevante
  // qui perché generateMetadata è anche ciò che WhatsApp/Instagram/
  // Telegram interrogano per costruire l'anteprima quando un annuncio
  // viene condiviso: un crash qui rompe la condivisione, non solo la pagina.
  let data: any = null
  try {
    const result = await supabase.from('announcements').select('*').eq('id', id).single()
    data = result.data
  } catch (err) {
    console.error('generateMetadata: errore nel recupero annuncio', err)
  }

  if (!data) return { title: 'Annuncio non trovato - Re-love' }

  // FIX: per Regalo/Baratto il prezzo salvato è sempre 0 - il titolo
  // condiviso mostrava letteralmente "... a soli €0", che sembra un errore
  // a chi lo vede nell'anteprima su WhatsApp invece di capire che è gratis.
  const priceLabel =
    data.condition === 'Regalo' ? 'in Regalo'
    : data.condition === 'Baratto' ? 'da Barattare'
    : `a soli €${data.price}`

  return {
    title: `${data.title} - Re-love`,
    description: data.description || 'Acquista su Re-love',
    openGraph: {
      title: `${data.title} ${priceLabel}`,
      // FIX: prima qui c'era un testo fisso generico, ignorando la
      // descrizione reale dell'annuncio già recuperata dal database -
      // l'anteprima condivisa su WhatsApp era identica per ogni annuncio.
      description: data.description || 'Vieni a scoprire questo annuncio su Re-love!',
      images: [data.image_url || '/usato.png'],
    },
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params // Recuperiamo l'ID anche qui per passarlo al Client
  
  return <AnnouncementClientWrapper announcementId={id} />
}
