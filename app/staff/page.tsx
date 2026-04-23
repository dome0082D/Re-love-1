import Link from 'next/link'

export default function StaffDashboard() {
  return (
    <div className="min-h-screen bg-stone-50 p-10 pt-20 flex flex-col items-center">
      <h1 className="text-4xl font-black uppercase italic text-stone-900 mb-4">Pannello Staff 👑</h1>
      <p className="text-stone-500 mb-10 font-medium uppercase tracking-widest text-xs">Scegli cosa moderare</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link href="/staff/annunci" className="bg-white border-2 border-stone-200 p-8 rounded-3xl shadow-sm hover:border-orange-400 hover:shadow-md transition-all text-center group">
          <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">📦</span>
          <h2 className="font-bold uppercase text-stone-800 tracking-widest">Annunci</h2>
          <p className="text-xs text-stone-400 mt-2">Modifica o elimina inserzioni</p>
        </Link>

        <Link href="/staff/users" className="bg-white border-2 border-stone-200 p-8 rounded-3xl shadow-sm hover:border-rose-400 hover:shadow-md transition-all text-center group">
          <span className="text-5xl block mb-4 group-hover:scale-110 transition-transform">👥</span>
          <h2 className="font-bold uppercase text-stone-800 tracking-widest">Utenti e Chat</h2>
          <p className="text-xs text-stone-400 mt-2">Gestisci profili e messaggi</p>
        </Link>
      </div>
    </div>
  )
}