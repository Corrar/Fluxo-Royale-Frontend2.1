import React, { useState, useEffect } from "react";
import { subscribeToLoading } from "@/services/api";

// --- Utility ---
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// --- Componente: SVG Spinner (Loader Circular) ---
const SvgSpinner = () => {
  return (
    <div className="relative flex items-center justify-center">
      <style>
        {`
          .svg-loader {
            width: 3.25em;
            transform-origin: center;
            animation: rotate4 2s linear infinite;
          }

          .svg-circle {
            fill: none;
            /* Cor Azul Royal (#1d4ed8 equivale ao blue-700 do Tailwind) */
            stroke: #1d4ed8; 
            stroke-width: 2;
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
            stroke-linecap: round;
            animation: dash4 1.5s ease-in-out infinite;
          }

          @keyframes rotate4 {
            100% {
              transform: rotate(360deg);
            }
          }

          @keyframes dash4 {
            0% {
              stroke-dasharray: 1, 200;
              stroke-dashoffset: 0;
            }
            50% {
              stroke-dasharray: 90, 200;
              stroke-dashoffset: -35px;
            }
            100% {
              stroke-dashoffset: -125px;
            }
          }
        `}
      </style>
      
      <div className="p-4 bg-white/50 rounded-full backdrop-blur-sm">
        <svg className="svg-loader" viewBox="25 25 50 50">
          <circle className="svg-circle" r="20" cy="50" cx="50"></circle>
        </svg>
      </div>
    </div>
  );
};

export interface LoadingScreenProps {
  className?: string;
  message?: string;
  isLoading?: boolean;
}

export function LoadingScreen({ className, message, isLoading: propLoading }: LoadingScreenProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  
  // Verifica se o componente está sendo controlado por props (ex: GlobalLoader)
  const isControlled = propLoading !== undefined;
  
  // Se tem mensagem, forçamos a exibição.
  const hasMessage = !!message;

  // Lógica de exibição:
  // 1. Se tem mensagem, mostra.
  // 2. Se é controlado, usa a prop.
  // 3. Se não é controlado, usa o estado interno.
  const shouldShow = hasMessage || (isControlled ? propLoading : internalLoading);

  useEffect(() => {
    // Se o componente está sendo controlado externamente (pelo App.tsx),
    // NÓS NÃO DEVEMOS ASSINAR O LISTENER INTERNO.
    // Isso evita o conflito onde o componente "lembra" que estava carregando.
    if (isControlled || hasMessage) {
      setInternalLoading(false); // Reseta para garantir limpeza
      return;
    }

    // Apenas assina o evento global se o componente estiver "solto" (sem props de controle)
    const unsubscribe = subscribeToLoading((loadingState) => {
      setInternalLoading(loadingState);
    });

    return () => unsubscribe();
  }, [isControlled, hasMessage]);

  if (!shouldShow) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center",
        "bg-white/95 backdrop-blur-xl", // Fundo branco limpo
        "transition-opacity duration-300 ease-in-out",
        className
      )}
    >
      {/* Loader aumentado para destaque */}
      <div className="scale-150 transform mb-6">
        <SvgSpinner />
      </div>

      {/* Texto da mensagem (se houver) */}
      {message && (
        <h2 className="text-blue-700 font-semibold text-lg tracking-wide animate-pulse">
          {message}
        </h2>
      )}
    </div>
  );
}

export default LoadingScreen;