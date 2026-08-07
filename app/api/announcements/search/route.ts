export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const categoryId = searchParams.get('cat')?.trim() || ''
  const condition = searchParams.get('cond')?.trim() || ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configurazione Supabase mancante' }, { status: 500 })
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/announcements?select=*&order=created_at.desc`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Errore ricerca annuncio' }, { status: 500 })
  }

  const data = await response.json()
  const filtered = (data ?? []).filter((item: any) => {
    const title = String(item?.title ?? '').toLowerCase()
    const matchesQuery = !q || title.includes(q.toLowerCase())
    const matchesCategory = !categoryId || String(item?.category_id ?? '') === categoryId
    const matchesCondition = !condition || item?.condition === condition
    const isAvailable = Number(item?.quantity ?? 0) > 0 || item?.condition === 'Baratto' || item?.condition === 'Regalo'
    return matchesQuery && matchesCategory && matchesCondition && isAvailable
  })

  return NextResponse.json(filtered)
}
