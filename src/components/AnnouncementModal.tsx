import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// --- ÁREA DE CONTROLE ---
const ANUNCIO_URL = "/anuncio.jpeg";

export function AnnouncementModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuth(); 

  useEffect(() => {
    if (ANUNCIO_URL && ANUNCIO_URL.length > 0 && profile) {
      const jaViu = sessionStorage.getItem("anuncio_visto");

      if (!jaViu) {
        const timer = setTimeout(() => {
          setIsOpen(true);
          sessionStorage.setItem("anuncio_visto", "true");
        }, 1000); 

        return () => clearTimeout(timer);
      }
    }
  }, [profile]);

  if (!ANUNCIO_URL || !profile) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        // --- MELHORIAS DE CONTAINER ---
        // w-fit: O modal abraça o tamanho da imagem, não fica esticado.
        // max-w-[90vw]: Garante uma margem segura nas laterais em celulares.
        // outline-none: Remove borda de foco azul padrão.
        className="
          [&>button]:hidden 
          p-0 
          border-none 
          shadow-none 
          bg-transparent 
          w-fit 
          max-w-[90vw] 
          md:max-w-fit 
          overflow-visible 
          flex flex-col items-center 
          outline-none
        "
        onOpenAutoFocus={(e) => e.preventDefault()} 
      >
        {/* Título invisível para satisfazer requisitos de acessibilidade do Radix UI sem poluir o visual */}
        <DialogTitle className="sr-only">Anúncio do Sistema</DialogTitle>
        
        <div className="relative group animate-in zoom-in-95 fade-in-0 duration-300">
          
          {/* --- BOTÃO FECHAR RESPONSIVO E VISÍVEL --- */}
          <button 
            onClick={() => setIsOpen(false)}
            // Mobile: Fica dentro da imagem (canto superior direito), mas com fundo para contraste.
            // Desktop: "Flutua" para fora no canto direito (efeito satélite).
            className="
              absolute z-50 flex items-center justify-center
              top-3 right-3 
              md:-top-4 md:-right-4 lg:-right-10 lg:top-0
              
              bg-white/90 hover:bg-white text-zinc-900
              backdrop-blur-sm
              border border-white/20
              rounded-full 
              p-2 md:p-2.5
              shadow-lg 
              transition-all duration-200 ease-out
              hover:scale-110 active:scale-95
              cursor-pointer
            "
            title="Fechar anúncio"
            aria-label="Fechar anúncio"
          >
            <X className="h-5 w-5 md:h-6 md:w-6 font-bold stroke-[2.5]" />
          </button>

          {/* --- IMAGEM OTIMIZADA --- */}
          <div className="rounded-xl overflow-hidden shadow-2xl bg-zinc-900/5 select-none">
            <img 
              src={ANUNCIO_URL} 
              alt="Anúncio Importante" 
              // max-h-[75vh]: No mobile, deixamos margem vertical maior para barras de navegador.
              // object-contain: Garante que a imagem inteira apareça sem cortes.
              className="
                block 
                w-auto h-auto 
                max-h-[75vh] 
                md:max-h-[85vh] 
                max-w-full 
                object-contain
              "
            />
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
