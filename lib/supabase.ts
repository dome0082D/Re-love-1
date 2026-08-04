import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// --- FIX ANDROID: molti link a Re-love vengono aperti da browser in-app
// (WebView di Instagram, Facebook, TikTok, Messenger... comunissimi su Android
// quando si apre un link condiviso in chat). Questi WebView spesso bloccano o
// lanciano un errore sull'accesso a localStorage (modalità privata, storage
// partizionato). Dato che il client viene creato al livello del modulo, cioè
// nell'istante stesso in cui questo file viene importato - prima ancora che
// un componente si monti - un errore qui manderebbe in crash l'intera app con
// schermata bianca, perché lib/supabase è importato ovunque. Questo controllo
// intercetta il problema e passa a uno storage in memoria come fallback: la
// sessione non sopravvive a un refresh in quei casi limite, ma l'app non crasha.
function createSafeStorage() {
  if (typeof window === 'undefined') return undefined // SSR: nessun storage da usare

  try {
    const testKey = '__supabase_storage_test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return window.localStorage
  } catch {
    const memoryStore = new Map<string, string>()
    return {
      getItem: (key: string) => memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => { memoryStore.set(key, value) },
      removeItem: (key: string) => { memoryStore.delete(key) },
    }
  }
}

// --- FIX ISTANZE MULTIPLE: garantisce un solo client Supabase per l'intero
// browser. Senza questo, con Fast Refresh in sviluppo (o se il modulo viene
// valutato più di una volta lato client) possono nascere più GoTrueClient in
// parallelo: il sintomo tipico è lo stato di login che "sfarfalla" (risulti
// loggato e poi no) e le sottoscrizioni realtime - chat, notifiche - che si
// duplicano o si disallineano tra loro.
declare global {
  // eslint-disable-next-line no-var
  var __supabase_client__: SupabaseClient | undefined
}

function getSupabaseClient(): SupabaseClient {
  if (globalThis.__supabase_client__) {
    return globalThis.__supabase_client__
  }

  // Creiamo il client anche se le stringhe sono vuote (evita il crash del build)
  // Il controllo vero lo faremo solo quando serve davvero
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: createSafeStorage(),
    },
  })

  globalThis.__supabase_client__ = client
  return client
}

export const supabase = getSupabaseClient()
