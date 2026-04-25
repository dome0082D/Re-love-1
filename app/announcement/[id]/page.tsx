import { supabase } from '@/lib/supabase'
import { Metadata, ResolvingMetadata } from 'next'
import AnnouncementClientWrapper from './AnnouncementClient'

// FIX NEXT.JS 15: params ora è una Promise e va "aspettata" (await)
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params // Recuperiamo l'ID correttamente
  
  const { data } = await supabase.from('announcements').select('*').eq('id', id).single()

  if (!data) return { title: 'Annuncio non trovato - Re-love' }

  return {
    title: `${data.title} - Re-love`,
    description: data.description || 'Acquista su Re-love',
    openGraph: {
      title: `${data.title} a soli €${data.price}`,
      description: 'Vieni a scoprire questo annuncio su Re-love!',
      images: [data.image_url || '/usato.png'],
    },
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params // Recuperiamo l'ID anche qui per passarlo al Client
  
  return <AnnouncementClientWrapper announcementId={id} />
}