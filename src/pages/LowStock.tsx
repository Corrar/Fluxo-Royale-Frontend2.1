import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ShoppingCart, Eye, Search, X, Filter, CalendarClock, Truck, AlertOctagon,
  Download, FileSpreadsheet, FileText, RefreshCw, TriangleAlert, 
  Copy, CheckCircle2, TrendingDown, Clock, Activity, Zap, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isToday, differenceInDays, isBefore, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

// GSAP para Animações Premium
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

// --- COMPONENTE KPI CARD ---
const KPICard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, customBadge }: any) => (
  <Card className="gsap-kpi-card relative overflow-hidden border border-slate-200/60 dark:border-slate-800/60 shadow-lg hover:shadow-2xl dark:shadow-[0_0_30px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 transition-all duration-500 bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl group rounded-[2rem]">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-transparent via-slate-300 dark:via-slate-700 to-transparent opacity-30 group-hover:opacity-100 transition-opacity"></div>
      <div className={`absolute -right-6 -top-6 p-10 rounded-full opacity-[0.03] dark:opacity-[0.04] transition-transform group-hover:scale-[1.3] group-hover:rotate-12 duration-1000 ease-out ${bgClass.replace('bg-', 'bg-current text-')} ${colorClass}`}>
          <Icon className="w-32 h-32" />
      </div>
      <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
          <div className="flex justify-between items-start mb-4">
              <div className={`p-3.5 rounded-2xl shadow-inner border border-white/40 dark:border-white/10 ${bgClass} ${colorClass}`}>
                  <Icon className="w-6 h-6" />
              </div>
              {customBadge}
          </div>
          <div className="flex-1 flex flex-col justify-end">
              <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm truncate">{value}</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 truncate">{title}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse shrink-0"></span> 
                  {subtext}
              </p>
          </div>
      </CardContent>
  </Card>
);

export default function LowStock() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // --- ESTADOS ---
  const [noteDialogItem, setNoteDialogItem] = useState<any>(null);
  const [tempNote, setTempNote] = useState("");
  const [tempDate, setTempDate] = useState(""); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);

  // Filtros Avançados
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("all"); // Novo Filtro
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Permissões
  const canEdit = profile?.role === "compras" || profile?.role === "admin" || profile?.role === "gerente";

  // 1. BUSCAR DADOS
  const { data: lowStockItems, isLoading } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const response = await api.get("/products/low-stock");
      return response.data;
    },
    refetchInterval: 60000, // Atualiza a cada 1 minuto
  });

  // 2. MUTAÇÃO: ATUALIZAR TUDO
  const updateInfoMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; note: string; date?: string | null }) => {
      await api.put(`/products/${data.id}/purchase-info`, {
        purchase_status: data.status,
        purchase_note: data.note,
        delivery_forecast: data.date
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
    },
    onError: () => toast.error("Erro ao atualizar item."),
  });

  // --- ANIMAÇÕES GSAP ---
  useGSAP(() => {
    if (!isLoading && lowStockItems) {
        gsap.from(".gsap-header", { y: -30, opacity: 0, duration: 0.8, ease: "power3.out", clearProps: "all" });
        gsap.from(".gsap-kpi-card", { y: 40, opacity: 0, duration: 0.7, stagger: 0.1, ease: "back.out(1.2)", clearProps: "all" });
        gsap.from(".gsap-toolbar", { y: 20, opacity: 0, duration: 0.6, delay: 0.3, ease: "power2.out", clearProps: "all" });
        gsap.from(".gsap-table-row", { y: 20, opacity: 0, duration: 0.5, stagger: 0.05, ease: "back.out(1.1)", clearProps: "all", delay: 0.4 });
    }
  }, [isLoading, lowStockItems]);

  // --- LÓGICA: AUTO-CORREÇÃO DE DADOS VELHOS ---
  useEffect(() => {
    if (lowStockItems && lowStockItems.length > 0 && !isCleaning) {
      const itemsToReset = lowStockItems.filter((item: any) => {
        if (item.purchase_status !== 'pendente' && item.delivery_forecast && item.critical_since) {
          const forecastDate = parseISO(item.delivery_forecast);
          const criticalDate = parseISO(item.critical_since);
          return isBefore(forecastDate, criticalDate);
        }
        return false;
      });

      if (itemsToReset.length > 0) {
        setIsCleaning(true);
        Promise.all(itemsToReset.map((item: any) => 
          updateInfoMutation.mutateAsync({ id: item.id, status: "pendente", note: "", date: null })
        )).then(() => {
          toast.info(`${itemsToReset.length} itens tiveram dados de compra antigos resetados.`);
          setIsCleaning(false);
        });
      }
    }
  }, [lowStockItems]);

  // --- FILTRAGEM INTELIGENTE ---
  const filteredItems = useMemo(() => {
    if (!lowStockItems) return [];
    
    return lowStockItems.filter((item: any) => {
      const minStock = Number(item.min_stock || 0);
      const currentQty = Number(item.quantity || 0);
      const reservedQty = Number(item.quantity_reserved || 0);
      const disponivel = currentQty - reservedQty;

      if (disponivel > minStock) return false; 

      const matchesSearch = searchTerm === "" || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const itemStatus = item.purchase_status || "pendente";
      const matchesStatus = statusFilter === "all" || itemStatus === statusFilter;
      const matchesVendor = vendorFilter === "" || (item.purchase_note && item.purchase_note.toLowerCase().includes(vendorFilter.toLowerCase()));
      const matchesCategory = categoryFilter === "" || (item.description && item.description.toLowerCase().includes(categoryFilter.toLowerCase())) || item.name.toLowerCase().includes(categoryFilter.toLowerCase());

      // Filtro de Urgência
      const criticalDate = item.critical_since ? new Date(item.critical_since) : new Date();
      const days = differenceInDays(new Date(), criticalDate);
      const matchesUrgency = 
        urgencyFilter === "all" || 
        (urgencyFilter === "30" && days >= 30) ||
        (urgencyFilter === "15" && days >= 15 && days < 30) ||
        (urgencyFilter === "recent" && days < 15);

      return matchesSearch && matchesStatus && matchesVendor && matchesCategory && matchesUrgency;
    });
  }, [lowStockItems, searchTerm, statusFilter, vendorFilter, categoryFilter, urgencyFilter]);

  const activeFiltersCount = (statusFilter !== "all" ? 1 : 0) + (vendorFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (urgencyFilter !== "all" ? 1 : 0);

  // --- KPIS DINÂMICOS ---
  const kpis = useMemo(() => {
      if (!filteredItems) return { total: 0, deficit: 0, urgent: 0, progress: 0 };
      
      const total = filteredItems.length;
      let deficit = 0;
      let urgent = 0;
      let inProgress = 0;

      filteredItems.forEach((i: any) => {
          const m = Number(i.min_stock || 0);
          const q = Number(i.quantity || 0) - Number(i.quantity_reserved || 0);
          deficit += (m - q);

          const days = differenceInDays(new Date(), i.critical_since ? new Date(i.critical_since) : new Date());
          if (days >= 30 && (i.purchase_status === 'pendente' || !i.purchase_status)) urgent++;

          if (i.purchase_status === 'cotacao' || i.purchase_status === 'comprado') inProgress++;
      });

      return { total, deficit, urgent, progress: total > 0 ? Math.round((inProgress / total) * 100) : 0 };
  }, [filteredItems]);


  // --- FUNÇÕES DE AÇÃO ---
  const handleCopyForQuote = (item: any, deficit: number) => {
      const text = `Solicitação de Cotação:\nProduto: ${item.name}\nCódigo (SKU): ${item.sku}\nQuantidade Necessária: ${deficit} ${item.unit || 'un'}\n\nAguardo retorno, obrigado!`;
      navigator.clipboard.writeText(text);
      toast.success("Pronto para colar!", { description: "Texto de cotação copiado para a área de transferência." });
  };

  const handleExportReport = (type: 'pdf' | 'excel') => {
    const itemsToExport = selectedItems.length > 0 ? filteredItems.filter((i: any) => selectedItems.includes(i.id)) : filteredItems;
    if (!itemsToExport || itemsToExport.length === 0) return toast.error("Nada para exportar");

    const exportData = itemsToExport.map((item: any) => {
        const minStock = Number(item.min_stock || 0);
        const disponivel = Number(item.quantity || 0) - Number(item.quantity_reserved || 0);
        return {
            SKU: item.sku, Produto: item.name, "Estoque Disp.": disponivel, "Mínimo": minStock,
            "Déficit": minStock - disponivel, "Status": (item.purchase_status || "pendente").toUpperCase(),
            "Previsão": item.delivery_forecast ? format(new Date(item.delivery_forecast), "dd/MM/yyyy") : "-",
            "Obs": item.purchase_note || ""
        };
    });

    if (type === 'excel') {
        exportToExcel(exportData, "Painel_Compras_Inteligente");
        toast.success("Excel gerado com sucesso!");
    } else {
        const columns = [ { header: "SKU", dataKey: "SKU" }, { header: "Produto", dataKey: "Produto" }, { header: "Disp.", dataKey: "Estoque Disp." }, { header: "Mín.", dataKey: "Mínimo" }, { header: "Faltam", dataKey: "Déficit" }, { header: "Status", dataKey: "Status" } ];
        exportToPDF("Relatório de Compras / Reposição", columns, exportData, "Relatorio_Compras_PDF");
        toast.success("PDF gerado com sucesso!");
    }
    setSelectedItems([]);
  };

  const handleSelectAll = (checked: boolean) => checked ? setSelectedItems(filteredItems.map((i: any) => i.id)) : setSelectedItems([]);
  const handleSelectItem = (id: string, checked: boolean) => checked ? setSelectedItems(p => [...p, id]) : setSelectedItems(p => p.filter(i => i !== id));

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedItems.length === 0) return;
    const promise = Promise.all(
      selectedItems.map((id) => {
        const originalItem = lowStockItems.find((i: any) => i.id === id);
        const isResetting = newStatus === 'pendente';
        return updateInfoMutation.mutateAsync({ id, status: newStatus, note: isResetting ? "" : (originalItem?.purchase_note || ""), date: isResetting ? null : originalItem?.delivery_forecast });
      })
    );
    toast.promise(promise, { loading: 'Processando lote...', success: () => { setSelectedItems([]); return 'Lote atualizado!'; }, error: 'Erro na atualização' });
  };

  const handleStatusChange = (item: any, newStatus: string) => {
    const isResetting = newStatus === 'pendente';
    const shouldKeepDate = !isResetting && (newStatus === 'comprado' || newStatus === 'cotacao') && item.delivery_forecast;
    updateInfoMutation.mutate({ id: item.id, status: newStatus, note: isResetting ? "" : (item.purchase_note || ""), date: shouldKeepDate ? item.delivery_forecast : null }, { onSuccess: () => toast.success("Status de compra alterado.") });
  };

  const openNoteDialog = (item: any) => {
    setNoteDialogItem(item);
    setTempNote(item.purchase_note || "");
    setTempDate(item.delivery_forecast ? item.delivery_forecast.toString().split('T')[0] : "");
  };

  const handleSaveDialog = () => {
    if (noteDialogItem) {
      let statusToSave = noteDialogItem.purchase_status || "pendente";
      if (tempDate && statusToSave === "pendente") statusToSave = "comprado";
      updateInfoMutation.mutate({ id: noteDialogItem.id, status: statusToSave, note: tempNote, date: tempDate || null }, { onSuccess: () => { toast.success("Gerenciamento salvo!"); setNoteDialogItem(null); } });
    }
  };

  // --- VISUAIS ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case "comprado": return "text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";
      case "cotacao": return "text-indigo-700 dark:text-indigo-400 font-extrabold bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800";
      case "nao_comprado": return "text-slate-600 dark:text-slate-400 font-extrabold bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700";
      default: return "text-rose-600 dark:text-rose-400 font-extrabold bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.1)]";
    }
  };

  const renderCriticalTime = (criticalSince: string | null) => {
    const criticalDate = criticalSince ? new Date(criticalSince) : new Date();
    const days = differenceInDays(new Date(), criticalDate);
    
    let colorClass = "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800";
    let icon = <Clock className="w-3.5 h-3.5" />;
    let anim = "";
    
    if (days >= 30) {
        colorClass = "bg-rose-600 text-white border-rose-700 dark:border-rose-500 shadow-lg shadow-rose-500/40";
        icon = <TriangleAlert className="w-3.5 h-3.5" strokeWidth={3} />;
        anim = "animate-pulse";
    } else if (days >= 15) {
        colorClass = "bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-800";
        icon = <AlertOctagon className="w-3.5 h-3.5" />;
    } else if (days > 7) {
        colorClass = "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800";
    }

    return (
        <div className={`flex items-center gap-2 text-[11px] font-black px-3 py-1.5 rounded-lg border uppercase tracking-wider w-fit ${colorClass} ${anim}`}>
            {icon}
            {days <= 0 ? "HOJE" : days === 1 ? "1 DIA" : `${days} DIAS`}
        </div>
    );
  };

  // <-- FUNÇÃO RENDER DELIVERY DATE ADICIONADA -->
  const renderDeliveryDate = (dateString: string | null) => {
    if (!dateString) return <span className="text-slate-400 font-medium">-</span>;
    return <span className="font-bold text-indigo-600 dark:text-indigo-400">{format(parseISO(dateString), "dd/MM/yyyy")}</span>;
  };

  return (
    <div ref={containerRef} className="space-y-8 p-4 sm:p-8 bg-slate-50/50 dark:bg-[#0a0f1c] min-h-screen transition-colors duration-500 pb-32 overflow-x-hidden">
      
      {/* HEADER PREMIUM GSAP */}
      <div className="gsap-header flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-6 sm:p-8 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-r from-sky-500/20 to-indigo-500/20 blur-3xl rounded-full"></div>
          <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-4 text-slate-900 dark:text-white relative z-10 tracking-tight">
            <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-sky-500 rounded-[1.25rem] shadow-xl shadow-sky-500/30 text-white transform hover:scale-105 transition-transform cursor-pointer">
                <ShoppingCart className="h-7 w-7" strokeWidth={2.5} />
            </div>
            Central de Compras
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 ml-[4.5rem] font-semibold text-sm sm:text-base relative z-10 tracking-wide">
            Gestão analítica de <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">reposição de estoque</span>.
          </p>
        </div>
        
        {/* BOTÃO EXPORTAÇÃO */}
        {selectedItems.length === 0 && (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-dashed border-slate-300 dark:border-slate-700 dark:text-slate-300 h-12 rounded-xl font-bold px-6 shadow-sm hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all z-10">
                <Download className="h-4 w-4" strokeWidth={2.5} />
                Exportar Análise
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:bg-slate-900 dark:border-slate-800 rounded-xl p-2 shadow-2xl">
                <DropdownMenuItem onClick={() => handleExportReport('excel')} className="gap-3 cursor-pointer dark:focus:bg-slate-800 rounded-lg p-3 font-semibold">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Baixar Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportReport('pdf')} className="gap-3 cursor-pointer dark:focus:bg-slate-800 rounded-lg p-3 font-semibold">
                <FileText className="h-5 w-5 text-rose-600" /> Gerar PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        )}
      </div>

      {/* KPIS INTELIGENTES */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 w-full rounded-[2rem] bg-slate-200/60 dark:bg-slate-800/60" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
                title="Itens em Rutura" value={kpis.total} subtext="Requerem atenção" 
                icon={AlertOctagon} colorClass="text-amber-500" bgClass="bg-amber-500/10" 
            />
            <KPICard 
                title="Déficit de Peças" value={kpis.deficit} subtext="Volume total a comprar" 
                icon={TrendingDown} colorClass="text-rose-500" bgClass="bg-rose-500/10" 
            />
            <KPICard 
                title="Crítico Máximo" value={kpis.urgent} subtext="Parados há +30 dias" 
                icon={TriangleAlert} colorClass="text-red-600" bgClass="bg-red-600/10" 
                customBadge={kpis.urgent > 0 && <Badge className="bg-red-600 animate-pulse">Urgente</Badge>}
            />
            <KPICard 
                title="Progresso do Setor" value={`${kpis.progress}%`} subtext="Itens processados" 
                icon={CheckCircle2} colorClass="text-emerald-500" bgClass="bg-emerald-500/10" 
            />
        </div>
      )}

      {/* FERRAMENTAS GSAP */}
      <div className="gsap-toolbar flex flex-col sm:flex-row gap-4 bg-white/50 dark:bg-slate-900/30 p-3 rounded-[2rem] border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-indigo-400" />
          <Input 
            placeholder="Pesquisar material, SKU ou categoria..." 
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl shadow-sm font-bold text-slate-700 dark:text-slate-200 focus-visible:ring-indigo-500"
          />
        </div>

        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant={activeFiltersCount > 0 ? "secondary" : "outline"} className={`h-12 px-6 rounded-xl gap-3 font-black tracking-wide shadow-sm transition-all ${activeFiltersCount === 0 ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300" : "bg-indigo-600 text-white hover:bg-indigo-700 border-none"}`}>
              <Filter className="h-5 w-5" />
              Filtros Avançados
              {activeFiltersCount > 0 && <span className="flex items-center justify-center bg-white text-indigo-700 rounded-full h-6 w-6 text-xs">{activeFiltersCount}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] p-6 shadow-2xl rounded-[2rem] dark:bg-slate-900 dark:border-slate-800" align="end">
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-lg tracking-tight text-slate-800 dark:text-slate-200">Refinar Tabela</h4>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider" onClick={() => { setStatusFilter("all"); setVendorFilter(""); setCategoryFilter(""); setUrgencyFilter("all"); }}>Limpar Tudo</Button>
              </div>
              <Separator className="dark:bg-slate-800" />
              
              <div className="space-y-2">
                <Label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Urgência de Compra</Label>
                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="h-11 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                    <SelectItem value="all" className="font-bold">Todos os Prazos</SelectItem>
                    <SelectItem value="30" className="font-black text-rose-600 dark:text-rose-400">🚨 Crítico (+30 Dias)</SelectItem>
                    <SelectItem value="15" className="font-bold text-orange-600 dark:text-orange-400">⚠️ Alerta (+15 Dias)</SelectItem>
                    <SelectItem value="recent" className="font-bold text-sky-600 dark:text-sky-400">✅ Recente (0-14 Dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status da Compra</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 dark:bg-slate-800 dark:border-slate-700 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl">
                    <SelectItem value="all" className="font-bold">Todos os Status</SelectItem>
                    <SelectItem value="pendente" className="font-bold text-rose-600 dark:text-rose-400">🔴 Pendente</SelectItem>
                    <SelectItem value="cotacao" className="font-bold text-indigo-600 dark:text-indigo-400">🔵 Em Cotação</SelectItem>
                    <SelectItem value="comprado" className="font-bold text-emerald-600 dark:text-emerald-400">🟢 Comprado</SelectItem>
                    <SelectItem value="nao_comprado" className="font-bold text-slate-500">⚫ Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* TABELA PREMIUM */}
      <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-[2.5rem] bg-white/80 dark:bg-slate-900/50 backdrop-blur-2xl overflow-hidden shadow-2xl dark:shadow-[0_0_50px_-15px_rgba(0,0,0,0.4)]">
        <Table>
          <TableHeader className="bg-slate-100/50 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[60px] text-center px-4 py-6">
                <Checkbox 
                  checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  className="rounded-[4px] dark:border-slate-500 dark:data-[state=checked]:bg-indigo-500"
                />
              </TableHead>
              <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Produto & SKU</TableHead>
              <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Disp. / Mín</TableHead>
              <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Qtd. a Comprar</TableHead>
              <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Tempo em Falta</TableHead>
              <TableHead className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Status</TableHead>
              <TableHead className="text-center font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px]">Previsão</TableHead>
              <TableHead className="text-right font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-[11px] pr-8">Ações Rápidas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || isCleaning ? (
              <TableRow><TableCell colSpan={8} className="text-center h-48">
                <span className="flex flex-col items-center justify-center gap-3 text-slate-400 font-bold tracking-widest uppercase text-xs">
                  {isCleaning ? <RefreshCw className="h-8 w-8 animate-spin text-indigo-500"/> : <Activity className="h-8 w-8 animate-pulse text-indigo-500" />} 
                  {isCleaning ? "Limpando Banco..." : "A analisar necessidades..."}
                </span>
              </TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center h-48 text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest text-xs">Nenhum alerta de compra neste filtro.</TableCell></TableRow>
            ) : (
              filteredItems.map((item: any) => {
                const minStock = Number(item.min_stock || 0);
                const currentQty = Number(item.quantity || 0);
                const reservedQty = Number(item.quantity_reserved || 0);
                const disponivel = currentQty - reservedQty;
                const deficit = minStock - disponivel;
                const isSelected = selectedItems.includes(item.id);

                return (
                  <TableRow key={item.id} className={`gsap-table-row transition-all duration-300 border-b border-slate-100 dark:border-slate-800/60 ${isSelected ? "bg-indigo-50/50 dark:bg-indigo-900/20 shadow-inner" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 hover:shadow-sm"}`}>
                    <TableCell className="text-center px-4">
                      <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)} className="rounded-[4px] dark:border-slate-500 dark:data-[state=checked]:bg-indigo-500" />
                    </TableCell>
                    
                    <TableCell className="py-5">
                      <div className="flex flex-col gap-1 pr-4">
                        <span className="font-bold text-[15px] text-slate-800 dark:text-slate-200 leading-tight">{item.name}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono tracking-widest uppercase">{item.sku}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline" className="bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 w-fit px-3 py-1 font-black text-sm shadow-sm">
                          {disponivel} / {minStock}
                        </Badge>
                        {reservedQty > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-500 font-black bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 rounded-md w-fit border border-amber-100 dark:border-amber-800/30 tracking-wide">
                            ({currentQty} fis. - {reservedQty} res.)
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                        <Badge variant="secondary" className="bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 px-3 py-1.5 font-black text-sm shadow-sm">
                            +{deficit > 0 ? (Number.isInteger(deficit) ? deficit : deficit.toFixed(2)) : 0} {item.unit}
                        </Badge>
                    </TableCell>
                    
                    <TableCell>
                        {renderCriticalTime(item.critical_since)}
                    </TableCell>

                    <TableCell>
                      <Select value={item.purchase_status || "pendente"} onValueChange={(val) => handleStatusChange(item, val)} disabled={!canEdit}>
                        <SelectTrigger className={`w-[140px] h-10 rounded-xl focus:ring-indigo-500 ${getStatusColor(item.purchase_status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-xl">
                          <SelectItem value="pendente" className="font-bold py-2.5">🔴 Pendente</SelectItem>
                          <SelectItem value="cotacao" className="font-bold py-2.5">🔵 Em Cotação</SelectItem>
                          <SelectItem value="comprado" className="font-bold py-2.5">🟢 Comprado</SelectItem>
                          <SelectItem value="nao_comprado" className="font-bold py-2.5">⚫ Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="text-center">
                      {renderDeliveryDate(item.delivery_forecast)}
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-10 w-10 rounded-xl border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
                            onClick={() => handleCopyForQuote(item, deficit)}
                            title="Copiar dados para pedir Cotação"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className={`h-10 w-10 rounded-xl shadow-sm transition-all ${item.purchase_note || item.delivery_forecast ? "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" : "border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800"}`}
                            onClick={() => openNoteDialog(item)}
                            title="Editar detalhes e prazo"
                          >
                            {!canEdit && (item.purchase_note || item.delivery_forecast) ? <Eye className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* BARRA FLUTUANTE DE AÇÕES (LOTE) */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200/80 dark:border-slate-700 shadow-[0_30px_60px_-10px_rgba(0,0,0,0.5)] rounded-full px-8 py-4 flex items-center gap-5 z-50 animate-in slide-in-from-bottom-12 fade-in duration-500">
          <div className="flex items-center gap-3 border-r border-slate-200 dark:border-slate-700 pr-5">
            <Badge variant="default" className="rounded-full h-8 w-8 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg text-sm p-0 font-black">{selectedItems.length}</Badge>
            <span className="text-[13px] font-black uppercase tracking-widest whitespace-nowrap text-slate-800 dark:text-slate-200">Selecionados</span>
          </div>
          
          {canEdit && (
            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusChange('pendente')} className="rounded-[1rem] font-bold h-11 px-5 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-900/20 shadow-sm">
                 Resetar Erro
              </Button>
              <Button size="sm" onClick={() => handleBulkStatusChange('cotacao')} className="rounded-[1rem] font-black uppercase tracking-wider text-[11px] h-11 px-6 bg-indigo-500 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-0.5">
                Em Cotação
              </Button>
              <Button size="sm" onClick={() => handleBulkStatusChange('comprado')} className="rounded-[1rem] font-black uppercase tracking-wider text-[11px] h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 transition-all hover:-translate-y-0.5">
                Marcar Comprado
              </Button>
            </div>
          )}
          
          <Button size="icon" variant="ghost" className="rounded-full h-11 w-11 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800 border ml-2 border-transparent hover:border-rose-200 transition-colors" onClick={() => setSelectedItems([])}>
              <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* DIALOG DE DETALHES PREMIUM */}
      <Dialog open={!!noteDialogItem} onOpenChange={(open) => !open && setNoteDialogItem(null)}>
        <DialogContent className="sm:max-w-lg dark:bg-slate-900 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600"><ShoppingCart className="h-6 w-6"/></div>
                {canEdit ? "Gerir Reposição" : "Detalhes da Reposição"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
              <p className="text-[11px] text-indigo-500 dark:text-indigo-400 uppercase font-black tracking-widest mb-1.5">Identificação do Material</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">{noteDialogItem?.name}</p>
              <p className="text-sm text-slate-500 font-mono mt-1.5">{noteDialogItem?.sku}</p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Previsão de Entrega</Label>
                <Input 
                  type="date" 
                  value={tempDate} 
                  onChange={(e) => setTempDate(e.target.value)} 
                  disabled={!canEdit}
                  className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-bold px-4 ${tempDate && new Date(tempDate) < new Date(new Date().setHours(0,0,0,0)) ? "border-rose-300 text-rose-600 focus-visible:ring-rose-500 bg-rose-50 dark:bg-rose-900/20" : "focus-visible:ring-indigo-500"}`}
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Automação</Label>
                <div className="h-12 flex items-center px-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-500">
                  {tempDate && noteDialogItem?.purchase_status === 'pendente' ? <span className="text-emerald-600 flex items-center gap-2"><TrendingUp className="h-4 w-4"/> Vai p/ Comprado</span> : "Mantém Status Atual"}
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5">
              <Label htmlFor="note" className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Anotações / Fornecedor</Label>
              <Textarea 
                id="note"
                placeholder={canEdit ? "Insira links, e-mails, nº NF ou detalhes técnicos..." : "Nenhum detalhe logístico registrado."}
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                rows={5}
                readOnly={!canEdit}
                className="resize-none rounded-2xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 font-medium p-4 focus-visible:ring-indigo-500"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" onClick={() => setNoteDialogItem(null)} className="rounded-xl font-bold px-6 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 h-12">Fechar Janela</Button>
              {canEdit && <Button onClick={handleSaveDialog} className="rounded-xl font-black uppercase tracking-wider text-[11px] px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/30 h-12 hover:-translate-y-0.5 transition-all">Registrar Alteração</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
