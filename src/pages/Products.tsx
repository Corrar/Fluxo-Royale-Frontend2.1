import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Plus, Trash2, Package, Search, Box, Pencil, X, DollarSign,
  AlertCircle, ShoppingBag, CheckCircle2, Filter, Tag,
  Eraser, ArrowUpDown, SlidersHorizontal, ChevronDown, 
  AlertTriangle, PackageCheck, Minus, ListFilter,
  ZoomIn, ZoomOut, Type
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// --- 🎨 ESTILO PREMIUM PARA TAGS ---
const getTagStyle = (tag: string) => {
  const styles = [
    "bg-red-950/40 text-red-300 border-red-900/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    "bg-emerald-950/40 text-emerald-300 border-emerald-900/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    "bg-blue-950/40 text-blue-300 border-blue-900/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    "bg-amber-950/40 text-amber-300 border-amber-900/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
    "bg-purple-950/40 text-purple-300 border-purple-900/50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return styles[Math.abs(hash) % styles.length];
};

export default function Products() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Estados de Controle e Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceFilter, setPriceFilter] = useState<"all" | "with_price" | "no_price">("all");
  const [sortOrder, setSortOrder] = useState<"name_asc" | "price_high" | "price_low">("name_asc");
  const [zoomLevel, setZoomLevel] = useState(1); // Estado para Acessibilidade (Zoom)
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Estados de Modais
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false); // Controle manual do Sheet de Filtros
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [priceDialog, setPriceDialog] = useState(false);
  const [selectedProductForPrice, setSelectedProductForPrice] = useState<any>(null);
  const [priceValue, setPriceValue] = useState("");

  // Modo Compra
  const [isPurchaseMode, setIsPurchaseMode] = useState(false);
  const [purchaseCart, setPurchaseCart] = useState<{ product: any; quantity: number }[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState({ date: "", note: "" });

  // Form State
  const [useAutoSku, setUseAutoSku] = useState(true);
  const [formData, setFormData] = useState({
    sku: "", name: "", description: "", unit: "UN", min_stock: "0", quantity: "0", unit_price: "0", tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");

  // Permissões
  const canManage = ["admin", "almoxarife"].includes(profile?.role || "");
  const canEditPrice = ["admin", "compras"].includes(profile?.role || "");

  // --- QUERY DE PRODUTOS ---
  const { data: products = [], isLoading } = useQuery<any[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/products");
      return response.data.map((p: any) => {
        let normalizedTags: string[] = [];
        if (p.tags) {
            if (Array.isArray(p.tags)) normalizedTags = p.tags;
            else if (typeof p.tags === 'string') {
               try { const parsed = JSON.parse(p.tags); if (Array.isArray(parsed)) normalizedTags = parsed; } catch { 
                  if (p.tags.trim() !== "" && p.tags !== "[]") normalizedTags = p.tags.replace(/[\[\]"]/g, '').split(',').map((t: string) => t.trim()).filter((t: string) => t !== "");
               }
            }
        }
        return { ...p, tags: normalizedTags };
      });
    },
  });

  const availableTags = useMemo(() => Array.from(new Set(products.flatMap((p: any) => p.tags))).sort(), [products]);

  // SKU Automático
  const nextSku = useMemo(() => {
    const MIN_START = 236;
    if (!products.length) return `9.99.${(MIN_START + 1).toString().padStart(4, "0")}`;
    const maxExisting = Math.max(0, ...products.map((p: any) => {
      if (p.sku && p.sku.startsWith("9.99.")) {
        const num = parseInt(p.sku.split(".")[2]);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    }));
    return `9.99.${(Math.max(MIN_START, maxExisting) + 1).toString().padStart(4, "0")}`;
  }, [products]);

  // --- MUTAÇÕES ---
  const handleMutationSuccess = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success(msg);
    setIsFormOpen(false);
    resetForm();
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => (await api.post("/products", data)).data,
    onSuccess: (data) => handleMutationSuccess(`Produto ${data.sku} cadastrado!`),
    onError: () => toast.error("Erro ao cadastrar produto."),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.put(`/products/${id}`, data)).data,
    onSuccess: () => handleMutationSuccess("Produto atualizado!"),
    onError: () => toast.error("Erro ao atualizar."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/products/${id}`),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        setDeleteDialog(false);
        toast.success("Produto excluído!");
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => await api.put(`/products/${id}`, { unit_price: price }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Preço atualizado!"); setPriceDialog(false); },
    onError: () => toast.error("Erro ao atualizar preço."),
  });

  const registerPurchaseMutation = useMutation({
    mutationFn: async (data: any) => {
        const items = data.items.filter((i:any) => i.quantity > 0);
        await Promise.all(items.map((i:any) => api.put(`/products/${i.product.id}/purchase-info`, {
            purchase_status: "comprado", purchase_note: `Qtd: ${i.quantity} | ${data.note}`
        })));
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        toast.success("Compra registrada!");
        setPurchaseDialogOpen(false);
        setIsPurchaseMode(false);
        setPurchaseCart([]);
    }
  });

  // --- HANDLERS ---
  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setUseAutoSku(false);
    setFormData({
      sku: product.sku, name: product.name, description: product.description || "", unit: product.unit,
      min_stock: (product.min_stock || 0).toString(), quantity: (product.stock?.quantity_on_hand || 0).toString(),
      unit_price: (product.unit_price || 0).toString(), tags: product.tags || [],
    });
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setFormData({ sku: "", name: "", description: "", unit: "UN", min_stock: "0", quantity: "0", unit_price: "0", tags: [] });
    setEditingProduct(null);
    setUseAutoSku(true);
    setTagInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Nome obrigatório");
    const payload = { 
        ...formData, 
        sku: useAutoSku ? nextSku : formData.sku,
        min_stock: Number(formData.min_stock),
        quantity: Number(formData.quantity),
        unit_price: Number(formData.unit_price)
    };
    if (editingProduct) updateMutation.mutate({ id: editingProduct.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleFinalizePurchase = () => {
    if (purchaseCart.length === 0) {
        toast.error("Carrinho vazio");
        return;
    }
    registerPurchaseMutation.mutate({ 
        items: purchaseCart, 
        date: purchaseDetails.date, 
        note: purchaseDetails.note 
    });
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setPurchaseCart(prev => prev.map(item => {
        if (item.product.id === productId) {
            const newQty = Math.max(0, item.quantity + delta);
            return { ...item, quantity: newQty };
        }
        return item;
    }));
  };

  // --- LÓGICA DE FILTRAGEM E ORDENAÇÃO ---
  const filteredProducts = useMemo(() => {
    let result = products.filter((p: any) => 
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (selectedTags.length === 0 || selectedTags.every(tag => p.tags.includes(tag)))
    );

    if (priceFilter === "with_price") result = result.filter((p: any) => Number(p.unit_price) > 0);
    if (priceFilter === "no_price") result = result.filter((p: any) => !p.unit_price || Number(p.unit_price) === 0);

    if (sortOrder === "price_high") result.sort((a: any, b: any) => Number(b.unit_price) - Number(a.unit_price));
    if (sortOrder === "price_low") result.sort((a: any, b: any) => Number(a.unit_price) - Number(b.unit_price));
    if (sortOrder === "name_asc") result.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return result;
  }, [products, searchTerm, selectedTags, priceFilter, sortOrder]);

  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const activeFiltersCount = selectedTags.length + (priceFilter !== 'all' ? 1 : 0);

  // Manipulador de Zoom
  const handleZoom = (direction: 'in' | 'out') => {
    setZoomLevel(prev => {
        const newZoom = direction === 'in' ? prev + 0.1 : prev - 0.1;
        return Math.min(Math.max(newZoom, 0.7), 1.3); // Limita entre 70% e 130%
    });
  };

  return (
    // Aplicando zoom ao container principal
    <div 
        className="space-y-6 pb-40 md:pb-24 animate-in fade-in duration-700 transition-transform origin-top-left"
        style={{ zoom: zoomLevel }} // 'zoom' funciona bem em Chrome/Edge. Para Firefox seria necessário scale(), mas zoom é melhor para layout.
    >
      
      {/* --- HEADER HERO PREMIUM --- */}
      <div className={cn(
        "relative overflow-hidden rounded-[2.5rem] p-8 transition-all duration-500 border border-white/5 shadow-2xl",
        isPurchaseMode 
            ? "bg-gradient-to-br from-purple-900/40 to-[#020617] shadow-purple-900/10" 
            : "bg-gradient-to-br from-blue-950/40 to-[#020617] shadow-blue-900/10"
      )}>
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3 drop-shadow-sm">
                <Package className={cn("h-10 w-10 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]", isPurchaseMode ? "text-purple-400" : "text-amber-400")} />
                {isPurchaseMode ? "Modo de Compra" : "Catálogo Royale"}
            </h1>
            <p className="text-slate-300 mt-2 text-lg font-medium max-w-xl leading-relaxed">
                {isPurchaseMode ? "Selecione itens para gerar ordem de compra." : "Visão centralizada de produtos, valores e estoque."}
            </p>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto shrink-0 items-center">
                
                {/* BOTÕES DE ACESSIBILIDADE (ZOOM) */}
                <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 mr-2">
                    <Button variant="ghost" size="icon" onClick={() => handleZoom('out')} className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"><ZoomOut className="h-4 w-4"/></Button>
                    <div className="flex items-center justify-center w-12 text-xs font-bold text-slate-300">{Math.round(zoomLevel * 100)}%</div>
                    <Button variant="ghost" size="icon" onClick={() => handleZoom('in')} className="h-9 w-9 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"><ZoomIn className="h-4 w-4"/></Button>
                </div>

                {canEditPrice && !isPurchaseMode && (
                    <Button onClick={() => { setIsPurchaseMode(true); setPurchaseCart([]); }} variant="outline" className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 hover:border-purple-500/50 w-full md:w-auto h-12 rounded-xl font-bold transition-all">
                    <ShoppingBag className="mr-2 h-5 w-5" /> Iniciar Compra
                    </Button>
                )}
                {isPurchaseMode && (
                    <Button onClick={() => setIsPurchaseMode(false)} variant="destructive" className="w-full md:w-auto h-12 rounded-xl font-bold shadow-lg shadow-red-900/20 transition-all">
                    <X className="mr-2 h-5 w-5" /> Cancelar
                    </Button>
                )}
                {canManage && !isPurchaseMode && (
                    <Button onClick={() => { resetForm(); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white font-bold w-full md:w-auto h-12 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95">
                    <Plus className="mr-2 h-5 w-5" /> Novo Item
                    </Button>
                )}
            </div>
        </div>
      </div>

      {/* --- BARRA DE FILTROS --- */}
      <div className="sticky top-4 z-30 mx-2 md:mx-4">
        <div className="bg-[#0f172a]/70 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] flex flex-col md:flex-row gap-3 transition-all hover:border-white/20">
            <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                <Input 
                placeholder="Buscar produto, SKU ou tag..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-12 bg-black/20 border-white/5 text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 h-12 rounded-xl transition-all placeholder:text-slate-500 text-base"
                />
            </div>
            
            <div className="flex gap-2 shrink-0">
                {/* --- FILTROS AVANÇADOS (SHEET REDESENHADA) --- */}
                <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" className={cn(
                        "h-12 rounded-xl border border-white/10 bg-white/5 text-slate-300 font-semibold transition-all hover:bg-white/10 active:scale-95 flex gap-2 items-center px-4",
                        activeFiltersCount > 0 && "bg-blue-900/20 border-blue-500/30 text-blue-300"
                        )}>
                        <ListFilter className="h-5 w-5" />
                        <span className="hidden sm:inline">Filtros</span>
                        {activeFiltersCount > 0 && (
                            <Badge className="bg-blue-500 hover:bg-blue-600 text-white h-6 min-w-[1.5rem] flex items-center justify-center px-1.5 rounded-full font-bold shadow-sm">
                            {activeFiltersCount}
                            </Badge>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-[#0f172a] border-l border-white/10 text-white w-full sm:w-[450px] p-0 shadow-2xl flex flex-col h-full">
                    {/* Header do Filtro com Botão Fechar X */}
                    <div className="p-6 border-b border-white/10 bg-[#020617]/50 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center">
                        <SheetHeader className="text-left"><SheetTitle className="text-2xl font-black text-white flex items-center gap-3"><SlidersHorizontal className="h-6 w-6 text-amber-400"/> Filtros</SheetTitle></SheetHeader>
                        <Button variant="ghost" size="icon" onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-white rounded-full"><X className="h-6 w-6" /></Button>
                    </div>
                    
                    <ScrollArea className="flex-1 p-6">
                        <div className="space-y-8 pb-20">
                            
                            {/* Filtro de Preço */}
                            <div className="space-y-3">
                                <Label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Situação de Preço</Label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { val: 'all', label: 'Todos', icon: Package },
                                        { val: 'with_price', label: 'Com Preço', icon: DollarSign },
                                        { val: 'no_price', label: 'Sem Preço', icon: AlertCircle }
                                    ].map((opt) => (
                                        <div 
                                            key={opt.val}
                                            onClick={() => setPriceFilter(opt.val as any)}
                                            className={cn(
                                                "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                                                priceFilter === opt.val 
                                                    ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-inner" 
                                                    : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                                            )}
                                        >
                                            <opt.icon className={cn("h-5 w-5", priceFilter === opt.val ? "text-blue-400" : "text-slate-500")} />
                                            <span className="font-medium">{opt.label}</span>
                                            {priceFilter === opt.val && <CheckCircle2 className="ml-auto h-5 w-5 text-blue-500" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Filtro de Tags */}
                            <div className="space-y-3">
                                <Label className="text-sm font-bold text-slate-400 uppercase tracking-wider">Etiquetas</Label>
                                <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                    {availableTags.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {availableTags.map(tag => {
                                                const isSelected = selectedTags.includes(tag);
                                                return (
                                                    <Badge 
                                                        key={tag} 
                                                        variant="outline"
                                                        className={cn(
                                                            "cursor-pointer h-9 px-3 text-sm rounded-lg transition-all border active:scale-95 select-none flex items-center gap-1",
                                                            isSelected ? 'bg-amber-500 border-amber-500 text-black font-bold shadow-lg shadow-amber-500/20' : 'border-white/10 text-slate-400 hover:bg-white/10'
                                                        )}
                                                        onClick={() => {
                                                            setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                                                            setCurrentPage(1);
                                                        }}
                                                    >
                                                        {tag}
                                                        {isSelected && <X className="h-3 w-3 ml-1" />}
                                                    </Badge>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic text-center py-4">Nenhuma tag cadastrada.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="p-6 border-t border-white/10 bg-[#020617]/90 backdrop-blur-md flex flex-col gap-3">
                        <Button onClick={() => setIsFilterOpen(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 rounded-xl font-bold shadow-lg shadow-blue-900/20">
                            Ver Resultados
                        </Button>
                        <Button variant="ghost" onClick={() => { setSelectedTags([]); setPriceFilter("all"); }} className="w-full text-red-400 hover:bg-red-950/30 hover:text-red-300 h-12 rounded-xl font-semibold border border-red-900/30">
                            <Eraser className="mr-2 h-4 w-4" /> Limpar Filtros
                        </Button>
                    </div>
                </SheetContent>
                </Sheet>

                {/* Ordenação */}
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-12 rounded-xl border border-white/10 bg-white/5 text-slate-300 font-semibold transition-all hover:bg-white/10 active:scale-95 flex gap-2 items-center px-4">
                        <ArrowUpDown className="h-5 w-5" />
                        <span className="hidden sm:inline">Ordenar</span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#0f172a] border-white/10 text-white w-56 p-2 rounded-xl shadow-2xl">
                    <DropdownMenuLabel className="text-slate-500 text-xs uppercase tracking-wider font-bold px-2 py-1.5">Ordem</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSortOrder("name_asc")} className={cn("rounded-lg focus:bg-blue-900/20 cursor-pointer py-2.5 font-medium", sortOrder === 'name_asc' && "text-amber-400 bg-amber-950/20")}>A-Z Nome</DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5 my-1" />
                    <DropdownMenuItem onClick={() => setSortOrder("price_high")} className={cn("rounded-lg focus:bg-blue-900/20 cursor-pointer py-2.5 font-medium", sortOrder === 'price_high' && "text-amber-400 bg-amber-950/20")}>Maior Preço</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder("price_low")} className={cn("rounded-lg focus:bg-blue-900/20 cursor-pointer py-2.5 font-medium", sortOrder === 'price_low' && "text-amber-400 bg-amber-950/20")}>Menor Preço</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      </div>

      {/* --- GRID DE PRODUTOS --- */}
      {isLoading ? (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {Array.from({length:8}).map((_,i) => <div key={i} className="h-[280px] bg-white/5 rounded-[2rem] animate-pulse border border-white/5" />)}
         </div>
      ) : filteredProducts.length === 0 ? (
         <div className="flex flex-col items-center justify-center py-24 text-slate-500 border-2 border-dashed border-white/5 rounded-[3rem] mx-2 bg-white/1">
            <Box className="h-20 w-20 mb-6 opacity-20 text-blue-500" />
            <p className="text-xl font-medium text-slate-400">Nenhum produto encontrado.</p>
            <p className="text-sm mt-2">Tente ajustar seus filtros ou termo de busca.</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {paginatedProducts.map((product) => {
               const hasPrice = Number(product.unit_price) > 0;
               const inCart = purchaseCart.some(i => i.product.id === product.id);
               return (
                  <Card 
                     key={product.id}
                     onClick={() => isPurchaseMode && setPurchaseCart(prev => inCart ? prev.filter(i => i.product.id !== product.id) : [...prev, { product, quantity: 0 }])}
                     className={cn(
                        "bg-gradient-to-br from-[#0f172a] to-[#020617] border-white/5 shadow-xl transition-all duration-500 group relative overflow-hidden rounded-[2rem]",
                        "hover:shadow-2xl hover:shadow-blue-900/30 hover:border-blue-500/30 hover:-translate-y-1",
                        isPurchaseMode ? "cursor-pointer" : "",
                        inCart ? "ring-2 ring-purple-500 bg-gradient-to-br from-purple-950/30 to-[#020617]" : ""
                     )}
                  >
                     {isPurchaseMode && (
                        <div className={cn("absolute top-4 right-4 z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-sm", inCart ? "bg-purple-600 border-purple-600 scale-110" : "border-slate-600 bg-black/30")}>
                           {inCart && <CheckCircle2 className="w-5 h-5 text-white" />}
                        </div>
                     )}

                     <CardContent className="p-6 flex flex-col h-full relative z-10">
                        <div className="flex justify-between items-start mb-4">
                           <Badge variant="outline" className="border-white/10 bg-black/30 text-slate-300 font-mono text-[11px] tracking-widest px-3 py-1 rounded-lg backdrop-blur-sm">{product.sku}</Badge>
                           {canManage && !isPurchaseMode && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-blue-500/20 rounded-full" onClick={(e) => { e.stopPropagation(); handleEdit(product); }}><Pencil className="h-4 w-4" /></Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-full" onClick={(e) => { e.stopPropagation(); setProductToDelete(product.id); setDeleteDialog(true); }}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                           )}
                        </div>

                        <div className="flex-1 mb-6">
                           <h3 className="font-bold text-xl text-white leading-snug mb-3 line-clamp-2 tracking-tight" title={product.name}>{product.name}</h3>
                           <div className="flex flex-wrap gap-1.5">
                              {product.tags?.slice(0, 3).map((tag: string) => (
                                 <span key={tag} className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium backdrop-blur-md", getTagStyle(tag))}>{tag}</span>
                              ))}
                              {product.tags?.length > 3 && (
                                  <span className="text-[10px] px-2.5 py-1 rounded-full border border-white/5 bg-white/5 text-slate-400 font-medium">+{product.tags.length - 3}</span>
                              )}
                           </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-end justify-between bg-black/10 -mx-6 -mb-6 p-6 backdrop-blur-sm">
                           <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Box className="h-3 w-3"/> Estoque</p>
                              <div className="flex items-baseline gap-1.5 text-slate-200">
                                 <span className="font-mono font-black text-2xl tracking-tight">{product.stock?.quantity_on_hand || 0}</span>
                                 <span className="text-xs font-bold text-slate-500">{product.unit}</span>
                              </div>
                           </div>
                           {canEditPrice && !isPurchaseMode && (
                              <div className="text-right cursor-pointer group/price" onClick={(e) => { e.stopPropagation(); setSelectedProductForPrice(product); setPriceValue(product.unit_price?.toString() || ""); setPriceDialog(true); }}>
                                 <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-end gap-1">
                                    Valor Unit. <Pencil className="h-3 w-3 opacity-0 group-hover/price:opacity-100 transition-opacity text-blue-400"/>
                                </p>
                                 <div className={cn("font-black text-xl tracking-tight flex items-center justify-end gap-1 drop-shadow-sm", hasPrice ? "text-emerald-400" : "text-slate-500")}>
                                    {!hasPrice && <AlertCircle className="w-4 h-4" />}
                                    {hasPrice ? Number(product.unit_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "R$ 0,00"}
                                 </div>
                              </div>
                           )}
                        </div>
                     </CardContent>
                  </Card>
               );
            })}
         </div>
      )}

      {/* PAGINAÇÃO ESTILIZADA */}
      {filteredProducts.length > 0 && (
        <div className="flex justify-center pt-8">
             <Pagination className="bg-[#0f172a]/50 backdrop-blur-xl p-2 rounded-full border border-white/10 shadow-xl inline-flex w-auto">
                <PaginationContent>
                <PaginationItem>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-full h-10 w-10 border border-white/5 hover:bg-white/10 text-white disabled:opacity-30">
                        <ChevronDown className="h-5 w-5 rotate-90" />
                    </Button>
                </PaginationItem>
                <PaginationItem className="mx-4">
                    <span className="text-sm font-bold text-slate-300">Página <span className="text-amber-400">{currentPage}</span> de {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-full h-10 w-10 border border-white/5 hover:bg-white/10 text-white disabled:opacity-30">
                         <ChevronDown className="h-5 w-5 -rotate-90" />
                    </Button>
                </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
      )}

      {/* --- MODAL DE CADASTRO/EDIÇÃO --- */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
         <SheetContent className="w-full sm:max-w-lg bg-[#0f172a] border-l border-white/10 text-white overflow-y-auto p-0 shadow-[ -20px_0_40px_0_rgba(0,0,0,0.5)]">
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-950/30 to-transparent sticky top-0 z-20 backdrop-blur-md">
                <SheetHeader>
                <SheetTitle className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                    <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg border border-white/10", editingProduct ? "bg-amber-900/30 text-amber-400" : "bg-blue-900/30 text-blue-400")}>
                        {editingProduct ? <Pencil className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                    </div>
                    {editingProduct ? "Editar Produto" : "Novo Cadastro"}
                </SheetTitle>
                </SheetHeader>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
               <div className="space-y-3">
                  <Label className="text-base font-bold text-slate-300">Nome do Item</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-black/20 border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20 text-white h-14 text-lg font-medium rounded-xl px-4" placeholder="Ex: Parafuso Sextavado..." autoFocus />
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <Label className="text-base font-bold text-slate-300">Unidade</Label>
                     <Select value={formData.unit} onValueChange={v => setFormData({...formData, unit: v})}>
                        <SelectTrigger className="bg-black/20 border-white/10 text-white h-12 rounded-xl font-medium px-4"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                           {["UN", "KG", "M", "CX", "PCT", "JG", "L"].map(u => <SelectItem key={u} value={u} className="rounded-lg cursor-pointer focus:bg-white/10 font-medium">{u}</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div className="space-y-3">
                     <Label className="text-base font-bold text-slate-300 flex justify-between">SKU <span className="text-xs font-normal text-slate-500 uppercase tracking-wider">{useAutoSku ? "Automático" : "Manual"}</span></Label>
                     <div className={cn("flex items-center gap-2 border rounded-xl px-3 h-12 transition-all", useAutoSku ? "bg-black/30 border-white/5" : "bg-black/20 border-white/10 focus-within:border-blue-500/50")}>
                        {useAutoSku ? (
                             <span className="text-slate-400 font-mono flex-1 pl-2 tracking-wider">{nextSku}</span>
                        ) : (
                             <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="bg-transparent border-none text-white p-0 h-full font-mono focus-visible:ring-0 pl-2 tracking-wider flex-1" />
                        )}
                        <Switch checked={useAutoSku} onCheckedChange={setUseAutoSku} className="scale-90 data-[state=checked]:bg-blue-500" />
                     </div>
                  </div>
               </div>

               {/* SEPARAÇÃO VISUAL CLARA PARA ESTOQUES */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card Estoque Mínimo (Alerta) */}
                    <div className="bg-amber-950/10 border border-amber-500/20 p-4 rounded-2xl flex flex-col gap-3">
                        <Label className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" /> Estoque Mínimo
                        </Label>
                        <Input 
                            type="number" 
                            value={formData.min_stock} 
                            onChange={e => setFormData({...formData, min_stock: e.target.value})} 
                            className="bg-black/20 border-amber-500/10 text-white h-12 rounded-xl font-bold text-center text-lg focus:border-amber-500/50 focus:ring-amber-500/20" 
                        />
                        <p className="text-[10px] text-amber-500/60 leading-tight">Define o ponto de reposição do item.</p>
                    </div>

                    {/* Card Estoque Físico (Atual) */}
                    <div className="bg-blue-950/10 border border-blue-500/20 p-4 rounded-2xl flex flex-col gap-3">
                        <Label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                            <PackageCheck className="h-3.5 w-3.5" /> Quantidade Física
                        </Label>
                        <Input 
                            type="number" 
                            value={formData.quantity} 
                            onChange={e => setFormData({...formData, quantity: e.target.value})} 
                            className="bg-black/20 border-blue-500/10 text-white h-12 rounded-xl font-bold text-center text-lg focus:border-blue-500/50 focus:ring-blue-500/20" 
                        />
                        <p className="text-[10px] text-blue-400/60 leading-tight">Total real no almoxarifado agora.</p>
                    </div>
               </div>

               {canEditPrice && (
                  <div className="space-y-3 pt-2">
                     <Label className="text-base font-bold text-emerald-400 flex items-center gap-2"><DollarSign className="w-5 h-5"/> Valor Unitário (Custo)</Label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xl">R$</span>
                        <Input type="number" step="0.01" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: e.target.value})} className="pl-12 bg-emerald-950/20 border-emerald-500/30 focus:border-emerald-400 text-emerald-400 h-16 text-2xl font-black rounded-2xl shadow-inner shadow-emerald-900/20" placeholder="0,00" />
                     </div>
                  </div>
               )}

               <div className="space-y-4 pt-4 border-t border-white/5">
                  <Label className="text-base font-bold text-slate-300 flex items-center gap-2"><Tag className="h-5 w-5"/> Etiquetas (Tags)</Label>
                  <div className="flex gap-2">
                     <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), setTagInput(""), !formData.tags.includes(tagInput) && setFormData({...formData, tags: [...formData.tags, tagInput]}))} className="bg-black/20 border-white/10 text-white h-12 rounded-xl px-4 flex-1" placeholder="Digite e pressione Enter..." />
                     <Button type="button" onClick={() => { if(tagInput && !formData.tags.includes(tagInput)) { setFormData({...formData, tags: [...formData.tags, tagInput]}); setTagInput(""); }}} variant="secondary" className="h-12 w-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/5"><Plus className="w-6 h-6" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-black/10 rounded-xl">
                     {formData.tags.length > 0 ? formData.tags.map(t => (
                        <Badge key={t} variant="outline" className={cn("border-white/10 pl-3 pr-1 py-1.5 text-sm font-medium rounded-lg flex items-center gap-2 transition-all hover:border-red-500/50 group", getTagStyle(t))}>
                            {t} 
                            <X className="w-4 h-4 text-slate-400 group-hover:text-red-400 cursor-pointer rounded-full hover:bg-black/20 p-0.5 transition-colors" onClick={() => setFormData({...formData, tags: formData.tags.filter(x => x !== t)})} />
                        </Badge>
                     )) : <span className="text-sm text-slate-600 italic p-2">Nenhuma tag adicionada.</span>}
                  </div>
               </div>

               <div className="pt-8 flex gap-4 sticky bottom-0 bg-[#0f172a]/90 backdrop-blur-md p-6 -mx-6 border-t border-white/10">
                  <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)} className="flex-1 text-slate-400 hover:text-white hover:bg-white/5 h-14 rounded-2xl font-semibold">Cancelar</Button>
                  <Button type="submit" className={cn("flex-[2] text-white font-bold h-14 rounded-2xl shadow-xl transition-all active:scale-95 text-lg", editingProduct ? "bg-amber-500 hover:bg-amber-600 shadow-amber-900/30" : "bg-blue-600 hover:bg-blue-500 shadow-blue-900/30")}>
                     {createMutation.isPending || updateMutation.isPending ? "Salvando..." : (editingProduct ? "Salvar Alterações" : "Cadastrar Produto")}
                  </Button>
               </div>
            </form>
         </SheetContent>
      </Sheet>

      {/* --- BARRA FLUTUANTE DE COMPRA (ESCONDIDA SE DIALOG ABERTO) --- */}
      {isPurchaseMode && purchaseCart.length > 0 && !purchaseDialogOpen && (
         <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto min-w-[320px] bg-[#09090b]/90 backdrop-blur-xl border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,1)] rounded-full p-3 flex items-center justify-between gap-4 z-[40] animate-in slide-in-from-bottom-24 duration-500">
            <div className="flex items-center gap-3 pl-2">
               <div className="bg-purple-600 w-12 h-12 rounded-full flex items-center justify-center font-black text-lg text-white shadow-lg shadow-purple-900/50 border-2 border-purple-400/20">{purchaseCart.length}</div>
               <div><span className="block font-bold text-white text-lg">Itens</span><span className="text-purple-300 text-sm font-medium">Selecionados</span></div>
            </div>
            <Button onClick={() => setPurchaseDialogOpen(true)} className="bg-white text-black hover:bg-slate-200 font-black rounded-full px-8 h-12 text-base shadow-xl transition-transform active:scale-95">
                Finalizar <ArrowUpDown className="ml-2 w-5 h-5 rotate-90" />
            </Button>
         </div>
      )}

      {/* --- DIALOG DE PREÇO --- */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
         <DialogContent className="bg-[#0f172a] border-white/10 text-white sm:max-w-md rounded-[2rem] shadow-2xl shadow-black/50 p-8">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-900/30 text-emerald-400 flex items-center justify-center border border-emerald-500/20"><DollarSign className="h-6 w-6"/></div>
                    Atualizar Preço
                </DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-6">
               <div className="bg-blue-950/30 p-4 rounded-2xl border border-blue-500/20 text-blue-200 flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-lg">{selectedProductForPrice?.name}</p>
                    <p className="text-sm text-blue-300/80">Alterar o valor unitário base deste produto.</p>
                  </div>
               </div>
               <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500 font-black text-3xl">R$</span>
                   <Input type="number" step="0.01" value={priceValue} onChange={e => setPriceValue(e.target.value)} className="bg-black/30 border-white/10 focus:border-emerald-500/50 text-white h-20 pl-20 text-4xl font-black rounded-3xl shadow-inner" autoFocus />
               </div>
            </div>
            <DialogFooter>
               <Button onClick={() => setPriceDialog(false)} variant="ghost" className="text-slate-400 hover:text-white h-12 rounded-xl font-semibold">Cancelar</Button>
               <Button onClick={() => updatePriceMutation.mutate({ id: selectedProductForPrice.id, price: Number(priceValue) })} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-xl shadow-lg shadow-emerald-900/30 px-8">Confirmar Novo Preço</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* --- DIALOG FINALIZAR COMPRA (DESIGN PREMIUM iFood/Nubank) --- */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
         <DialogContent className="bg-[#0f172a] border-white/10 text-white max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-white/5 bg-gradient-to-br from-purple-900/20 to-transparent">
                <DialogHeader>
                    <DialogTitle className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <ShoppingBag className="h-8 w-8 text-purple-400" />
                        Checkout
                    </DialogTitle>
                    <DialogDescription className="text-purple-200/60 font-medium">
                        Revise os itens e quantidades antes de confirmar.
                    </DialogDescription>
                </DialogHeader>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="space-y-4">
                    {purchaseCart.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all">
                            <div className="h-12 w-12 rounded-xl bg-black/40 flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white text-sm truncate">{item.product.name}</h4>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{item.product.sku}</p>
                            </div>
                            
                            {/* STEPPER DE QUANTIDADE (Estilo iFood) */}
                            <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5 shadow-inner">
                                <button 
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-red-400 hover:bg-white/10 transition-colors"
                                    onClick={() => updateCartQuantity(item.product.id, -1)}
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-10 text-center font-bold text-white text-base">{item.quantity}</span>
                                <button 
                                    className="w-9 h-9 flex items-center justify-center rounded-lg text-emerald-400 hover:bg-white/10 transition-colors"
                                    onClick={() => updateCartQuantity(item.product.id, 1)}
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 space-y-3">
                    <Label className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">Observações do Pedido</Label>
                    <Input 
                        value={purchaseDetails.note} 
                        onChange={e => setPurchaseDetails({...purchaseDetails, note: e.target.value})} 
                        className="bg-black/30 border-white/10 text-white h-14 rounded-2xl px-4 focus:ring-purple-500/30" 
                        placeholder="Ex: Urgente - Loja do Mecânico" 
                    />
                </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-black/20">
               <div className="flex justify-between items-center mb-4 px-2">
                  <span className="text-slate-400 font-medium">Total de Itens</span>
                  <span className="text-white font-bold text-xl">{purchaseCart.length}</span>
               </div>
               <Button onClick={handleFinalizePurchase} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold h-14 rounded-2xl shadow-lg shadow-purple-900/40 text-lg transition-all active:scale-95">
                   Confirmar Pedido
               </Button>
            </div>
         </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
         <AlertDialogContent className="bg-[#0f172a] border-white/10 text-white rounded-[2rem] p-8">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-black text-red-500 flex items-center gap-3">
                    <Trash2 className="h-8 w-8"/> Excluir Item?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400 text-base mt-2">
                    Esta ação é irreversível. O histórico e dados deste produto serão permanentemente removidos do sistema.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex gap-3">
                <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 h-12 rounded-xl font-semibold flex-1 m-0">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => productToDelete && deleteMutation.mutate(productToDelete)} className="bg-red-600 hover:bg-red-500 text-white h-12 rounded-xl font-bold shadow-lg shadow-red-900/30 flex-1 m-0">Sim, Excluir</AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
