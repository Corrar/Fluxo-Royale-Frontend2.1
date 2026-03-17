import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingCart, Trash2, Package, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

// Setores definidos no seu sistema
const SECTORS = ["Elétrica", "Flow", "Esteira", "Lavadora", "Usinagem", "Desenvolvimento", "Outro"];

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
}

export function StockWithdrawalPanel() {
  const queryClient = useQueryClient();
  
  // Estados
  const [sector, setSector] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Estados do Dialog de Quantidade
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState("");

  // 1. Buscar Produtos Reais da API
  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data;
    },
  });

  // 2. Mutação para Enviar a Retirada (Conectado ao endpoint existente /manual-withdrawal)
  const withdrawalMutation = useMutation({
    mutationFn: async (data: { sector: string; items: { product_id: string; quantity: number }[] }) => {
      await api.post("/manual-withdrawal", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Retirada registrada com sucesso!");
      // Limpar formulário
      setCart([]);
      setSector("");
      setSearchTerm("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erro ao registrar retirada");
    },
  });

  // Filtragem de produtos (Busca)
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products.slice(0, 5); // Mostra 5 se não tiver busca
    
    return products.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  // Handlers
  const handleProductSelect = (product: any) => {
    // Verifica se já está no carrinho
    if (cart.find(item => item.product_id === product.id)) {
      toast.warning("Este produto já está na lista.");
      return;
    }
    
    // CORREÇÃO: Usar product.quantity direto (nova estrutura do backend)
    const available = Number(product.quantity || 0);

    if (available <= 0) {
      toast.error("Produto sem estoque disponível.");
      return;
    }

    setSelectedProduct({ ...product, available });
    setQtyInput("");
    setIsQtyDialogOpen(true);
  };

  const confirmAddItem = () => {
    const qtd = parseFloat(qtyInput);
    if (!qtd || qtd <= 0) {
      toast.error("Digite uma quantidade válida.");
      return;
    }
    if (qtd > selectedProduct.available) {
      toast.error(`Quantidade indisponível. Máximo: ${selectedProduct.available}`);
      return;
    }

    setCart([...cart, {
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      unit: selectedProduct.unit,
      quantity: qtd
    }]);

    setIsQtyDialogOpen(false);
    toast.success("Item adicionado à lista");
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.product_id !== id));
  };

  const handleSubmit = () => {
    if (!sector) {
      toast.error("Selecione o setor de destino.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione produtos à lista.");
      return;
    }

    withdrawalMutation.mutate({
      sector,
      items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2 h-full">
      {/* LADO ESQUERDO: Busca e Seleção */}
      <Card className="flex flex-col h-full border-muted-foreground/20 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar Produtos
          </CardTitle>
          <CardDescription>Selecione os itens para retirada imediata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Digite nome ou SKU..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto pr-2">
            {isLoading && <p className="text-center text-sm text-muted-foreground">Carregando produtos...</p>}
            
            {!isLoading && filteredProducts.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum produto encontrado.</p>
            )}

            {filteredProducts.map((product: any) => {
               // CORREÇÃO: Usar product.quantity direto
               const available = Number(product.quantity || 0);
               const isLow = available < (product.min_stock || 0);

               return (
                <div 
                  key={product.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors group"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={available > 0 ? "outline" : "destructive"} className="mb-1">
                      {available} {product.unit}
                    </Badge>
                    {isLow && available > 0 && <p className="text-[10px] text-yellow-600 font-bold">Estoque Baixo</p>}
                  </div>
                </div>
               );
            })}
          </div>
        </CardContent>
      </Card>

      {/* LADO DIREITO: Carrinho e Confirmação */}
      <div className="flex flex-col gap-6">
        <Card className="flex-1 border-muted-foreground/20 shadow-md flex flex-col">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Lista de Retirada
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6 flex flex-col">
            <div className="space-y-4 mb-6">
              <Label>Setor de Destino</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md flex-1 overflow-hidden flex flex-col min-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-24 text-center">Qtd.</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                        Sua lista está vazia
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground block">{item.sku}</span>
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveItem(item.product_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6">
              <Button 
                className="w-full h-12 text-lg" 
                onClick={handleSubmit}
                disabled={cart.length === 0 || !sector || withdrawalMutation.isPending}
              >
                {withdrawalMutation.isPending ? "Processando..." : (
                  <>Confirmar Saída <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DIALOG PARA QUANTIDADE */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informe a Quantidade</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div>
                <p className="font-medium text-lg">{selectedProduct.name}</p>
                <p className="text-sm text-muted-foreground">Disponível: {selectedProduct.available} {selectedProduct.unit}</p>
              </div>
              <div className="flex gap-2 items-center">
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00" 
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="text-lg h-12"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()}
                />
                <span className="text-muted-foreground font-medium">{selectedProduct.unit}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQtyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAddItem}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}