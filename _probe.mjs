import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// creo due utenti di prova: curatore e proprietario
const utenti = {}
for (const ruolo of ['curatore','proprietario']) {
  const email = `probe-${ruolo}-${Date.now()}@relove-test.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'ProvaProva123!', email_confirm: true })
  if (error) { console.log('ERRORE creazione', ruolo, error.message); process.exit(1) }
  utenti[ruolo] = { id: data.user.id, email }
  await admin.from('profiles').upsert({ id: data.user.id, email, first_name: ruolo })
}
console.log('utenti creati:', utenti.curatore.id.slice(0,8), utenti.proprietario.id.slice(0,8))

// login come curatore, provo a creare un mandato ESATTAMENTE come fa la pagina
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data: sess, error: errLogin } = await anon.auth.signInWithPassword({ email: utenti.curatore.email, password: 'ProvaProva123!' })
console.log('login curatore:', errLogin?.message || 'ok')

const token = crypto.randomUUID()
const { data: mandato, error: errIns } = await anon.from('curator_mandates').insert([{
  curator_id: utenti.curatore.id,
  custody_type: 'in_sede',
  owner_percentage: 70, curator_percentage: 20,
  qr_token: token,
  qr_expires_at: new Date(Date.now()+30*60*1000).toISOString(),
  draft_title: 'PROVA sonda', draft_price: 10, draft_condition: 'Usato',
}]).select().single()
console.log('INSERT mandato dal browser:', errIns ? 'FALLITO -> '+errIns.message : 'riuscito, id '+mandato.id.slice(0,8))

fs.writeFileSync('_probe.json', JSON.stringify({ utenti, token, mandatoId: mandato?.id, sess: sess?.session?.access_token }, null, 2))
