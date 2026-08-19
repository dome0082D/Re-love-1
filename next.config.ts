import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora gli errori di TypeScript durante la pubblicazione su Vercel
  typescript: {
    ignoreBuildErrors: true,
  },

  // ==========================================================================
  // APP ANDROID (TWA): il file di verifica deve stare a un indirizzo preciso.
  //
  // Chrome cerca la prova di proprietà del sito esattamente qui:
  //     /.well-known/assetlinks.json
  // Non altrove, non con un altro nome.
  //
  // Il contenuto però dipende dall'impronta della chiave di firma, che vive
  // in una variabile d'ambiente e può cambiare (Google Play rifirma le app
  // con una chiave sua). Per questo il file è generato da una route -
  // app/api/assetlinks - e qui la agganciamo all'indirizzo che Chrome si
  // aspetta. Chi visita quell'indirizzo vede il file; l'indirizzo resta
  // quello giusto.
  // ==========================================================================
  async rewrites() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/assetlinks',
      },
    ]
  },

  // Nelle nuove versioni di Next.js, la configurazione di ESLint
  // non va più inserita in questo file, per questo è stata rimossa.
};

export default nextConfig;
