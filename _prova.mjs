import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const B = 'http://localhost:3234'
let falliti = 0
const v = (ok,t) => { if(!ok) falliti++; console.log(`${ok?'  OK  ':' FALLITO '} ${t}`) }
const { data: staff } = await admin.from('profiles').select('stripe_account_id').eq('email','dome0082@gmail.com').single()

const U = {}
for (const r of ['proprietario','curatore','altro','compratore']) {
  const email = `probe-${r}-${Date.now()}@relove-test.invalid`
  const { data } = await admin.auth.admin.createUser({ email, password:'ProvaProva123!', email_confirm:true })
  const c = anon(); const { data: s } = await c.auth.signInWithPassword({ email, password:'ProvaProva123!' })
  U[r] = { id: data.user.id, email, jwt: s.session.access_token }
  await admin.from('profiles').upsert({ id: data.user.id, email, first_name: r,
    stripe_account_id: r === 'compratore' ? null : staff.stripe_account_id })
}
async function creaAnnuncio(extra = {}) {
  const { data } = await admin.from('announcements').insert([{
    user_id: U.proprietario.id, title: 'PROVA candidature', price: 100, quantity: 1,
    condition: 'Usato', category: 'Altro / Varie', cerca_curatore: true,
    curator_percentage: 20, shipping_cost: 0, ...extra,
  }]).select().single()
  return data
}
async function post(p, body, jwt) {
  const r = await fetch(B+p, { method:'POST', headers:{'Content-Type':'application/json', ...(jwt?{Authorization:`Bearer ${jwt}`}:{})}, body: JSON.stringify(body) })
  let j; try { j = await r.json() } catch { j = {} }
  return { s: r.status, ...j }
}

const ann = await creaAnnuncio()
console.log('--- CHI PUO CANDIDARSI ---')
v((await post('/api/curatore/candidatura', { announcementId: ann.id, contesto:'annuncio' })).s === 401, 'senza accesso -> respinto')
v((await post('/api/curatore/candidatura', { announcementId: ann.id, contesto:'annuncio' }, U.proprietario.jwt)).s === 400, 'sul proprio oggetto -> respinto')
v((await post('/api/curatore/candidatura', { announcementId: ann.id, contesto:'arena' }, U.curatore.jwt)).s === 400, 'annuncio normale ma richiesta da Arena -> respinta')
const c1 = await post('/api/curatore/candidatura', { announcementId: ann.id, contesto:'annuncio', messaggio:'Abito in zona' }, U.curatore.jwt)
v(c1.ok === true, 'candidatura valida -> inviata')
v((await post('/api/curatore/candidatura', { announcementId: ann.id, contesto:'annuncio' }, U.curatore.jwt)).s === 409, 'doppia candidatura -> respinta')
const c2 = await post('/api/curatore/candidatura', { announcementId: ann.id, contesto:'annuncio' }, U.altro.jwt)
v(c2.ok === true, 'una seconda persona si candida -> ok')

console.log('\n--- OGGETTO IN ARENA: solo da Arena ---')
const annA = await creaAnnuncio({ is_arena: true, price: 150 })
v((await post('/api/curatore/candidatura', { announcementId: annA.id, contesto:'annuncio' }, U.curatore.jwt)).s === 400, 'Arena dalla scheda -> respinta')
v((await post('/api/curatore/candidatura', { announcementId: annA.id, contesto:'arena' }, U.curatore.jwt)).ok === true, 'Arena dalla pagina Arena -> accettata')

console.log('\n--- CHI DECIDE ---')
v((await post('/api/curatore/decidi', { candidaturaId: c1.candidaturaId, azione:'accetta' }, U.altro.jwt)).s === 403, 'un estraneo non puo accettare')
v((await post('/api/curatore/decidi', { candidaturaId: c1.candidaturaId, azione:'accetta' }, U.curatore.jwt)).s === 403, 'il candidato non puo auto-accettarsi')
const acc = await post('/api/curatore/decidi', { candidaturaId: c1.candidaturaId, azione:'accetta' }, U.proprietario.jwt)
v(acc.ok === true, `il proprietario accetta -> ${acc.ok ? 'fatto' : acc.error}`)
v(!!acc.codicePersonale, `link personale generato (${acc.codicePersonale})`)
v(!!acc.scadeIl, `scadenza a 30 giorni (${acc.scadeIl?.slice(0,10)})`)
const { data: aDopo } = await admin.from('announcements').select('curator_id, owner_id, mandate_id, cerca_curatore').eq('id', ann.id).single()
v(aDopo.curator_id === U.curatore.id && aDopo.mandate_id === c1.candidaturaId, 'annuncio collegato al curatore e alla candidatura')
v(aDopo.cerca_curatore === false, 'annuncio non cerca piu un curatore')
const { data: scartata } = await admin.from('curator_candidature').select('stato').eq('id', c2.candidaturaId).single()
v(scartata.stato === 'rifiutata', 'la candidatura dell altra persona e stata chiusa')

fs.writeFileSync('_stato.json', JSON.stringify({ U, ann: ann.id, annA: annA.id, cand: c1.candidaturaId, codice: acc.codicePersonale }))
console.log(`\n=== parte 1: ${falliti===0?'TUTTE SUPERATE':falliti+' FALLITE'} ===`)
