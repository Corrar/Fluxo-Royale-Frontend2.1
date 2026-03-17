import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { cn } from "@/lib/utils";

import { 
  Check, X, Package, Search, Trash2, AlertCircle, Truck, 
  Clock, CheckCircle2, XCircle, User, Layers, ChevronRight,
  ClipboardList, PackageOpen, MapPin, AlertTriangle
} from "lucide-react";

// ==========================================
// CONFIGURAÇÕES VISUAIS DA LISTA (DARK MODE CORRIGIDO)
// ==========================================
const statusStyles: any = {
  aberto: { 
    label: "Aberto", 
    color: "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    icon: Clock,
  },
  aprovado: { 
    label: "Aprovado", 
    color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    icon: Package,
  },
  rejeitado: { 
    label: "Rejeitado", 
    color: "text-red-700 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    icon: XCircle,
  },
  entregue: { 
    label: "Entregue", 
    color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    icon: CheckCircle2,
  },
};

// ==========================================
// COMPONENTE: EMPTY STATE
// ==========================================
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-center border border-dashed rounded-2xl sm:rounded-3xl border-muted bg-muted/20 min-h-[250px] sm:min-h-[300px] animate-in fade-in zoom-in duration-300 w-full col-span-full mt-4">
    <div className="h-14 w-14 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 sm:mb-6">
      <Package className="h-7 w-7 sm:h-10 sm:w-10 text-primary/60" />
    </div>
    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h3>
    <p className="text-sm sm:text-base text-muted-foreground max-w-sm mt-2 sm:mt-3 mb-8">{description}</p>
  </div>
);

// ==========================================
// COMPONENTE: TIMELINE ESTILO MERCADO LIVRE
// ==========================================
const MLTimeline = ({ request }: { request: any }) => {
  const { status, created_at, rejection_reason } = request;
  const isRejected = status === "rejeitado";
  const isDelivered = status === "entregue";
  const isApproved = status === "aprovado";
  const isOpened = status === "aberto";

  const steps = [
    {
      id: 1,
      title: "Pedido recebido",
      desc: "Sua solicitação foi registrada e será analisada.",
      date: created_at ? format(new Date(created_at), "dd MMM HH:mm", { locale: ptBR }) : "",
      isCompleted: true, 
      isActive: isOpened && !isRejected,
      isRejected: false
    },
    {
      id: 2,
      title: isRejected ? "Pedido recusado" : "Em preparação",
      desc: isRejected ? rejection_reason : "O almoxarifado aprovou e está separando os materiais.",
      date: isRejected || isApproved || isDelivered ? (isRejected ? "Recusado" : "Aprovado") : "",
      isCompleted: isApproved || isDelivered || isRejected,
      isActive: isApproved || isRejected,
      isRejected: isRejected
    }
  ];

  if (!isRejected) {
    steps.push({
      id: 3,
      title: "Entregue",
      desc: "Materiais finalizados e entregues ao setor.",
      date: isDelivered ? "Finalizado" : "",
      isCompleted: isDelivered,
      isActive: isDelivered,
      isRejected: false
    });
  }

  return (
    <div className="flex flex-col w-full py-2 pl-1 sm:pl-2">
      {steps.map((step, index) => {
         const isLast = index === steps.length - 1;
         const lineCompleted = steps[index + 1]?.isCompleted; 

         return (
           <div key={step.id} className="relative flex gap-5 sm:gap-6">
             {/* Linha Conectora (Com dark mode adjustments) */}
             {!isLast && (
               <div className={cn(
                 "absolute left-[11px] top-8 bottom-[-8px] w-[2px] rounded-full transition-colors duration-500",
                 lineCompleted && !step.isRejected ? "bg-emerald-500" : "bg-border"
               )} />
             )}

             {/* Bolinha de Status (Node) */}
             <div className="relative flex flex-col items-center z-10 pt-1 shrink-0">
               {step.isCompleted && !step.isActive && !step.isRejected ? (
                 <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center ring-4 ring-card shadow-sm">
                   <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                 </div>
               ) : step.isActive && !step.isRejected ? (
                 <div className="relative h-6 w-6 rounded-full bg-card border-[3px] border-emerald-500 flex items-center justify-center ring-4 ring-card shadow-sm">
                   <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                   <div className="absolute inset-[-4px] rounded-full border border-emerald-500/50 animate-ping" />
                 </div>
               ) : step.isRejected ? (
                 <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center ring-4 ring-card shadow-sm">
                   <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                 </div>
               ) : (
                 <div className="h-6 w-6 rounded-full bg-card border-[3px] border-border flex items-center justify-center ring-4 ring-card" />
               )}
             </div>

             {/* Textos */}
             <div className={cn(
               "flex flex-col pb-8 min-w-0",
               !step.isCompleted && !step.isActive && "opacity-50" 
             )}>
               <h4 className={cn(
                 "text-base sm:text-lg font-bold leading-tight tracking-tight",
                 step.isRejected ? "text-red-600 dark:text-red-400" : 
                 step.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
               )}>
                 {step.title}
               </h4>
               
               {step.date && (
                 <span className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                   {step.date}
                 </span>
               )}
               
               <p className="text-sm mt-1 sm:mt-1.5 text-muted-foreground leading-snug">
                 {step.desc}
               </p>
             </div>
           </div>
         )
      })}
    </div>
  )
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function Requests() {
  const { profile } = useAuth();
  const { socket, markRequestsAsRead } = useSocket(); 
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    markRequestsAsRead();
  }, [markRequestsAsRead]);

  useEffect(() => {
    if (socket) {
      const handleUpdate = () => { queryClient.invalidateQueries({ queryKey: ["requests"] }); };
      socket.on("new_request", handleUpdate);
      socket.on("refresh_requests", handleUpdate);
      return () => {
        socket.off("new_request", handleUpdate);
        socket.off("refresh_requests", handleUpdate);
      };
    }
  }, [socket, queryClient]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => (await api.get("/requests")).data,
    refetchInterval: 10000, 
    placeholderData: keepPreviousData, 
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      await api.put(`/requests/${id}/status`, { status, rejection_reason: reason });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      const msg = variables.status === 'aprovado' ? 'Aprovado! Os itens já podem ser separados.' : 
                  variables.status === 'rejeitado' ? 'Solicitação recusada e notificada.' : 'Entregue com sucesso!';
      toast.success(msg);
      closeAllDialogs();
    },
    onError: (error: any) => { toast.error(error.response?.data?.error || "Erro ao atualizar."); },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success("Registro apagado do histórico.");
      closeAllDialogs();
    },
  });

  const closeAllDialogs = () => {
    setIsRejectDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedRequest(null);
    setRequestActionId(null);
    setRejectionReason("");
  };

  const handleApprove = (id: string) => updateStatusMutation.mutate({ id, status: "aprovado" });
  const handleDeliver = (id: string) => updateStatusMutation.mutate({ id, status: "entregue" });
  
  const openRejectDialog = (id: string) => {
    setRequestActionId(id);
    setIsRejectDialogOpen(true);
  };

  const openDeleteDialog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setRequestActionId(id);
    setDeleteDialogOpen(true);
  };

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter((request: any) => {
      const matchesSearch = 
        searchTerm === "" ||
        request.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.request_items?.some((item: any) => (item.products?.name || item.custom_product_name || "").toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const canManage = profile?.role === "admin" || profile?.role === "almoxarife";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-5 sm:space-y-6 animate-in fade-in duration-500 pb-24 overflow-x-hidden min-h-screen">
      
      {/* Header Fixo */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 w-full">
        <div className="min-w-0 w-full">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2 sm:gap-3 truncate">
              <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" /> Solicitações
          </h1>
          <p className="text-[11px] sm:text-sm font-medium text-muted-foreground mt-0.5 sm:mt-1 truncate">Acompanhe os pedidos de materiais do estoque.</p>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4 justify-between items-start md:items-center bg-card p-2 sm:p-4 rounded-xl sm:rounded-[1.25rem] border border-border/50 shadow-sm w-full min-w-0">
         <div className="relative w-full md:max-w-md group shrink-0">
            <Search className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
                placeholder="Buscar item ou setor..." 
                className="pl-9 sm:pl-10 h-9 sm:h-12 bg-muted/40 border-transparent rounded-lg sm:rounded-xl focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all font-medium text-xs sm:text-base w-full"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         
         <div className="w-full overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
            <div className="flex bg-muted/50 p-1 rounded-lg sm:rounded-xl w-max min-w-full gap-1">
                {['all', 'aberto', 'aprovado', 'entregue', 'rejeitado'].map((status) => {
                    const isActive = statusFilter === status;
                    const config = statusStyles[status] || {};
                    return (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={cn(
                                "flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-bold rounded-md sm:rounded-lg transition-all capitalize tracking-wide whitespace-nowrap",
                                isActive ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {status === 'all' ? 'Todas' : config.label}
                        </button>
                    );
                })}
            </div>
         </div>
      </div>

      {/* Grid de Cards (Lista) */}
      {isLoading ? (
         <div className="flex items-center justify-center h-40 w-full"><span className="animate-pulse text-sm font-semibold text-muted-foreground">Carregando...</span></div>
      ) : filteredRequests?.length === 0 ? (
         <EmptyState title="Nenhum pedido encontrado" description="Altere os filtros de pesquisa ou aguarde novas solicitações." />
      ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 w-full">
            {filteredRequests.map((request: any) => {
               const style = statusStyles[request.status] || statusStyles.aberto;
               const StatusIcon = style.icon;
               const itemCount = request.request_items?.length || 0;
               const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ptBR });

               return (
                  <Card 
                     key={request.id} 
                     className={cn(
                         "group cursor-pointer rounded-xl sm:rounded-3xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden w-full min-w-0",
                         request.status === 'aberto' && "ring-1 sm:ring-2 ring-primary/30 border-transparent bg-primary/[0.02]" 
                     )}
                     onClick={() => setSelectedRequest(request)}
                  >
                     <div className="p-3 sm:p-5 pb-2 sm:pb-3 flex flex-col min-w-0">
                         <div className="flex justify-between items-start gap-2 mb-2 sm:mb-3 w-full">
                             <Badge variant="outline" className={cn("shrink-0 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] uppercase font-black tracking-widest border", style.color)}>
                                 <StatusIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" /> {style.label}
                             </Badge>
                             <span className="shrink-0 text-[9px] sm:text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                                 <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {timeAgo}
                             </span>
                         </div>
                         
                         <div className="w-full min-w-0">
                             <h3 className="text-base sm:text-xl font-black text-foreground leading-tight truncate mb-1 sm:mb-1.5">
                                {request.requester?.name || "Desconhecido"}
                             </h3>
                             <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-semibold text-muted-foreground bg-background w-fit max-w-full px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-border/50">
                                 <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> 
                                 <span className="truncate">{request.sector}</span>
                             </div>
                         </div>
                     </div>

                     <div className="px-3 sm:px-5 py-2 sm:py-4 bg-muted/30 border-t border-border/50 flex items-center justify-between w-full min-w-0">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                            <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0">
                                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-foreground/70" />
                            </div>
                            <span className="text-[11px] sm:text-sm font-black text-foreground truncate">{itemCount} Itens</span>
                        </div>
                        
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            {canManage && (
                                <Button 
                                    variant="ghost" size="icon" 
                                    className="h-7 w-7 sm:h-9 sm:w-9 text-muted-foreground hover:bg-red-100 hover:text-red-600 rounded-full z-10"
                                    onClick={(e) => openDeleteDialog(request.id, e)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                            )}
                            <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-foreground text-background flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                <ChevronRight className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                            </div>
                        </div>
                     </div>
                  </Card>
               );
            })}
         </div>
      )}

      {/* ================================================================= */}
      {/* MODAL DETALHADO (DARK MODE CORRIGIDO) */}
      {/* ================================================================= */}
      <Dialog open={!!selectedRequest} onOpenChange={() => closeAllDialogs()}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl bg-card border-border/50 p-0 overflow-hidden shadow-2xl rounded-[24px] sm:rounded-[32px] flex flex-col max-h-[90dvh]">
          
          {/* HEADER MERCADO LIVRE (Status Gigante) */}
          {selectedRequest && (
            <div className={cn(
              "px-5 sm:px-8 py-6 sm:py-8 border-b border-border/50 flex flex-col gap-1 sm:gap-2 shrink-0 relative overflow-hidden",
              selectedRequest.status === 'entregue' ? "bg-emerald-50 dark:bg-emerald-500/10" :
              selectedRequest.status === 'rejeitado' ? "bg-red-50 dark:bg-red-500/10" :
              selectedRequest.status === 'aprovado' ? "bg-amber-50 dark:bg-amber-500/10" : "bg-blue-50 dark:bg-blue-500/10"
            )}>
                {/* Elemento gráfico de fundo */}
                <div className="absolute -right-10 -top-10 opacity-10 dark:opacity-[0.05] pointer-events-none">
                    <PackageOpen className="w-48 h-48" />
                </div>

                <DialogTitle className={cn(
                  "text-2xl sm:text-3xl font-black z-10",
                  selectedRequest.status === 'entregue' ? "text-emerald-700 dark:text-emerald-400" :
                  selectedRequest.status === 'rejeitado' ? "text-red-700 dark:text-red-400" :
                  selectedRequest.status === 'aprovado' ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
                )}>
                    {selectedRequest.status === 'entregue' ? "Entregue" :
                     selectedRequest.status === 'rejeitado' ? "Pedido Recusado" :
                     selectedRequest.status === 'aprovado' ? "Em preparação" : "Pedido Realizado"}
                </DialogTitle>

                <p className="text-sm sm:text-base font-medium text-foreground/80 z-10">
                    {selectedRequest.status === 'entregue' ? "Materiais foram entregues ao setor." :
                     selectedRequest.status === 'rejeitado' ? "A solicitação não pôde ser atendida." :
                     selectedRequest.status === 'aprovado' ? "O almoxarifado já aprovou e está separando os itens." : "Recebemos o pedido e ele aguarda aprovação."}
                </p>
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2 z-10">
                    ID #{selectedRequest.id.substring(0, 8)}
                </span>
            </div>
          )}

          {/* ÁREA DE SCROLL (Conteúdo Principal) */}
          <div className="flex-1 overflow-y-auto p-0 bg-background">
            
            {/* Bloco de Rastreio (Timeline) */}
            {selectedRequest && (
                <div className="p-5 sm:p-8 border-b border-border/50">
                    <MLTimeline request={selectedRequest} />
                </div>
            )}

            {/* Bloco de Destinatário / Setor */}
            <div className="p-5 sm:p-8 border-b border-border/50 flex gap-4 items-start">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-muted-foreground">Destino do pedido</span>
                    <span className="text-base sm:text-lg font-bold text-foreground truncate mt-0.5">{selectedRequest?.requester?.name || "Desconhecido"}</span>
                    <span className="text-sm text-muted-foreground truncate">{selectedRequest?.sector || "Geral"}</span>
                </div>
            </div>

            {/* Lista de Itens (Recibo Tracejado) */}
            <div className="p-5 sm:p-8">
              <h4 className="font-bold text-sm sm:text-base mb-4 text-muted-foreground uppercase tracking-widest">
                Produtos ({selectedRequest?.request_items?.length})
              </h4>
              
              <div className="border border-border/60 rounded-xl sm:rounded-2xl overflow-hidden bg-card shadow-sm">
                <div className="divide-y divide-border/60">
                  {selectedRequest?.request_items?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/10 transition-colors w-full min-w-0">
                        <div className="flex flex-col pr-3 sm:pr-4 min-w-0 flex-1">
                            <span className="font-bold text-sm sm:text-base text-foreground leading-snug break-words">
                                {item.products?.name || item.custom_product_name}
                            </span>
                            {item.products?.sku && (
                                <span className="font-mono text-[10px] sm:text-xs text-muted-foreground mt-1 bg-muted w-fit px-1.5 py-0.5 rounded">
                                    CÓD: {item.products.sku}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Qtd</span>
                            <span className="text-base sm:text-lg font-black text-foreground bg-muted/50 px-2 py-0.5 rounded-lg border border-border/50">
                                {item.quantity_requested} <span className="text-xs font-bold text-muted-foreground">{item.products?.unit || "UN"}</span>
                            </span>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Rodapé Fixo de Ações */}
          <div className="p-4 sm:p-6 bg-card border-t border-border/50 flex flex-col sm:flex-row gap-2 sm:gap-3 shrink-0">
            {canManage && selectedRequest?.status === 'aberto' ? (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl h-12 sm:h-14 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-bold text-sm sm:text-base min-w-0 truncate" 
                  onClick={() => openRejectDialog(selectedRequest.id)}
                >
                  <X className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 shrink-0" /> Recusar
                </Button>
                <Button 
                  className="flex-[2] rounded-xl h-12 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md sm:shadow-lg shadow-emerald-600/20 font-black text-sm sm:text-lg min-w-0 truncate" 
                  onClick={() => handleApprove(selectedRequest.id)}
                >
                  <Check className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-6 sm:w-6 shrink-0" /> Aprovar e Preparar
                </Button>
              </>
            ) : canManage && selectedRequest?.status === 'aprovado' ? (
              <Button 
                  className="w-full rounded-xl h-12 sm:h-14 bg-blue-600 hover:bg-blue-700 text-white shadow-md sm:shadow-lg shadow-blue-600/20 font-black text-sm sm:text-lg min-w-0 truncate" 
                  onClick={() => handleDeliver(selectedRequest.id)}
                >
                  <Truck className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-6 sm:w-6 shrink-0" /> Confirmar Entrega
              </Button>
            ) : (
              <Button variant="secondary" className="w-full rounded-xl h-12 sm:h-14 font-bold text-sm sm:text-base bg-muted/80 hover:bg-muted text-foreground min-w-0 truncate" onClick={closeAllDialogs}>
                Fechar Acompanhamento
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE RECUSA --- */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="w-[95vw] bg-card border-border rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="h-12 w-12 sm:h-16 sm:w-16 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-1 sm:mb-2">
                  <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <DialogTitle className="text-lg sm:text-2xl font-black text-foreground">Recusar Pedido</DialogTitle>
              <DialogDescription className="text-xs sm:text-base font-medium text-muted-foreground">
                  Explique o motivo para que o setor solicitante entenda a recusa.
              </DialogDescription>
          </div>
          <Textarea 
            placeholder="Ex: Não temos estoque suficiente deste material no momento..." 
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="bg-background min-h-[100px] sm:min-h-[120px] rounded-xl border-border/50 focus:ring-2 focus:ring-red-500/20 text-sm sm:text-base p-3 sm:p-4 resize-none shadow-inner"
          />
          <DialogFooter className="mt-4 sm:mt-6 flex flex-row gap-2 sm:gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm" onClick={() => setIsRejectDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" className="flex-1 rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm shadow-md shadow-red-500/20" onClick={() => requestActionId && updateStatusMutation.mutate({ id: requestActionId, status: "rejeitado", reason: rejectionReason })}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- DIALOG DE EXCLUSÃO --- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[95vw] bg-card border-border rounded-[24px] sm:rounded-[32px] p-5 sm:p-6 sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-2 sm:space-y-3 mb-4 sm:mb-6">
              <div className="h-12 w-12 sm:h-16 sm:w-16 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-1 sm:mb-2">
                  <Trash2 className="h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              <DialogTitle className="text-lg sm:text-2xl font-black text-foreground">Apagar Registro?</DialogTitle>
              <DialogDescription className="text-xs sm:text-base py-1 sm:py-2 text-foreground/80">
                  Tem certeza que deseja excluir esta solicitação permanentemente do histórico do sistema?
              </DialogDescription>
          </div>
          <DialogFooter className="flex flex-row gap-2 sm:gap-3 w-full">
            <Button variant="outline" className="flex-1 rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="flex-1 rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm shadow-md shadow-red-500/20" onClick={() => requestActionId && deleteRequestMutation.mutate(requestActionId)}>
                Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
