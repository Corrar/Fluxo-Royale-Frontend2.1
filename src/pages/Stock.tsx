import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Settings2, Search, LogOut, ArrowDownToLine, Trash2, Package, ArrowRight, RotateCcw,
  TrendingDown, TrendingUp, DollarSign, Pencil, 
  Download, FileSpreadsheet, FileText, Warehouse, MapPin, Hammer, PlusCircle, AlertTriangle, Box
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

const SECTORS = ["ELETRICA", "FLOW", "ESTEIRA", "LAVADORA", "USINAGEM", "DESENVOLVIMENTO", "VIAGEM", "TERCEIROS", "ACUMULADOR", "REPOSIÇÃO"];

type ViewMode = "table" | "entry" | "exit";

interface CartItem {
  product_id: string; name: string; sku: string; unit: string; current_stock: number; quantity: number;
}

export default function Stock() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // --- PERMISSÕES ---
  const isAuxiliar = profile?.role === "auxiliar";
  const isAssistente = profile?.role === "assistente_tecnico";
  const isAdmin = profile?.role === "admin";
  const isCompras = profile?.role === "compras";
  const isAlmoxarife = profile?.role === "almoxarife";
  const isLiderSetor = ["chefe", "gerente", "setor"].includes(profile?.role || "");

  const canEditGeneralStock = isAlmoxarife || isAdmin;
  const canEditCost = isCompras || isAdmin || isAuxiliar;
  const canViewSalesPrice = isAuxiliar || isAssistente || isAdmin;
  const canEditSalesPrice = isAuxiliar || isAdmin;
  const canEditSectorStock = isAdmin || isAlmoxarife || isLiderSetor;

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [destination, setDestination] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [activeTab, setActiveTab] = useState("geral"); 
  const [selectedSectorView, setSelectedSectorView] = useState(profile?.sector || SECTORS[0]);

  // --- MODAIS STATES ---
  const [modalState, setModalState] = useState<{
    type: 'adjust' | 'consume' | 'add' | 'price' | 'cost' | null,
    item: any | null
  }>({ type: null, item: null });
  
  const [formValue, setFormValue] = useState("");
  const [secondaryFormValue, setSecondaryFormValue] = useState("");

  // 1. BUSCAR ESTOQUE
  const { data: stocks, isLoading } = useQuery({
    queryKey: ["stocks"],
    queryFn: async () => (await api.get("/stock")).data,
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    enabled: activeTab === "setor"
  });

  // --- MUTAÇÕES ---
  const mutationConfig = (successMsg: string) => ({
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ["stocks"] }); 
        toast.success(successMsg); 
        closeModal();
        resetTransaction();
    },
    onError: (e: any) => toast.error(`Erro: ${e.response?.data?.error || "Falha na operação"}`),
  });

  const manualEntryMutation = useMutation({ mutationFn: async (items: any[]) => await api.post("/manual-entry", { items }), ...mutationConfig("Entrada registrada!") });
  const manualExitMutation = useMutation({ mutationFn: async (data: any) => await api.post("/manual-withdrawal", data), ...mutationConfig("Saída registrada!") });
  const sectorEntryMutation = useMutation({ mutationFn: async (data: any) => await api.post("/manual-entry", data), ...mutationConfig("Item adicionado ao setor!") });
  const adjustMutation = useMutation({ mutationFn: async ({ id, quantity }: any) => await api.put(`/stock/${id}`, { quantity_on_hand: quantity }), ...mutationConfig("Estoque ajustado!") });
  const updatePriceMutation = useMutation({ mutationFn: async ({ id, price, type }: any) => await api.put(`/products/${id}`, { [type]: price }), ...mutationConfig("Preço atualizado!") });

  // --- HELPERS ---
  const closeModal = () => { setModalState({ type: null, item: null }); setFormValue(""); setSecondaryFormValue(""); };
  const resetTransaction = () => { setCart([]); setDestination(""); setSearchTerm(""); setViewMode("table"); };

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    let data = stocks;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter((stock: any) => 
            stock.products?.name?.toLowerCase().includes(term) || stock.products?.sku?.toLowerCase().includes(term)
        );
    }
    if (activeTab === "setor") {
        const targetSector = (isAlmoxarife || isAdmin) ? selectedSectorView : profile?.sector;
        return data.filter((stock: any) => stock.sector === targetSector);
    }
    return data.filter((stock: any) => !stock.sector || stock.sector === "ALMOXARIFADO");
  }, [stocks, searchTerm, activeTab, selectedSectorView, isAlmoxarife, isAdmin, profile]);

  const sectorDivisions = useMemo(() => {
    if (activeTab !== "setor") return { critical: [], normal: [] };
    const critical: any[] = [];
    const normal: any[] = [];
    filteredStocks.forEach((stock: any) => {
       const min = stock.products?.min_stock || 0;
       if (stock.quantity_on_hand <= min && min > 0) critical.push(stock);
       else normal.push(stock);
    });
    return { critical, normal };
  }, [filteredStocks, activeTab]);

  const paginatedStocks = useMemo(() => {
    if (viewMode !== "table") return filteredStocks;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStocks.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStocks, currentPage, viewMode]);

  const totalPages = Math.ceil(filteredStocks.length / ITEMS_PER_PAGE);

  // --- ACTIONS ---
  const handleTransaction = () => {
    const validItems = cart.filter(i => i.quantity > 0);
    if (validItems.length === 0) return toast.warning("Carrinho vazio.");
    if (viewMode === "entry") manualEntryMutation.mutate(validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })));
    else {
        if (!destination) return toast.warning("Selecione o destino.");
        manualExitMutation.mutate({ sector: destination, items: validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })) });
    }
  };

  const addToCart = (stock: any) => {
    if (cart.find(i => i.product_id === stock.products.id)) return;
    setCart([...cart, { product_id: stock.products.id, name: stock.products.name, sku: stock.products.sku, unit: stock.products.unit, current_stock: Number(stock.quantity_on_hand), quantity: 1 }]);
  };

  const handleExportReport = (type: 'pdf' | 'excel') => {
    if (!filteredStocks.length) return toast.error("Sem dados.");
    const data = filteredStocks.map((i: any) => ({ SKU: i.products?.sku, Produto: i.products?.name, "Físico": i.quantity_on_hand, Setor: i.sector || "Geral" }));
    const name = `Estoque_${activeTab}_${new Date().toLocaleDateString().replace(/\//g, '-')}`;
    type === 'excel' ? exportToExcel(data, name) : exportToPDF(`Relatório ${activeTab}`, [{header:"Produto", dataKey:"Produto"}, {header:"Qtd", dataKey:"Físico"}], data, name);
  };

  const removeFromCart = (id: string) => setCart(cart.filter(i => i.product_id !== id));
  const updateQuantity = (id: string, qtd: number) => setCart(cart.map(i => i.product_id === id ? { ...i, quantity: qtd } : i));

  // --- RENDERIZADORES ---
  const isEntry = viewMode === "entry";

  if (viewMode === "table") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* HEADER MODERNO */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Package className="h-8 w-8 text-emerald-500" /> 
              Controle de Estoque
            </h1>
            <p className="text-zinc-400 text-sm mt-1 font-light">Gerenciamento centralizado de ativos e materiais.</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300">
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#09090b] border-white/10 text-zinc-300">
                <DropdownMenuItem onClick={() => handleExportReport('excel')}><FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-500" /> Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReport('pdf')}><FileText className="mr-2 h-4 w-4 text-red-500" /> PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {canEditGeneralStock && activeTab === 'geral' && (
              <>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-all hover:scale-105" onClick={() => setViewMode("entry")}>
                  <ArrowDownToLine className="mr-2 h-4 w-4"/> Entrada
                </Button>
                <Button className="bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all hover:scale-105" onClick={() => setViewMode("exit")}>
                  <LogOut className="mr-2 h-4 w-4"/> Saída
                </Button>
              </>
            )}
          </div>
        </div>

        {/* TABS E FILTROS */}
        <div className="flex flex-col gap-4">
          <Tabs defaultValue="geral" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-full">
                <TabsTrigger value="geral" className="rounded-full data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-6"> Almoxarifado</TabsTrigger>
                <TabsTrigger value="setor" className="rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6"> Setorial</TabsTrigger>
              </TabsList>

              <div className="relative w-full md:w-96 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <Input 
                  placeholder="Filtrar produtos..." 
                  value={searchTerm} 
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                  className="pl-10 bg-zinc-900/50 border-white/5 text-white rounded-full focus:ring-emerald-500/50 transition-all hover:bg-white/5"
                />
              </div>
            </div>

            {/* CONTEÚDO ALMOXARIFADO */}
            <TabsContent value="geral" className="mt-0">
              <div className="rounded-3xl border border-white/5 bg-zinc-900/30 backdrop-blur-sm overflow-hidden shadow-2xl">
                <Table>
                  <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-transparent border-white/5">
                      <TableHead className="text-zinc-400 font-bold uppercase text-xs tracking-wider">Produto</TableHead>
                      <TableHead className="text-zinc-400 font-bold uppercase text-xs tracking-wider">SKU</TableHead>
                      <TableHead className="text-zinc-400 font-bold uppercase text-xs tracking-wider text-center">Físico</TableHead>
                      <TableHead className="text-zinc-400 font-bold uppercase text-xs tracking-wider text-center">Disponível</TableHead>
                      {canEditCost && <TableHead className="text-zinc-400 font-bold uppercase text-xs tracking-wider">Custo</TableHead>}
                      <TableHead className="text-zinc-400 font-bold uppercase text-xs tracking-wider text-center">Status</TableHead>
                      <TableHead className="text-right text-zinc-400 font-bold uppercase text-xs tracking-wider pr-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? Array.from({length:5}).map((_,i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full bg-zinc-800/50" /></TableCell></TableRow>) : 
                     paginatedStocks.map((stock: any) => {
                      const avail = (Number(stock.quantity_on_hand) || 0) - (Number(stock.quantity_reserved) || 0);
                      const isLow = stock.products?.min_stock && avail < stock.products.min_stock;
                      return (
                        <TableRow key={stock.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                          <TableCell className="font-medium text-white py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                                {stock.products?.name.substring(0,2).toUpperCase()}
                              </div>
                              {stock.products?.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-500 font-mono text-xs">{stock.products?.sku}</TableCell>
                          <TableCell className="text-center font-semibold text-zinc-300">{stock.quantity_on_hand}</TableCell>
                          <TableCell className="text-center">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${avail > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                              {avail.toFixed(2)}
                            </span>
                          </TableCell>
                          {canEditCost && (
                            <TableCell>
                              <div className="flex items-center gap-2 group/price cursor-pointer" onClick={() => setModalState({ type: 'cost', item: stock })}>
                                <span className="text-zinc-400 text-sm group-hover/price:text-white transition-colors">{stock.products?.unit_price ? `R$ ${Number(stock.products.unit_price).toFixed(2)}` : "-"}</span>
                                <Pencil className="h-3 w-3 text-zinc-600 opacity-0 group-hover/price:opacity-100 transition-opacity" />
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            {isLow ? 
                              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/20">Crítico</Badge> : 
                              <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 bg-emerald-500/10">Normal</Badge>
                            }
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {canEditGeneralStock && (
                              <Button variant="ghost" size="icon" className="hover:bg-white/10 rounded-full" onClick={() => { setModalState({ type: 'adjust', item: stock }); setFormValue(stock.quantity_on_hand); }}>
                                <Settings2 className="h-4 w-4 text-zinc-400" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* PAGINAÇÃO */}
              <div className="mt-4 flex justify-end">
                <Pagination>
                  <PaginationContent className="bg-zinc-900/50 rounded-full border border-white/5 p-1">
                    <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-full">Anterior</Button></PaginationItem>
                    <PaginationItem><span className="text-sm mx-4 text-zinc-400">Pag {currentPage} / {totalPages}</span></PaginationItem>
                    <PaginationItem><Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-full">Próximo</Button></PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </TabsContent>

            {/* CONTEÚDO SETORIAL */}
            <TabsContent value="setor" className="mt-0">
               {/* Seletor de Setor para Admins */}
               {(isAlmoxarife || isAdmin) && (
                  <div className="flex justify-between items-center mb-6 bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <MapPin className="text-blue-400 h-6 w-6" />
                      <span className="text-blue-200 font-medium">Visualizando Estoque de:</span>
                    </div>
                    <Select value={selectedSectorView} onValueChange={setSelectedSectorView}>
                      <SelectTrigger className="w-[250px] bg-black/40 border-blue-500/30 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        {SECTORS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Cards Setoriais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {canEditSectorStock && (
                    <div 
                      onClick={() => setModalState({ type: 'add', item: null })}
                      className="border border-dashed border-white/20 bg-white/5 hover:bg-white/10 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[180px] group"
                    >
                      <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform">
                        <PlusCircle className="h-6 w-6 text-white" />
                      </div>
                      <span className="mt-4 font-semibold text-blue-400 group-hover:text-blue-300">Novo Item</span>
                    </div>
                  )}
                  
                  {filteredStocks.map((stock: any) => (
                    <Card key={stock.id} className="bg-zinc-900/40 border-white/5 hover:border-white/10 transition-all hover:-translate-y-1 duration-300 group overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-400 font-mono text-[10px]">{stock.products?.sku}</Badge>
                          {canEditSectorStock && <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-full hover:bg-white/10" onClick={() => { setModalState({ type: 'consume', item: stock }); setFormValue(""); }}><Hammer className="h-3 w-3 text-zinc-400" /></Button>}
                        </div>
                        <h3 className="font-bold text-lg text-white mb-1 line-clamp-1" title={stock.products?.name}>{stock.products?.name}</h3>
                        <div className="flex items-end gap-1 mt-4">
                          <span className="text-3xl font-black text-blue-400">{stock.quantity_on_hand}</span>
                          <span className="text-sm font-medium text-zinc-500 mb-1">{stock.products?.unit}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* --- MODAIS UNIFICADOS --- */}
        <Dialog open={!!modalState.type} onOpenChange={() => closeModal()}>
          <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {modalState.type === 'adjust' && <Settings2 className="w-5 h-5 text-emerald-500" />}
                {modalState.type === 'consume' && <Hammer className="w-5 h-5 text-blue-500" />}
                {modalState.type === 'add' && <PlusCircle className="w-5 h-5 text-blue-500" />}
                {modalState.type === 'cost' && <DollarSign className="w-5 h-5 text-emerald-500" />}
                {modalState.type === 'adjust' ? "Ajuste de Estoque" : modalState.type === 'consume' ? "Consumir Material" : modalState.type === 'add' ? "Novo Item Setorial" : "Atualizar Custo"}
              </DialogTitle>
              {modalState.item && <DialogDescription className="text-zinc-400">{modalState.item.products?.name}</DialogDescription>}
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {modalState.type === 'add' ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Produto</Label>
                    <Select value={formValue} onValueChange={setFormValue}>
                        <SelectTrigger className="bg-zinc-900 border-white/10 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-[300px]">
                          {products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-400">Quantidade</Label>
                    <Input type="number" className="bg-zinc-900 border-white/10 text-white" value={secondaryFormValue} onChange={e => setSecondaryFormValue(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label className="text-zinc-400">{modalState.type === 'cost' ? 'Novo Valor (R$)' : 'Quantidade'}</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    className="bg-zinc-900 border-white/10 text-white text-lg font-bold" 
                    value={formValue} 
                    onChange={e => setFormValue(e.target.value)} 
                    autoFocus 
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={closeModal} className="hover:bg-white/10 text-zinc-300">Cancelar</Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-500 text-white" 
                onClick={() => {
                  if (modalState.type === 'adjust') adjustMutation.mutate({ id: modalState.item.id, quantity: Number(formValue) });
                  if (modalState.type === 'consume') adjustMutation.mutate({ id: modalState.item.id, quantity: Number(modalState.item.quantity_on_hand) - Number(formValue) });
                  if (modalState.type === 'cost') updatePriceMutation.mutate({ id: modalState.item.products.id, price: Number(formValue), type: 'unit_price' });
                  if (modalState.type === 'add') {
                    const sector = (isAlmoxarife || isAdmin) ? selectedSectorView : profile?.sector;
                    sectorEntryMutation.mutate({ sector, items: [{ product_id: formValue, quantity: Number(secondaryFormValue) }] });
                  }
                }}
              >
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    );
  }

  // --- MODO TRANSAÇÃO (ENTRADA/SAÍDA - VISUAL FUTURISTA) ---
  const transactionTheme = isEntry ? "emerald" : "red";
  const TransactionIcon = isEntry ? TrendingUp : TrendingDown;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6 animate-in zoom-in-95 duration-500">
      
      {/* HEADER TRANSAÇÃO */}
      <div className="flex justify-between items-center bg-zinc-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={resetTransaction} className="rounded-full h-12 w-12 border-white/10 bg-black/20 hover:bg-white/10">
            <RotateCcw className="h-5 w-5" />
          </Button>
          <div>
            <h1 className={`text-2xl font-black flex items-center gap-2 text-${transactionTheme}-500`}>
              <TransactionIcon className="h-6 w-6" /> {isEntry ? "Recebimento de Materiais" : "Baixa de Estoque"}
            </h1>
            <p className="text-zinc-400 text-sm">Operação de {isEntry ? "entrada" : "saída"} no Almoxarifado Central.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {!isEntry && (
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger className="w-64 bg-black/40 border-red-500/30 text-white h-12 rounded-xl"><SelectValue placeholder="Selecione o Destino" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">{SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
           )}
           <Button 
             className={`h-12 px-8 rounded-xl font-bold text-base shadow-xl transition-all hover:scale-105 ${isEntry ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30" : "bg-red-600 hover:bg-red-500 shadow-red-900/30"}`}
             onClick={handleTransaction}
             disabled={!cart.length}
           >
             {isEntry ? "Confirmar Entrada" : "Confirmar Baixa"}
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LISTA DE PRODUTOS (SELEÇÃO) */}
        <div className="col-span-4 bg-zinc-900/30 border border-white/5 rounded-3xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input placeholder="Buscar produto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-black/20 border-transparent text-white focus:bg-black/40 transition-all rounded-xl" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredStocks.filter((s:any) => !s.sector || s.sector === 'ALMOXARIFADO').map((stock: any) => (
              <div 
                key={stock.id} 
                onClick={() => addToCart(stock)}
                className="group flex flex-col p-4 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-white/10 active:scale-95"
              >
                <span className="font-bold text-sm text-zinc-200 group-hover:text-white transition-colors">{stock.products?.name}</span>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="font-mono text-zinc-500">{stock.products?.sku}</span>
                  <span className={`font-bold ${isEntry ? "text-zinc-400" : (stock.quantity_on_hand > 0 ? "text-emerald-500" : "text-red-500")}`}>
                    {stock.quantity_on_hand} {stock.products?.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARRINHO (ITENS SELECIONADOS) */}
        <div className="col-span-8 bg-zinc-900/30 border border-white/5 rounded-3xl flex flex-col overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 pointer-events-none" />
          <div className="p-4 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2"><Package className="h-5 w-5 text-zinc-400" /> Itens Selecionados</h3>
            <Badge variant="secondary" className="bg-white/10 text-white">{cart.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
                <Box className="h-16 w-16 opacity-20" />
                <p>Selecione produtos à esquerda para começar.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} className={`flex items-center gap-4 p-4 rounded-2xl bg-black/20 border transition-all ${isEntry ? "border-emerald-500/30" : "border-red-500/30"}`}>
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${isEntry ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{item.name}</h4>
                    <span className="text-xs text-zinc-500 font-mono">{item.sku}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">Quantidade</span>
                      <Input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => setCart(cart.map(c => c.product_id === item.product_id ? { ...c, quantity: Number(e.target.value) } : c))}
                        className="w-24 h-10 bg-black/40 border-white/10 text-center font-bold text-lg text-white focus:ring-0" 
                      />
                    </div>
                    <Button size="icon" variant="ghost" className="h-10 w-10 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl" onClick={() => setCart(cart.filter(c => c.product_id !== item.product_id))}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
