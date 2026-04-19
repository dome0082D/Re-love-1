'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  // Aggiunto <any> per risolvere l'errore di compilazione TypeScript
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stripeLoading, setStripeLoading] = useState(false)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({ first_name: '', last_name: '', city: '' })
  const [saving, setSaving] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)

    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
    setProfile(data)
    
    if (data) {
      setEditForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        city: data.city || ''
      })
    }
    setLoading(false)
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          city: editForm.city
        })
        .eq('id', user.id)

      if (error) throw error

      setProfile({ ...profile, ...editForm })
      setIsEditing(false)
    } catch (error: any) {
      alert("Errore durante il salvataggio: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleStripeOnboarding() {
    setStripeLoading(true)
    try {
      const res = await fetch('/api/stripe/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      })
      const data = await res.json()
      
      if (data.url) {
        if (!profile.stripe_account_id) {
          await supabase.from('profiles').update({ stripe_account_id: data.accountId }).eq('id', user.id)
        }
        window.location.href = data.url
      } else {
        alert("Errore Stripe: " + data.error)
      }
    } catch (err) {
      alert("Errore durante il collegamento a Stripe.")
    } finally {
      setStripeLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-center text-sm text-stone-500">Caricamento profilo...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans text-stone-900">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* INTESTAZIONE E DATI PERSONALI */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-stone-900"></div>
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-stone-900">Il mio profilo</h1>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)} 
                className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
              >
                Modifica
              </button>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditing(false)} 
                  className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  onClick={saveProfile} 
                  disabled={saving}
                  className="text-sm font-medium bg-stone-900 text-white px-4 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  {saving ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            {isEditing ? (
              /* MODALITÀ MODIFICA */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1">Nome</p>
                    <input 
                      type="text" 
                      value={editForm.first_name} 
                      onChange={(e) => setEditForm({...editForm, first_name: e.target.value})}
                      className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500 mb-1">Cognome</p>
                    <input 
                      type="text" 
                      value={editForm.last_name} 
                      onChange={(e) => setEditForm({...editForm, last_name: e.target.value})}
                      className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-1">Email (Non modificabile)</p>
                  <input 
                    type="text" 
                    value={user?.email || ''} 
                    disabled 
                    className="w-full p-2 border border-stone-100 bg-stone-50 rounded-xl text-sm text-stone-400"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500 mb-1">Città</p>
                  <input 
                    type="text" 
                    value={editForm.city} 
                    onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                    className="w-full p-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>
            ) : (
              /* MODALITÀ VISUALIZZAZIONE */
              <>
                <div>
                  <p className="text-xs font-medium text-stone-500">Nome e Cognome</p>
                  <p className="text-base">{profile?.first_name} {profile?.last_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-500">Email di contatto</p>
                  <p className="text-base">{user?.email}</p>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-xs font-medium text-stone-500">Città</p>
                    <p className="text-base capitalize">{profile?.city || 'Non specificata'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-500">ID Utente</p>
                    <p className="text-base">#{profile?.user_serial_id || '---'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SEZIONE PAGAMENTI (STRIPE CONNECT) */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-1">Ricezione pagamenti</h2>
          <p className="text-sm text-stone-500 mb-6">
            Per vendere oggetti e ricevere i soldi sul tuo conto, devi configurare il tuo portafoglio Stripe.
          </p>

          {profile?.stripe_onboarding_complete ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Conto Stripe collegato</p>
                <p className="text-xs text-emerald-600 mt-0.5">Sei pronto a ricevere pagamenti in sicurezza.</p>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleStripeOnboarding}
              disabled={stripeLoading}
              className="w-full bg-emerald-500 text-white p-3.5 rounded-2xl font-medium text-sm hover:bg-emerald-600 transition-all shadow-sm"
            >
              {stripeLoading ? 'Connessione in corso...' : 'Attiva ricezione pagamenti'}
            </button>
          )}
        </div>

        {/* MENU RAPIDO NAVIGAZIONE */}
        <div className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/acquisti" className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:border-stone-400 transition-all group">
                <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">📦</span>
                <p className="text-sm font-medium text-stone-900">I miei acquisti</p>
            </Link>
            <Link href="/dashboard/preferiti" className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:border-stone-400 transition-all group">
                <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">❤️</span>
                <p className="text-sm font-medium text-stone-900">I miei preferiti</p>
            </Link>
        </div>

        <div className="pt-6 text-center">
          <Link href="/" className="text-sm font-medium text-stone-400 hover:text-stone-900 transition-colors">
            ← Torna alla vetrina
          </Link>
        </div>

      </div>
    </div>
  )
}
