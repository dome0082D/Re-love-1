'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Assicurati che il percorso sia corretto
import Image from 'next/image';

export default function HomePage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Logica di filtraggio (basata su quello che si intravede nel tuo screenshot)
  useEffect(() => {
    let results = announcements;

    if (activeFilter === 'wanted') {
      // Esempio: filtra per categoria o tipo 'cerco'
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
    // Recupera l'utente
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Recupera gli annunci da Supabase
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
    <main className="min-h-screen bg-white">
      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-8 py-4 border-b">
        <div className="text-2xl font-bold tracking-tighter text-gray-800">
          MATERIALI
        </div>
        <button className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-1.5 rounded-md font-medium text-sm transition-colors">
          ACCEDI
        </button>
      </nav>

      {/* HERO SECTION CON IMMAGINE */}
      <section 
        className="relative h-[1920px] flex items-center justify-center overflow-hidden mx-4 my-4 rounded-xl shadow-lg"
        style={{ 
          backgroundImage: "url('/gazebo.jpg')", // Assicurati di aver salvato l'immagine in /public
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Overlay scuro per leggibilità */}
        <div className="absolute inset-0 bg-black/30"></div>

        <div className="relative z-10 w-full max-w-3xl px-6 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-serif italic mb-2 drop-shadow-md">
            Recupera, regala o vendi.
          </h1>
          <p className="text-2xl md:text-3xl font-serif italic mb-8 drop-shadow-md">
            Il valore non si butta mai.
          </p>

          {/* BARRA DI RICERCA */}
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cerca materiali (es. mattoni, legno...)"
              className="w-full py-4 pl-12 pr-4 rounded-full text-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* GRIGLIA ANNUNCI (Preview) */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAnnouncements.map((item) => (
            <div key={item.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              {/* Qui va la logica per visualizzare i tuoi dati da Supabase */}
              <div className="h-48 bg-gray-100 relative">
                {item.image_url && <img src={item.image_url} alt={item.title} className="object-cover w-full h-full" />}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="text-gray-600 text-sm line-clamp-2">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}