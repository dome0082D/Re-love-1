'use client'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export default function Mappa({ announcements = [] }: { announcements?: any[] }) {
  // FIX (SCHERMATA BIANCA / CRASH): react-leaflet ha bisogno degli oggetti
  // del browser (window, document) che sul server NON esistono. Anche con
  // 'use client', Next.js genera comunque l'HTML iniziale lato server: senza
  // questa protezione la mappa poteva far fallire il render con "window is
  // not defined". Disegnamo la mappa solo dopo che il componente è
  // realmente montato nel browser.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // FIX ANDROID: stessa identica soluzione già usata per la mappa Google
  // nella pagina annuncio. Una mappa a tutta larghezza "cattura" il dito
  // durante lo scorrimento verticale: provando a scorrere la pagina si
  // finisce per trascinare la mappa e la pagina resta ferma. Con questo
  // pannello trasparente sopra, il primo tocco serve solo ad attivare la
  // mappa; finché non la si attiva, lo scorrimento della pagina funziona
  // normalmente.
  const [mapActive, setMapActive] = useState(false)

  // FIX: l'icona veniva creata al caricamento del file, cioè anche sul
  // server dove Leaflet non è pienamente disponibile. Ora viene creata solo
  // dentro il componente, quando serve davvero.
  const icon = useMemo(() => L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
  }), [])

  if (!mounted) {
    return (
      <div className="h-full w-full min-h-[400px] bg-stone-100 rounded-[2rem] flex items-center justify-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 animate-pulse">
          Caricamento mappa...
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full min-h-[400px]">
      <MapContainer
        center={[41.8719, 12.5674]}
        zoom={6}
        className="h-full w-full min-h-[400px]"
        // FIX: lo zoom con la rotella catturava lo scroll della pagina anche
        // su desktop, quando il puntatore passava sopra la mappa durante una
        // normale scorrimento. Ora si zooma solo con i pulsanti +/- o, su
        // touch, con due dita dopo aver attivato la mappa.
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // FIX: l'attribuzione richiesta da OpenStreetMap deve includere il
          // link alla licenza - è una condizione d'uso dei loro server di
          // mappe, non un dettaglio estetico.
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {announcements.map((ann) => {
          // FIX: le coordinate arrivano dal database e possono essere
          // stringhe invece che numeri (succede spesso con le colonne
          // numeriche di Postgres). Leaflet in quel caso non posiziona il
          // segnaposto o lo mette nel punto sbagliato. Le convertiamo
          // esplicitamente e saltiamo quelle non valide.
          const lat = Number(ann.latitude)
          const lng = Number(ann.longitude)
          if (!ann.latitude || !ann.longitude || isNaN(lat) || isNaN(lng)) return null

          return (
            <Marker key={ann.id} position={[lat, lng]} icon={icon}>
              <Popup>
                <div className="w-40 font-sans">
                  {ann.image_url ? (
                    <img loading="lazy" decoding="async" src={ann.image_url} alt={ann.title} className="w-full h-20 object-cover rounded mb-2" />
                  ) : (
                    <div className="w-full h-20 bg-stone-100 rounded mb-2 flex items-center justify-center text-[10px] text-stone-400">No Foto</div>
                  )}
                  <p className="font-bold text-[10px] uppercase truncate">{ann.title}</p>
                  <p className="text-rose-500 font-black">€ {ann.price}</p>
                  <a href={`/announcement/${ann.id}`} className="text-[10px] text-blue-500 underline font-bold mt-1 block">Vedi Annuncio</a>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Pannello "tocca per attivare" - vedi nota sopra. Sparisce al primo
          tocco e non torna più finché la pagina resta aperta. */}
      {!mapActive && (
        <div
          onClick={() => setMapActive(true)}
          onTouchStart={() => setMapActive(true)}
          className="absolute inset-0 z-[500] flex items-end justify-center pb-6 bg-transparent cursor-pointer"
        >
          <span className="bg-stone-900/80 text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
            Tocca per attivare la mappa
          </span>
        </div>
      )}
    </div>
  )
}
