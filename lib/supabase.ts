import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Controlliamo che entrambe le variabili esistano
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Errore: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devono essere definiti nel file .env.local")
}

// Se arriviamo qui, siamo sicuri che le variabili esistono
export const supabase = createClient(supabaseUrl, supabaseAnonKey)