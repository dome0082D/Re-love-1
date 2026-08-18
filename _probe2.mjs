import fs from 'fs'
const st = JSON.parse(fs.readFileSync('_probe.json','utf8'))
const B = 'http://localhost:3227'
async function post(path, body, token) {
  const r = await fetch(B+path, { method:'POST', headers:{'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{})}, body: JSON.stringify(body) })
  let j; try { j = await r.json() } catch { j = '(non json)' }
  return { stato: r.status, corpo: j }
}

console.log('--- 1. anteprima con il token nudo (come fa lo scanner) ---')
console.log(JSON.stringify(await post('/api/curatore/preview', { qrToken: st.token })))

console.log('\n--- 2. anteprima incollando il CONTENUTO del QR ---')
console.log(JSON.stringify(await post('/api/curatore/preview', { qrToken: 'RELOVE_MANDATE:'+st.token })))

console.log('\n--- 3. anteprima incollando un LINK che contiene il token ---')
console.log(JSON.stringify(await post('/api/curatore/preview', { qrToken: `https://re-love.vercel.app/curatore/scansiona?codice=${st.token}` })))

console.log('\n--- 4. approvazione da parte del proprietario (senza conto Stripe) ---')
console.log(JSON.stringify(await post('/api/curatore/approve', { qrToken: st.token, ownerId: st.utenti.proprietario.id, azione: 'approva' })))

console.log('\n--- 5. FALSIFICAZIONE: approvo a nome di un altro utente, senza essere loggato ---')
console.log(JSON.stringify(await post('/api/curatore/approve', { qrToken: st.token, ownerId: st.utenti.proprietario.id, azione: 'rifiuta' })))
