'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Assicurati che questo percorso corrisponda al tuo file supabase.ts

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [user, setUser] = useState<any>(null);

  // Carica i dati all'avvio della pagina
  useEffect(() => {
    fetchData();
  }, []);

  // Filtra i risultati quando l'utente scrive nella barra di ricerca
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
    // Recupera l'utente loggato (se presente)
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Recupera gli annunci dalla tabella Supabase
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
      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b sticky top-0 z-50">
        <div className="text-2xl font-bold tracking-tighter text-gray-800">
          MATERIALI
        </div>
        <button className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-md font-medium text-sm transition-colors shadow-sm">
          ACCEDI
        </button>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* BANNER PRINCIPALE (HERO) */}
        <section 
          className="relative w-full h-[450px] flex flex-col items-center justify-center rounded-2xl overflow-hidden shadow-2xl mt-6"
          style={{ 
            backgroundImage: "url('/gazebo.jpg')", 
            backgroundSize: 'cover', 
            backgroundPosition: 'center' 
          }}
        >
          {/* Overlay scuro per far leggere il testo */}
          <div className="absolute inset-0 bg-black/40"></div> 
          
          {/* Contenuto Testo + Ricerca */}
          <div className="relative z-10 text-center w-full max-w-2xl px-4">
            <h1 className="text-4xl md:text-5xl font-serif italic text-white mb-3 font-bold drop-shadow-lg">
              Recupera, regala o vendi.
            </h1>
            <p className="text-xl md:text-2xl font-serif italic text-gray-100 mb-10 drop-shadow-md">
              Il valore non si butta mai.
            </p>
            
            {/* Barra di ricerca bianca */}
            <div className="relative max-w-xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Cerca materiali (es. mattoni, legno...)" 
                className="w-full py-4 pl-12 pr-4 text-gray-900 bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xl"
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* GRIGLIA DEGLI ANNUNCI */}
        <section className="py-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Ultimi arrivi</h2>
          
          {filteredAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredAnnouncements.map((item) => (
                <div key={item.id} className="bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
                  {/* Immagine dell'annuncio */}
                  <div className="h-48 bg-gray-200 relative">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="object-cover w-full h-full" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-gray-400">
                        Nessuna immagine
                      </div>
                    )}
                  </div>
                  {/* Testo dell'annuncio */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">{item.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">{item.description}</p>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-sky-600 font-semibold">
                        {item.price === 0 || !item.price ? 'Gratis' : `€${item.price}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Nessun annuncio trovato.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
