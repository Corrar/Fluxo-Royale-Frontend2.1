import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// ✨ IMPORTANTE: Importamos o plugin do PWA
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    
    // ✨ Configuração do VitePWA para funcionamento offline total
    VitePWA({
      strategies: 'injectManifest', // Diz ao Vite para usar o teu próprio ficheiro sw.js
      srcDir: 'public',             // A pasta onde colocaste o teu sw.js
      filename: 'sw.js',            // O nome do ficheiro do teu Service Worker
      registerType: 'autoUpdate',   // Atualiza a app automaticamente quando houver nova versão
      injectManifest: {
        // Pega nestes ficheiros todos (toda a estrutura visual) para a app abrir sem internet
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,json}'],
        
        // 🔥 A MAGIA CONTRA A TELA PRETA: Aumentamos o limite para 15MB 
        // para garantir que os ficheiros das abas (Lazy Loading) não ficam de fora!
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
      devOptions: {
        enabled: true, // Permite testar o Service Worker mesmo em ambiente de desenvolvimento
        type: 'module'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
