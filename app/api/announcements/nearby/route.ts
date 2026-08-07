export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function getNearbyAnnouncements(lat: number, lon: number, radiusMeters: number) {
  try {
    const { data, error } = await supabase.rpc('get_nearby_announcements', {
      user_lat: lat,
      user_lon: lon,
      radius_meters: radiusMeters,
    })

    if (!error && data) {
      return data
    }
  } catch (error) {
    console.warn('RPC nearby search unavailable, falling back to REST:', error)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configurazione Supabase mancante per il radar')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/announcements?select=*&latitude.not.is.null&longitude.not.is.null&order=created_at.desc`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Fallback REST nearby failed: ${response.status}`)
  }

  const data = await response.json()
  const toRad = (value: number) => value * (Math.PI / 180)
  const earthRadiusMeters = 6371000

  return (data ?? []).filter((item: any) => {
    if (!item.latitude || !item.longitude) return false
    const dLat = toRad(item.latitude - lat)
    const dLon = toRad(item.longitude - lon)
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) * Math.cos(toRad(item.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = earthRadiusMeters * c
    return distance <= radiusMeters
  })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lon = parseFloat(searchParams.get('lon') || searchParams.get('lng') || '0');
  const dist = parseFloat(searchParams.get('dist') || searchParams.get('radius') || '50'); // Default 50km

  if (!lat || !lon) return NextResponse.json({ error: "Coordinate mancanti" }, { status: 400 });

  try {
    const data = await getNearbyAnnouncements(lat, lon, dist * 1000)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Nearby API error:', error)
    return NextResponse.json({ error: 'Errore nella ricerca per zona' }, { status: 500 })
  }
}
