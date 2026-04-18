'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Assicurati che questo percorso sia corretto per il tuo progetto
import Link from 'next/link';

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [user, setUser] = useState<any>(null);

  // Carica i dati e controlla lo stato dell'utente all'avvio della pagina
  useEffect(() => {
    fetchData();
  }, []);

  // Logica di filtraggio: si attiva quando l'utente scrive nella barra di ricerca
  useEffect(() => {
    let results = announcements;

    if (activeFilter === 'wanted') {
      results = results.filter(item => item.type === 'wanted');
    }

    if (searchTerm) {
      results = results.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredAnnouncements(results);
  }, [searchTerm, activeFilter, announcements]);

  const fetchData = async () => {
    // 1. Recupera l'utente loggato da Supabase (se presente)
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // 2. Recupera gli annunci dalla tabella Supabase
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnnouncements(data);
      setFilteredAnnouncements(data);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* NAVBAR DINAMICA */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="text-2xl font-bold tracking-tighter text-gray-800">
          MATERIALI
        </div>
        
        {/* Mostra "Esci" se l'utente è loggato, altrimenti "Accedi" */}
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600 hidden md:block">
              {user.email}
            </span>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                setUser(null); // Aggiorna lo stato localmente
              }}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              ESCI
            </button>
          </div>
        ) : (
          <Link href="/login">
            <button className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-md font-medium text-sm transition-colors shadow-sm">
              ACCEDI
            </button>
          </Link>
        )}
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* BANNER PRINCIPALE (HERO SECTION) */}
        <section 
          className="relative w-full h-[450px] flex flex-col items-center justify-center rounded-2xl overflow-hidden shadow-2xl mt-6 border border-gray-100"
          style={{ 
            // QUI ABBIAMO IMPOSTATO IL NOME "gazebo"
            backgroundImage: "url('/gazebo.jpeg')", 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        >
          {/* Overlay scuro per migliorare la leggibilità del testo bianco */}
          <div className="absolute inset-0 bg-black/40"></div> 
          
          {/* Contenuto in primo piano (Testo + Ricerca) */}
          <div className="relative z-10 text-center w-full max-w-2xl px-4">
            <h1 className="text-4xl md:text-5xl font-serif italic text-white mb-3 font-bold drop-shadow-lg">
              Recupera, regala o vendi.
            </h1>
            <p className="text-xl md:text-2xl font-serif italic text-gray-100 mb-10 drop-shadow-md">
              Il valore non si butta mai.
            </p>
            
            {/* Barra di ricerca bianca e visibile */}
            <div className="relative max-w-xl mx-auto shadow-2xl rounded-full">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Cerca materiali (es. mattoni, legno...)" 
                className="w-full py-4.5 pl-14 pr-6 text-gray-900 bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500 text-lg placeholder:text-gray-400"
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* SEZIONE GRIGLIA DEGLI ANNUNCI */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 border-l-4 border-sky-500 pl-3">Ultimi arrivi</h2>
          
          {filteredAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
              {filteredAnnouncements.map((item) => (
                <div key={item.id} className="bg-white border rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 group">
                  {/* Immagine dell'annuncio */}
                  <div className="h-52 bg-gray-100 relative overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full h-full text-gray-400 bg-gray-50">
                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-xs">Nessuna immagine</span>
                      </div>
                    )}
                  </div>
                  {/* Testo e Dettagli dell'annuncio */}
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-900 mb-1.5 truncate group-hover:text-sky-600 transition-colors">{item.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-4 h-10">{item.description || 'Nessuna descrizione fornita.'}</p>
                    <div className="mt-auto flex justify-between items-center pt-3 border-t">
                      <span className="text-xl font-bold text-sky-600">
                        {item.price === 0 || !item.price ? 'Gratis' : `€ ${item.price.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              <h3 className="text-xl font-semibold text-gray-700">Nessun materiale trovato</h3>
              <p className="text-gray-500 mt-1">Prova a cambiare la tua ricerca o controlla più tardi.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
