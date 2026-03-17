import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SectorStockData, StockWithProduct } from "@/types/stock-display";

export function useSectorStock() {
  return useQuery({
    queryKey: ["sector-stock"],
    queryFn: async (): Promise<SectorStockData[]> => {
      // 1. Buscar Locais
      const { data: locations, error: locError } = await supabase
        .from("locations") // Verifique se o nome da sua tabela é esse
        .select("*");

      if (locError) throw locError;

      // 2. Buscar Estoque com Produtos (Join)
      // Nota: Ajuste 'stocks' e 'products' para os nomes reais das suas tabelas
      const { data: stockItems, error: stockError } = await supabase
        .from("stocks") 
        .select(`
          id,
          quantity,
          location_id,
          products (
            id,
            name,
            sku,
            category,
            unit,
            min_stock
          )
        `);

      if (stockError) throw stockError;

      // 3. Formatar e Agrupar os Dados
      const formattedData: SectorStockData[] = locations.map((location) => {
        // Filtra os itens que pertencem a este local
        const locationItems = stockItems.filter((item: any) => item.location_id === location.id);

        // Formata os produtos para o padrão visual
        const formattedItems: StockWithProduct[] = locationItems.map((item: any) => {
          const product = item.products;
          const minStock = product.min_stock || 0;
          
          // Lógica de Status (Pode ajustar conforme sua regra)
          let status: 'normal' | 'low' | 'critical' = 'normal';
          if (item.quantity <= 0) status = 'critical';
          else if (item.quantity <= minStock) status = 'low';

          return {
            id: item.id,
            quantity: item.quantity,
            status: status,
            product: {
              id: product.id,
              name: product.name,
              sku: product.sku || 'N/A',
              category: product.category || 'Geral',
              unit: product.unit || 'un',
              minStock: minStock
            }
          };
        });

        return {
          location: {
            id: location.id,
            name: location.name,
            description: location.description || '',
            type: location.type || 'standard'
          },
          items: formattedItems
        };
      });

      return formattedData;
    },
    // Atualiza a cada 1 minuto (opcional)
    refetchInterval: 60000 
  });
}
