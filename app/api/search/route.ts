// app/api/search/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchAffiliateProducts } from '@/lib/affiliates'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ error: 'Parametro di ricerca "q" mancante' }, { status: 400 })
  }

  try {
    // Virgole e parentesi hanno un significato speciale nella sintassi dei
    // filtri PostgREST (.or()) - le togliamo per evitare che un termine di
    // ricerca con questi caratteri rompa la query o dia risultati sbagliati.
    const safeQuery = query.replace(/[,()]/g, ' ').trim()

    // 1. Cerchiamo prima nel catalogo interno di Re-love (titolo o descrizione)
    const { data: internalResults, error: internalError } = await supabase
      .from('announcements')
      .select('*')
      .or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
      .limit(24)

    if (internalError) {
      console.error('[Search] Errore ricerca interna:', internalError)
    }

    if (internalResults && internalResults.length > 0) {
      return NextResponse.json({ source: 'internal', products: internalResults })
    }

    // 2. Zero risultati interni: proviamo con i partner esterni
    const externalProducts = await fetchAffiliateProducts(safeQuery)

    return NextResponse.json({ source: 'external', products: externalProducts })
  } catch (err: any) {
    console.error('[Search] Errore:', err)
    return NextResponse.json({ error: 'Errore durante la ricerca' }, { status: 500 })
  }
}