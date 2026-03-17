import { Building2, Package, AlertTriangle, TrendingUp, Boxes, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectorCard } from './SectorCard';
// Certifique-se de que o hook foi criado em src/hooks/useSectorStock.ts
import { useSectorStock } from '@/hooks/useSectorStock'; 

export function Setores() {
  // Chamada do Hook que busca os dados reais no Supabase
  const { data: sectorStocks, isLoading, isError } = useSectorStock();

  // 1. Estado de Carregamento
  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] w-full items-center justify-center gap-4 animate-fade-in">
        <div className="relative">
           <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
           <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-muted-foreground font-medium animate-pulse">Carregando dados dos setores...</p>
      </div>
    );
  }

  // 2. Estado de Erro ou Dados Vazios
  if (isError || !sectorStocks) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center p-6">
        <Card className="max-w-md w-full border-destructive/20 bg-destructive/5">
          <CardContent className="flex flex-col items-center text-center pt-6 pb-6 gap-4">
             <div className="p-3 rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-8 w-8" />
             </div>
             <div>
               <h3 className="font-bold text-lg">Erro ao carregar</h3>
               <p className="text-muted-foreground text-sm mt-1">
                 Não foi possível buscar os dados do estoque. Verifique sua conexão ou se as tabelas 'locations' e 'stocks' foram criadas no banco.
               </p>
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Cálculos Dinâmicos (Com dados reais)
  const totalSectors = sectorStocks.length;
  const totalItems = sectorStocks.reduce((sum, s) => sum + s.items.length, 0);
  const totalQuantity = sectorStocks.reduce((sum, s) => sum + s.items.reduce((q, i) => q + i.quantity, 0), 0);
  const alertItems = sectorStocks.reduce((sum, s) => sum + s.items.filter(i => i.status !== 'normal').length, 0);

  // 4. Renderização Principal
  return (
    <div className="space-y-8 p-6 animate-fade-in">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white border-0 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:-translate-y-1 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 opacity-80" />
              <span className="text-sm opacity-80">Setores</span>
            </div>
            <p className="text-4xl font-bold">{totalSectors}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:-translate-y-1 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 opacity-80" />
              <span className="text-sm opacity-80">Produtos</span>
            </div>
            <p className="text-4xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-1 transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Boxes className="w-5 h-5 opacity-80" />
              <span className="text-sm opacity-80">Total em Estoque</span>
            </div>
            <p className="text-4xl font-bold">{totalQuantity}</p>
          </CardContent>
        </Card>
        
        <Card className={`text-white border-0 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all ${
          alertItems > 0 
            ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/25' 
            : 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/25'
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              {alertItems > 0 ? (
                <AlertTriangle className="w-5 h-5 opacity-80" />
              ) : (
                <TrendingUp className="w-5 h-5 opacity-80" />
              )}
              <span className="text-sm opacity-80">Alertas</span>
            </div>
            <p className="text-4xl font-bold">{alertItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Estoques por Setor</h2>
          <p className="text-muted-foreground">Clique em um setor para ver detalhes completos</p>
        </div>
      </div>

      {/* Grid de Setores */}
      {sectorStocks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
          Nenhum setor encontrado no banco de dados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sectorStocks.map(({ location, items }, index) => (
            <SectorCard 
              key={location.id} 
              location={location} 
              items={items} 
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
