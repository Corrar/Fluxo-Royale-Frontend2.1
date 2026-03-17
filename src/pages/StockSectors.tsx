import { Setores } from "@/components/stock/Setores";

export default function StockSectors() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Título da Página (Opcional, pois o componente já tem cabeçalho) */}
      {/* <h1 className="text-3xl font-bold tracking-tight">Visão de Setores</h1> */}
      
      <Setores />
    </div>
  );
}