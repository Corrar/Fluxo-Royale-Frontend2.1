import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Plus, Trash2, Search, ShoppingCart, ArrowRight, History, Box,
  Clock, CheckCircle2, XCircle, Truck, AlertTriangle, Send, Loader2, Pencil, Save, X, Package, AlertCircle, ShieldAlert
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Configuração de Status ---
const statusConfig = {
  aberto: { label: "Aberto", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  entregue: { label: "Entregue", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300", icon: Truck },
};

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
}

export default function MyRequests() {
  const { profile } = useAuth();
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [sector] = useState(profile?.sector || "Setor não definido");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isQtyDialogOpen, setIsQtyDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState("");

  const [editingRequest, setEditingRequest] = useState<any>(null); 
  const [addItemSearch, setAddItemSearch] = useState(""); 
  
  // 1. SOCKET (Atualização em Tempo Real)
  useEffect(() => {
    if (socket) {
      const handleRefresh = () => {
        // A mágica acontece aqui: Recarrega os dados silenciosamente
        queryClient.invalidateQueries({ queryKey: ["my-requests"] });
        queryClient.invalidateQueries({ queryKey: ["products-list"] });
      };

      socket.on("refresh_requests", handleRefresh);
      socket.on("refresh_stock", handleRefresh); 

      return () => {
        socket.off("refresh_requests", handleRefresh);
        socket.off("refresh_stock", handleRefresh);
      };
    }
  }, [socket, queryClient]);

  // 2. DADOS
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => (await api.get("/my-requests")).data,
    refetchInterval: 5000, 
    placeholderData: keepPreviousData, 
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await api.get("/products")).data,
    placeholderData: keepPreviousData,
  });

  // 3. MUTAÇÕES
  const createRequestMutation = useMutation({
    mutationFn: async (data: { sector: string; items: Array<{ product_id: string; quantity: number }> }) => {
      await api.post("/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] }); 

      toast.success("Solicitação enviada e itens reservados!");
      setCart([]); 
      setActiveTab("history"); 
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Erro ao criar solicitação.";
      toast.error(msg);
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async (data: { id: string; items: Array<{ product_id: string; quantity: number }> }) => {
      await api.put(`/requests/${data.id}`, { items: data.items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["products-list"] });
      toast.success("Pedido atualizado com sucesso!");
      setEditingRequest(null);
      setAddItemSearch("");
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || "Erro ao atualizar solicitação.";
      toast.error(msg);
    },
  });

  // --- Helpers de Cálculo de Estoque (BLINDAGEM) ---
  const getAvailableStock = (product: any) => {
    if (!product || !product.stock) return 0;
    
    const stockInfo = product.stock; 
    const onHand = Number(stockInfo.quantity_on_hand || 0);
    const reserved = Number(stockInfo.quantity_open || 0); 
    
    return Math.max(0, onHand - reserved);
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products.slice(0, 20); 
    return products.filter((p: any) => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const filteredAddProducts = useMemo(() => {
    if (!products || !addItemSearch || !editingRequest) return [];
    const existingIds = editingRequest.items.map((i: any) => i.product_id);
    return products
      .filter((p: any) => !existingIds.includes(p.id)) 
      .filter((p: any) => 
        p.name.toLowerCase().includes(addItemSearch.toLowerCase()) || 
        p.sku.toLowerCase().includes(addItemSearch.toLowerCase())
      )
      .slice(0, 5); 
  }, [products, addItemSearch, editingRequest]);

  // --- Validação em Tempo Real do Carrinho ---
  // Verifica se algum item no carrinho excede o estoque ATUAL (que pode ter mudado via socket)
  const cartValidation = useMemo(() => {
    if (!cart.length || !products) return { isValid: true, invalidItems: [] };

    const invalidItems = cart.filter(item => {
        const product = products.find((p: any) => p.id === item.product_id);
        const currentAvailable = getAvailableStock(product);
        return item.quantity > currentAvailable;
    });

    return {
        isValid: invalidItems.length === 0,
        invalidItems
    };
  }, [cart, products]);

  // --- Handlers Carrinho ---
  const handleProductSelect = (product: any) => {
    if (cart.find(item => item.product_id === product.id)) {
      toast.info("Item já adicionado.");
      return;
    }
    const available = getAvailableStock(product);
    if (available <= 0) {
      toast.error("Produto indisponível ou totalmente reservado.");
      return;
    }
    setSelectedProduct({ ...product, available });
    setQtyInput("");
    setIsQtyDialogOpen(true);
  };

  const confirmAddItem = () => {
    const qtd = parseInt(qtyInput, 10);
    if (!qtd || qtd <= 0) return toast.error("Quantidade inválida");
    
    if (qtd > selectedProduct.available) {
        return toast.error(`Estoque insuficiente. Disponível: ${Math.floor(selectedProduct.available)}`);
    }

    setCart([...cart, {
      product_id: selectedProduct.id,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      unit: selectedProduct.unit,
      quantity: qtd
    }]);
    setIsQtyDialogOpen(false);
    toast.success("Adicionado!");
  };

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter(item => item.product_id !== id));
  };

  const handleSubmit = () => {
    if (!sector) return toast.error("Erro: Setor não identificado.");
    if (cart.length === 0) return toast.error("Carrinho vazio.");
    
    // Bloqueio Final
    if (!cartValidation.isValid) {
        toast.error("Atenção: O estoque mudou!", {
            description: "Alguns itens no seu carrinho não estão mais disponíveis na quantidade solicitada. Ajuste o pedido."
        });
        return;
    }

    createRequestMutation.mutate({
      sector,
      items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
    });
  };

  // --- Handlers Edição ---
  const handleEditClick = (request: any) => {
    setAddItemSearch("");
    const editableItems = request.request_items.map((ri: any) => ({
      product_id: ri.product_id,
      name: ri.products?.name || ri.custom_product_name,
      sku: ri.products?.sku || "-",
      unit: ri.products?.unit || "UN",
      quantity: Math.floor(ri.quantity_requested),
      initialQuantity: Math.floor(ri.quantity_requested) 
    }));

    setEditingRequest({
      id: request.id,
      items: editableItems
    });
  };

  const handleUpdateEditQty = (productId: string, newQty: string) => {
    const qtd = parseInt(newQty, 10);
    const product = products?.find((p: any) => p.id === productId);
    
    setEditingRequest((prev: any) => {
      const newItems = prev.items.map((item: any) => {
        if (item.product_id === productId) {
           const availableStock = getAvailableStock(product); 
           const myHolding = item.initialQuantity || 0; 
           const maxLimit = availableStock + myHolding;

           if (!isNaN(qtd) && qtd > maxLimit) {
               toast.error(`Limite excedido. Máximo disponível: ${maxLimit}`);
               return item; 
           }

           return { ...item, quantity: isNaN(qtd) ? "" : qtd };
        }
        return item;
      });

      return { ...prev, items: newItems };
    });
  };

  const handleRemoveEditItem = (productId: string) => {
    setEditingRequest((prev: any) => {
      if (!prev || !prev.items) return prev;
      const newItems = prev.items.filter((item: any) => String(item.product_id) !== String(productId));
      return { ...prev, items: newItems };
    });
  };

  const handleAddToEdit = (product: any) => {
    const available = getAvailableStock(product);
    if (available <= 0) {
        toast.error("Produto sem estoque disponível.");
        return;
    }

    setEditingRequest((prev: any) => ({
        ...prev,
        items: [
            {
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                unit: product.unit,
                quantity: 1,
                initialQuantity: 0 
            },
            ...prev.items, 
        ]
    }));
    setAddItemSearch(""); 
  };

  const handleSaveEdit = () => {
    if (!editingRequest || editingRequest.items.length === 0) {
      toast.error("O pedido não pode ficar vazio.");
      return;
    }

    const hasInvalidQty = editingRequest.items.some((i: any) => !i.quantity || i.quantity <= 0);
    if (hasInvalidQty) {
        toast.error("Verifique as quantidades.");
        return;
    }

    // Validação final de estoque na edição
    const invalidItems = editingRequest.items.filter((item: any) => {
        const product = products.find((p: any) => p.id === item.product_id);
        const available = getAvailableStock(product);
        const myHolding = item.initialQuantity || 0;
        return item.quantity > (available + myHolding);
    });

    if (invalidItems.length > 0) {
        toast.error("Estoque mudou! Atualize as quantidades.");
        return;
    }

    updateRequestMutation.mutate({
      id: editingRequest.id,
      items: editingRequest.items.map((item: any) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity)
      }))
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-in fade-in duration-500">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel do Setor</h1>
          <p className="text-muted-foreground">Solicite materiais do estoque central</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-lg border">
          <Button 
            variant={activeTab === "new" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab("new")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Nova Solicitação
          </Button>
          <Button 
            variant={activeTab === "history" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setActiveTab("history")}
            className="gap-2"
          >
            <History className="h-4 w-4" /> Meus Pedidos
          </Button>
        </div>
      </div>

      {/* --- ABA: NOVA SOLICITAÇÃO --- */}
      {activeTab === "new" && (
        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 overflow-hidden pb-2">
          {/* ESQUERDA: CATÁLOGO */}
          <Card className="flex flex-col flex-[2] h-full border-muted-foreground/20 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-muted/10 shrink-0 border-b space-y-4">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="h-5 w-5 text-primary" /> Catálogo de Produtos
                </CardTitle>
                <Badge variant="outline" className="bg-background">{filteredProducts.length} itens</Badge>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Digite o nome, SKU ou descrição..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 bg-background text-base"
                />
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1 bg-muted/5">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3">
                {isLoadingProducts ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Box className="h-8 w-8 animate-bounce mb-2" /> Carregando catálogo...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    Nenhum produto encontrado.
                  </div>
                ) : (
                  filteredProducts.map((product: any) => {
                    const available = getAvailableStock(product);
                    const inCart = cart.some(i => i.product_id === product.id);
                    
                    return (
                      <div 
                        key={product.id} 
                        className={`
                          relative flex flex-col p-4 rounded-lg border shadow-sm transition-all bg-card
                          ${available <= 0 ? 'opacity-60 grayscale cursor-not-allowed border-dashed' : 'hover:border-primary hover:shadow-md cursor-pointer'}
                          ${inCart ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}
                        `}
                        onClick={() => available > 0 && handleProductSelect(product)}
                      >
                        {inCart && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                            NO CARRINHO
                          </div>
                        )}

                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h3 className="font-semibold text-sm leading-snug text-foreground break-words line-clamp-2" title={product.name}>
                            {product.name}
                          </h3>
                          {available > 0 ? (
                            <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200">
                              {Math.floor(available)} {product.unit}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="shrink-0">Esgotado</Badge>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-dashed">
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{product.sku}</span>
                          </div>
                          <span className="flex items-center gap-1 text-primary font-medium group-hover:underline">
                            Selecionar <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* DIREITA: CARRINHO */}
          <Card className="flex flex-col flex-1 h-full border-l-4 border-l-primary shadow-lg bg-card overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-primary">
                <ShoppingCart className="h-5 w-5" /> Revisão do Pedido
              </CardTitle>
              <CardDescription>
                Setor: <span className="font-semibold text-foreground">{sector}</span>
              </CardDescription>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-0">
              <div className="flex flex-col divide-y divide-border">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3 px-4 text-center">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                      <ShoppingCart className="h-8 w-8 opacity-50" />
                    </div>
                    <p>Seu carrinho está vazio.</p>
                    <p className="text-sm opacity-70">Clique nos produtos à esquerda para adicionar.</p>
                  </div>
                ) : (
                  cart.map((item) => {
                    // BLINDAGEM VISUAL: Verifica cada item individualmente
                    const product = products?.find((p: any) => p.id === item.product_id);
                    const currentAvailable = getAvailableStock(product);
                    const isExceeding = item.quantity > currentAvailable;

                    return (
                        <div key={item.product_id} className={`flex gap-3 p-4 transition-colors group ${isExceeding ? 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500' : 'hover:bg-muted/10'}`}>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground break-words leading-snug">
                            {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono mt-1">{item.sku}</p>
                            {isExceeding && (
                                <div className="flex items-center gap-1 text-xs text-red-600 font-bold mt-1 animate-pulse">
                                    <ShieldAlert className="h-3 w-3" />
                                    Indisponível! Restam apenas {Math.floor(currentAvailable)}
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md">
                            <span className="font-bold text-sm">{item.quantity}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{item.unit}</span>
                            </div>
                            <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-50 -mr-1" 
                            onClick={() => handleRemoveItem(item.product_id)}
                            >
                            <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                        </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="p-4 bg-muted/20 border-t mt-auto">
              <div className="flex justify-between items-center mb-4 text-sm">
                <span className="text-muted-foreground">Total de Itens:</span>
                <span className="font-bold text-lg">{cart.length}</span>
              </div>
              
              {/* ALERTA DE BLOQUEIO */}
              {!cartValidation.isValid && (
                  <div className="mb-3 p-2 rounded bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center justify-center gap-2 text-center">
                      <ShieldAlert className="h-4 w-4" />
                      O estoque mudou! Remova os itens excedentes.
                  </div>
              )}

              <Button 
                className="w-full h-12 text-base font-bold shadow-md transition-all hover:scale-[1.02]" 
                onClick={handleSubmit} 
                // BLINDAGEM DO BOTÃO: Se a validação falhar, desabilita
                disabled={cart.length === 0 || createRequestMutation.isPending || !cartValidation.isValid}
              >
                {createRequestMutation.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="mr-2 h-5 w-5" /> Confirmar Pedido</>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ... (RESTO DO CÓDIGO: HISTÓRICO, DIALOGS DE EDIÇÃO E QUANTIDADE MANTIDOS IGUAIS) ... */}
      {/* Mantenha o restante do código das abas de histórico e dialogs exatamente como estava na versão anterior otimizada */}
      
      {activeTab === "history" && (
        <Card className="flex-1 overflow-hidden border-muted-foreground/20 flex flex-col min-h-0 shadow-sm">
          <CardHeader className="shrink-0 pb-2 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico de Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px] text-center">Data / Ref</TableHead>
                  <TableHead>Resumo</TableHead>
                  <TableHead className="w-[120px] text-center">Status</TableHead>
                  <TableHead className="w-[80px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRequests ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-32">Carregando...</TableCell></TableRow>
                ) : requests?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-32 text-muted-foreground">Nenhum pedido realizado.</TableCell></TableRow>
                ) : (
                  requests?.map((request: any) => {
                    const status = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.aberto;
                    const StatusIcon = status.icon;
                    const isEditable = request.status === 'aberto';

                    return (
                      <TableRow key={request.id} className="hover:bg-muted/5">
                        <TableCell className="align-top py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-xs text-foreground">
                              {format(new Date(request.created_at), "dd/MM")}
                            </span>
                            <span className="text-[10px] text-muted-foreground mb-1">
                              {format(new Date(request.created_at), "HH:mm")}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground uppercase bg-muted/50 px-1 rounded">
                              #{request.id.substring(0, 6)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="align-top py-4">
                          <div className="space-y-1">
                            {request.request_items?.map((item: any) => (
                              <div key={item.id} className="flex items-start gap-2 text-sm">
                                <Badge variant="secondary" className="h-5 px-1.5 font-mono text-[10px] shrink-0">
                                  {Math.floor(item.quantity_requested)} {item.products?.unit}
                                </Badge>
                                <span className="text-foreground leading-tight">{item.products?.name || item.custom_product_name}</span>
                              </div>
                            ))}
                            {request.rejection_reason && (
                              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-100 rounded text-xs text-red-800 dark:text-red-300 flex gap-2">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>Recusa: {request.rejection_reason}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top py-4 text-center">
                          <Badge variant="outline" className={`${status.color} px-3 py-1 gap-1.5 text-xs font-medium`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top py-4 text-center">
                          {isEditable && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEditClick(request)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialogs de Quantidade e Edição (Mantidos do código anterior otimizado) */}
      <Dialog open={isQtyDialogOpen} onOpenChange={setIsQtyDialogOpen}>
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader><DialogTitle>Quantas unidades?</DialogTitle></DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/30 p-3 rounded-lg border">
                <p className="font-semibold text-sm leading-tight mb-1">{selectedProduct.name}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>SKU: {selectedProduct.sku}</span>
                  <span>Disp: <strong className="text-foreground">{Math.floor(selectedProduct.available)}</strong></span>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Input type="number" step="1" placeholder="0" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} className="text-xl h-14 font-bold text-center bg-background" autoFocus onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()} />
                <div className="h-14 w-16 bg-muted flex items-center justify-center rounded-md font-medium text-muted-foreground border">{selectedProduct.unit}</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsQtyDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmAddItem} className="w-full sm:w-auto">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRequest} onOpenChange={(open) => !open && setEditingRequest(null)}>
        <DialogContent className="w-screen h-screen max-w-none m-0 rounded-none border-none flex flex-col bg-background p-0">
          <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/10">
            <div>
                <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Pencil className="h-6 w-6" /></div>
                    Editar Pedido #{editingRequest?.id?.substring(0, 6)}
                </DialogTitle>
                <DialogDescription>Gerencie os itens. Estoque validado em tempo real.</DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingRequest(null)} className="h-10 w-10 rounded-full hover:bg-muted/50"><X className="h-6 w-6" /></Button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-muted/5">
             <div className="flex-1 flex flex-col border-r p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Itens no Pedido</h3>
                    <Badge variant="outline" className="bg-background">{editingRequest?.items?.length || 0} itens</Badge>
                </div>
                <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-4">
                        {editingRequest?.items?.map((item: any) => {
                            const product = products?.find((p: any) => p.id === item.product_id);
                            const available = getAvailableStock(product);
                            const myHolding = item.initialQuantity || 0;
                            const maxAllowed = available + myHolding;
                            const currentQty = Number(item.quantity) || 0;
                            const isAtLimit = currentQty >= maxAllowed;
                            return (
                                <div key={item.product_id} className="group flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl border shadow-sm hover:shadow-md transition-all">
                                    <div className="h-14 w-14 bg-muted/30 rounded-lg flex items-center justify-center shrink-0 border"><Package className="h-7 w-7 text-muted-foreground/50" /></div>
                                    <div className="flex-1 w-full text-center sm:text-left min-w-0">
                                        <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                                            <p className="font-bold text-base text-foreground line-clamp-1">{item.name}</p>
                                            <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5 shrink-0">{item.sku}</Badge>
                                        </div>
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <div className="flex items-center justify-center sm:justify-start gap-2 text-xs">
                                                <span className={`flex items-center gap-1 ${isAtLimit ? 'text-amber-600 font-medium' : 'text-emerald-600'}`}>{isAtLimit ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />} Estoque: {Math.floor(available)} disp.</span>
                                                <span className="text-muted-foreground">|</span>
                                                <span className="text-muted-foreground">Seu pedido atual: <strong>{currentQty} {item.unit}</strong></span>
                                            </div>
                                            <div className="w-full max-w-[200px] mx-auto sm:mx-0"><Progress value={Math.min(100, (currentQty / maxAllowed) * 100)} className="h-1.5" /></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 bg-muted/20 p-2 rounded-lg border shrink-0">
                                        <div className="flex flex-col items-center">
                                            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">QTD</label>
                                            <div className="flex items-center bg-background rounded-md border shadow-sm h-10 w-28 overflow-hidden relative">
                                                <Input type="number" className="w-full h-full text-center font-bold text-lg border-none focus-visible:ring-0 px-2" value={item.quantity} onChange={(e) => handleUpdateEditQty(item.product_id, e.target.value)} min={1} />
                                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border-l">{item.unit}</div>
                                            </div>
                                        </div>
                                        <div className="h-8 w-px bg-border/50 mx-1"></div>
                                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" onClick={() => handleRemoveEditItem(item.product_id)} title="Remover item"><Trash2 className="h-5 w-5" /></Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
             </div>
             <div className="w-full lg:w-[420px] flex flex-col bg-background p-6 border-l shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.03)] z-10">
                <div className="mb-6"><h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Adicionar Produto</h3><p className="text-sm text-muted-foreground">Busque produtos no catálogo.</p></div>
                <div className="relative mb-4"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou SKU..." value={addItemSearch} onChange={(e) => setAddItemSearch(e.target.value)} className="pl-10 h-12 text-base shadow-sm border-muted-foreground/20" autoFocus /></div>
                <div className="flex-1 overflow-hidden rounded-xl border bg-muted/10 shadow-inner flex flex-col">
                    <ScrollArea className="flex-1 p-2">
                        {filteredAddProducts.length > 0 ? (
                            <div className="space-y-2">
                                {filteredAddProducts.map((p: any) => {
                                    const avail = getAvailableStock(p);
                                    return (
                                        <div key={p.id} className="group flex flex-col p-3 rounded-lg border bg-card hover:border-primary/50 hover:shadow-md cursor-pointer transition-all duration-200" onClick={() => handleAddToEdit(p)}>
                                            <div className="flex justify-between items-start gap-2"><p className="font-semibold text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors">{p.name}</p><Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px] shrink-0">+{Math.floor(avail)} un</Badge></div>
                                            <div className="flex justify-between items-end mt-3"><span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded border">{p.sku}</span><span className="text-xs font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-all">Adicionar <Plus className="h-3 w-3" /></span></div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm p-8 text-center opacity-60"><Search className="h-10 w-10 mb-2 opacity-20" /><p>Nada encontrado.</p></div>}
                    </ScrollArea>
                </div>
             </div>
          </div>
          <div className="p-4 border-t bg-background flex justify-end gap-3">
            <Button variant="outline" size="lg" onClick={() => setEditingRequest(null)}>Cancelar</Button>
            <Button size="lg" onClick={handleSaveEdit} disabled={updateRequestMutation.isPending || editingRequest?.items?.length === 0} className="px-8 font-bold shadow-lg shadow-primary/20">
            {updateRequestMutation.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...</> : <><Save className="mr-2 h-5 w-5" /> Salvar Alterações</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
