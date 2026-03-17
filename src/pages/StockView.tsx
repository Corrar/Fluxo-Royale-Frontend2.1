import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Package, Box, DollarSign, Pencil, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function StockView() {
  const { profile, permissions } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // ESTADOS DE EDIÇÃO
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [priceForm, setPriceForm] = useState({ unit_price: "", sales_price: "" });

  // --- LÓGICA DE PERMISSÕES DINÂMICA ---
  const userRole = profile?.role || "setor";
  const userPerms = permissions || [];

  // Nível 3 (Edição): Tem permissão explícita OU é admin
  const canEditPrices = userPerms.includes("stock_view_edit") || userRole === "admin";
  
  // Nível 2 (Financeiro): Tem permissão financeira, OU edição, OU é admin, OU é compras/chefe (legacy)
  const canViewPrices = userPerms.includes("stock_view_financial") || canEditPrices || ["admin", "compras", "chefe"].includes(userRole);

  // 1. BUSCAR ESTOQUE
  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => {
      const response = await api.get("/stock");
      return response.data;
    },
  });

  // 2. MUTAÇÃO PARA ATUALIZAR PREÇOS
  const updatePriceMutation = useMutation({
    mutationFn: async (values: { id: string, unit_price: number, sales_price: number }) => {
      // Atualiza na tabela de produtos
      await api.put(`/products/${values.id}`, { 
        unit_price: values.unit_price,
        sales_price: values.sales_price
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] }); // Atualiza a lista
      toast.success("Valores atualizados com sucesso!");
      setIsEditOpen(false);
    },
    onError: () => toast.error("Erro ao atualizar valores.")
  });

  // 3. FILTRAGEM INTELIGENTE
  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    if (!searchTerm) return stocks;

    const term = searchTerm.toLowerCase();
    return stocks.filter((stock: any) => {
      const productName = stock.products?.name?.toLowerCase() || "";
      const productSku = stock.products?.sku?.toLowerCase() || "";
      return productName.includes(term) || productSku.includes(term);
    });
  }, [stocks, searchTerm]);

  // Helpers
  const formatMoney = (val: any) => {
    if (!val) return "R$ 0,00";
    return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleEditClick = (stock: any) => {
    setEditingItem(stock.products);
    setPriceForm({
      unit_price: stock.products?.unit_price || "0",
      sales_price: stock.products?.sales_price || "0"
    });
    setIsEditOpen(true);
  };

  const handleSave = () => {
    if (!editingItem) return;
    updatePriceMutation.mutate({
      id: editingItem.id,
      unit_price: parseFloat(priceForm.unit_price),
      sales_price: parseFloat(priceForm.sales_price)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Consulta de Estoque</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">
                {canEditPrices ? "Modo Gestor: Visualização e Edição Financeira." : 
                 canViewPrices ? "Modo Financeiro: Visualização de Custos e Venda." : 
                 "Verifique a disponibilidade de materiais."}
            </p>
            {/* Badge indicando o nível de acesso */}
            {canEditPrices ? <Badge className="bg-amber-500 hover:bg-amber-600">Edição</Badge> : 
             canViewPrices ? <Badge className="bg-blue-500 hover:bg-blue-600">Financeiro</Badge> : 
             null}
          </div>
        </div>
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabela de Estoque */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Qtd. Disponível</TableHead>
              
              {/* COLUNAS FINANCEIRAS (Nível 2 e 3) */}
              {canViewPrices && (
                <>
                  <TableHead className="text-right text-muted-foreground">Custo Unit.</TableHead>
                  <TableHead className="text-right text-emerald-600 font-bold">Valor Venda</TableHead>
                </>
              )}
              
              {/* COLUNA AÇÕES (Nível 3) */}
              {canEditPrices && <TableHead className="w-[50px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canViewPrices ? 6 : 3} className="text-center h-24">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Box className="h-4 w-4 animate-bounce" /> Carregando estoque...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStocks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canViewPrices ? 6 : 3} className="text-center h-24 text-muted-foreground">
                  {searchTerm ? "Nenhum produto encontrado" : "Estoque vazio"}
                </TableCell>
              </TableRow>
            ) : (
              filteredStocks.map((stock: any) => {
                const disponivel = Number(stock.quantity_on_hand) - Number(stock.quantity_reserved);
                const isAvailable = disponivel > 0;

                return (
                  <TableRow key={stock.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            {stock.products?.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono pl-6">{stock.products?.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">{stock.products?.unit}</TableCell>
                    
                    <TableCell className="text-center">
                      <span className={`font-bold ${isAvailable ? "text-green-600" : "text-red-500"}`}>
                        {disponivel > 0 ? disponivel : "0"}
                      </span>
                    </TableCell>

                    {/* VALORES (Nível 2 e 3) */}
                    {canViewPrices && (
                      <>
                        <TableCell className="text-right text-muted-foreground font-mono text-sm">
                          {formatMoney(stock.products?.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700 font-mono text-sm font-bold">
                          {formatMoney(stock.products?.sales_price)}
                        </TableCell>
                      </>
                    )}

                    {/* EDITAR (Nível 3) */}
                    {canEditPrices && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(stock)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG DE EDIÇÃO (Nível 3) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Atualizar Valores</DialogTitle>
          </DialogHeader>
          
          <div className="bg-muted/50 p-3 rounded-md border mb-4">
            <p className="text-sm font-medium">{editingItem?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">SKU: {editingItem?.sku}</p>
          </div>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Custo Unitário (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  step="0.01" 
                  className="pl-9" 
                  value={priceForm.unit_price} 
                  onChange={(e) => setPriceForm({...priceForm, unit_price: e.target.value})} 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs text-emerald-600 uppercase font-bold">Valor de Venda (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-emerald-600" />
                <Input 
                  type="number" 
                  step="0.01" 
                  className="pl-9 border-emerald-200 focus-visible:ring-emerald-500 font-bold text-emerald-700" 
                  value={priceForm.sales_price} 
                  onChange={(e) => setPriceForm({...priceForm, sales_price: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={updatePriceMutation.isPending}>
              {updatePriceMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}