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

function buildClient(): SupabaseClient {
  const isBrowser = typeof window !== 'undefined'

  // FIX: il commento precedente ("creiamo il client anche se le stringhe sono
  // vuote, evita il crash del build") affermava il contrario di quello che
  // succede davvero: createClient() con URL o chiave vuoti LANCIA un errore
  // ("supabaseUrl is required") e blocca comunque il build. Il "|| ''" qui
  // sopra non protegge da nulla - dà solo una falsa sicurezza. Meglio un
  // messaggio che dice subito QUALE variabile manca, invece dell'errore
  // generico della libreria che non aiuta a capire dove intervenire.
  if (!supabaseUrl || !supabaseAnonKey) {
    const mancanti = [
      !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
    ].filter(Boolean).join(' e ')
    throw new Error(
      `Configurazione Supabase mancante: ${mancanti}. ` +
      `Impostala nelle variabili d'ambiente del progetto (in locale nel file .env, ` +
      `su Vercel in Settings > Environment Variables) e rilancia il build.`
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // FIX (SICUREZZA LATO SERVER): sul server non deve esistere nessuna
      // sessione persistente. "globalThis" in Node è condiviso tra TUTTE le
      // richieste in arrivo: se un client con sessione attiva venisse
      // riutilizzato tra richieste diverse, i dati di un utente potrebbero
      // finire nella risposta destinata a un altro. Sul server disattiviamo
      // quindi persistenza e refresh automatico, e (vedi sotto) non lo
      // riutilizziamo nemmeno tramite la variabile globale.
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
      storage: createSafeStorage(),
    },
  })
}

function getSupabaseClient(): SupabaseClient {
  // Sul SERVER creiamo sempre un client nuovo, senza riutilizzare la
  // variabile globale: l'isolamento tra richieste vale più del piccolo
  // risparmio di riutilizzarne uno solo. Nel BROWSER, invece, il client
  // unico è proprio quello che ci serve (vedi il fix "istanze multiple").
  if (typeof window === 'undefined') {
    return buildClient()
  }

  if (globalThis.__supabase_client__) {
    return globalThis.__supabase_client__
  }

  const client = buildClient()
  globalThis.__supabase_client__ = client
  return client
}

export const supabase = getSupabaseClient()