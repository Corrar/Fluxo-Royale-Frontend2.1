import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  ListTodo,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  User as UserIcon,
  DollarSign,
  FileText
} from "lucide-react";

// Estilos de status
const statusStyles: Record<string, string> = {
  processando: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  pronto: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  enviado: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  cancelado: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
};

const CORREIOS_TRACK_URL = "https://rastreamento.correios.com.br/";

// Formatação de Moeda (R$)
const formatCurrency = (value: string | number) => {
  const num = Number(value);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(isNaN(num) ? 0 : num);
};

// Extrair Rastreio
function parseShippingMethod(method?: string) {
  const m = String(method || "");
  const match = m.match(/\|\s*Rastreio:\s*(.+)$/i);
  if (!match) return { base: m, tracking: "" };
  return {
    base: m.replace(/\|\s*Rastreio:.*$/i, "").trim(),
    tracking: (match[1] || "").trim(),
  };
}

export default function Orders() {
  const queryClient = useQueryClient();

  // Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isShipOpen, setIsShipOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Dados e Filtros
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");

  // Estado Criação
  const [newOrder, setNewOrder] = useState({ customer: "", city: "", objective: "venda", value: "" });

  // Estado Edição
  const [editForm, setEditForm] = useState({ id: "", customer: "", city: "", objective: "", value: "" });

  // Estado Envio
  const [shipType, setShipType] = useState("correios");
  const [shipDetails, setShipDetails] = useState("");
  const [invoiceKey, setInvoiceKey] = useState("");
  const [trackingCode, setTrackingCode] = useState("");

  // Queries
  const { data: orders } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/orders")).data,
    refetchInterval: 3000,
  });

  // --- MUTATIONS ---

  // 1. Criar
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) =>
      await api.post("/orders", { 
        customer_name: data.customer, 
        city: data.city, 
        objective: data.objective, 
        order_value: parseFloat(data.value || 0), 
        items: [] 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido criado!");
      setIsCreateOpen(false);
      setNewOrder({ customer: "", city: "", objective: "venda", value: "" });
    },
    onError: () => toast.error("Erro ao criar pedido"),
  });

  // 2. Editar (CORRIGIDO)
  const editOrderMutation = useMutation({
    mutationFn: async (data: any) => {
        return await api.put(`/orders/${data.id}`, {
            customer_name: data.customer,
            city: data.city,
            objective: data.objective,
            order_value: parseFloat(data.value || 0)
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido atualizado!");
      setIsEditOpen(false);
    },
    onError: () => toast.error("Erro ao editar"),
  });

  // 3. Excluir (CORRIGIDO)
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => await api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido excluído.");
      setIsDeleteOpen(false);
    },
    onError: () => toast.error("Erro ao excluir pedido"),
  });

  // 4. Status / Envio
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, method, invoice }: any) => {
      const payload: any = { status };
      if (typeof method === "string") payload.shipping_method = method;
      if (typeof invoice === "string") payload.invoice_number = invoice;
      
      return await api.put(`/orders/${id}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Envio registrado!");
      setIsShipOpen(false);
      setShipDetails("");
      setInvoiceKey("");
      setTrackingCode("");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  // --- Handlers ---

  const handleShipOrder = () => {
    if (!selectedOrder?.id) return toast.warning("Selecione um pedido.");

    let finalMethod = "";
    switch (shipType) {
      case "correios": finalMethod = "Correios"; break;
      case "aviao": finalMethod = "Aéreo (Avião)"; break;
      case "transportadora":
        if (!shipDetails) return toast.warning("Informe a transportadora");
        finalMethod = `Transp. ${shipDetails}`;
        break;
      case "tecnico":
        if (!shipDetails) return toast.warning("Informe o técnico");
        finalMethod = `Técnico: ${shipDetails}`;
        break;
      default: finalMethod = "Correios";
    }

    const tracking = trackingCode.trim();
    const methodWithTracking = tracking ? `${finalMethod} | Rastreio: ${tracking}` : finalMethod;

    updateStatusMutation.mutate({
      id: selectedOrder.id,
      status: "enviado",
      method: methodWithTracking,
      invoice: invoiceKey.trim(),
    });
  };

  const openTrackingLink = (code: string) => {
      window.open(CORREIOS_TRACK_URL, "_blank", "noopener,noreferrer");
      navigator.clipboard.writeText(code);
      toast.message("Código copiado! Cole no site dos Correios.");
  };

  // --- Lógica de Agrupamento ---
  const processOrders = (statusFilter: 'active' | 'history') => {
    if (!orders) return {};

    const filtered = orders.filter((o: any) => {
        const matchesStatus = statusFilter === 'active' ? o.status === 'processando' : o.status !== 'processando';
        const matchesSearch = o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(o.order_number).includes(searchTerm) ||
            (o.invoice_number && String(o.invoice_number).includes(searchTerm));
        const matchesType = typeFilter === 'todos' ? true : o.objective === typeFilter;

        return matchesStatus && matchesSearch && matchesType;
    });

    const grouped: Record<string, any[]> = {};
    filtered.forEach((order: any) => {
        const date = new Date(order.created_at);
        const monthKey = format(date, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase());
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push(order);
    });
    return grouped;
  };

  const activeGroups = useMemo(() => processOrders('active'), [orders, searchTerm, typeFilter]);
  const historyGroups = useMemo(() => processOrders('history'), [orders, searchTerm, typeFilter]);

  // --- CARD PEDIDO ---
  const OrderCard = ({ order }: { order: any }) => {
    const parsed = parseShippingMethod(order.shipping_method);

    return (
      <Card className={`relative overflow-hidden border shadow-sm transition-all group ${
        order.status === 'enviado' ? 'border-emerald-500/50' : 'border-l-4 border-l-blue-600'
      }`}>
        <CardHeader className="bg-muted/10 pb-3 border-b">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <div className="bg-background border rounded px-3 py-1 flex flex-col items-center justify-center min-w-[60px] shadow-sm">
                <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Pedido</span>
                <span className="text-2xl font-black text-primary">#{order.order_number}</span>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{order.customer_name}</h3>
                  <Badge variant={order.objective === "reposicao" ? "destructive" : "secondary"} className="text-[9px] h-4">
                    {order.objective === "reposicao" ? "Reposição" : "Venda"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {order.city || "Cidade não informada"}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                </div>
              </div>
            </div>
            
            {/* BOTÕES DE AÇÃO */}
            <div className="flex gap-1">
                <Button 
                    variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-blue-500"
                    onClick={() => {
                        setEditForm({
                            id: order.id,
                            customer: order.customer_name,
                            city: order.city,
                            objective: order.objective,
                            value: order.order_value || ""
                        });
                        setIsEditOpen(true);
                    }}
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button 
                    variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500"
                    onClick={() => { setSelectedOrder(order); setIsDeleteOpen(true); }}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3 pb-3 text-sm space-y-2">
            <div className="flex justify-between items-center">
                <Badge variant="outline" className={`${statusStyles[order.status]} uppercase text-[10px] font-bold`}>
                    {order.status}
                </Badge>
                <div className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(order.order_value)}
                </div>
            </div>

            {order.status === 'enviado' && (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded text-xs grid gap-2 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center border-b pb-1 border-slate-200 dark:border-slate-800">
                        <span className="text-muted-foreground">Envio:</span>
                        <span className="font-medium">{parsed.base || "-"}</span>
                    </div>
                    {parsed.tracking && (
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Rastreio:</span>
                            <div className="flex items-center gap-2 cursor-pointer text-blue-600 hover:underline" onClick={() => openTrackingLink(parsed.tracking)}>
                                <span className="font-mono font-bold">{parsed.tracking}</span>
                                <ExternalLink className="h-3 w-3" />
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" /> NF-e:
                        </span>
                        <span className="font-mono font-bold text-foreground">
                            {order.invoice_number || "S/N"}
                        </span>
                    </div>
                </div>
            )}
        </CardContent>

        <CardFooter className="bg-background border-t py-2 px-4 flex justify-end gap-2">
            {order.status === 'processando' && (
                <Button size="sm" variant="outline" className="h-8 text-xs text-amber-600 border-amber-200 bg-amber-50" onClick={() => updateStatusMutation.mutate({ id: order.id, status: "pronto" })}>
                    <CheckCircle2 className="mr-1.5 h-3 w-3" /> Marcar Pronto
                </Button>
            )}
            {order.status === 'pronto' && (
                <Button className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setSelectedOrder(order); setIsShipOpen(true); }}>
                    <Truck className="mr-1.5 h-3 w-3" /> Enviar
                </Button>
            )}
        </CardFooter>
      </Card>
    );
  };

  const renderGroupedOrders = (groups: Record<string, any[]>) => {
    const keys = Object.keys(groups);
    if (keys.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                <History className="h-12 w-12 opacity-20 mb-4" />
                <p>Nenhum pedido encontrado.</p>
            </div>
        );
    }
    return keys.map((month) => (
        <div key={month} className="mb-8">
            <h3 className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4" /> {month}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups[month].map((order) => (<OrderCard key={order.id} order={order} />))}
            </div>
        </div>
    ));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-foreground">
            <div className="p-2 bg-primary/10 rounded-lg"><ListTodo className="h-6 w-6 text-primary" /></div>
            Pedidos & Logística
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Gerencie envios, valores e notas fiscais.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente, NF..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-sm shrink-0">
                <Plus className="mr-2 h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Criar Novo Pedido</DialogTitle><DialogDescription>Insira os dados do destinatário.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Cliente</Label><Input value={newOrder.customer} onChange={(e) => setNewOrder({ ...newOrder, customer: e.target.value })} placeholder="Ex: João da Silva" /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={newOrder.city} onChange={(e) => setNewOrder({ ...newOrder, city: e.target.value })} placeholder="Ex: São Paulo - SP" /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={newOrder.objective} onValueChange={(v) => setNewOrder({ ...newOrder, objective: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="venda">Venda</SelectItem><SelectItem value="reposicao">Reposição</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" step="0.01" placeholder="0,00" value={newOrder.value} onChange={(e) => setNewOrder({...newOrder, value: e.target.value})} />
                    </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createOrderMutation.mutate(newOrder)} disabled={!newOrder.customer} className="w-full">Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2">
          <Button variant={typeFilter === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter('todos')} className="h-8">Todas</Button>
          <Button variant={typeFilter === 'venda' ? 'secondary' : 'outline'} size="sm" onClick={() => setTypeFilter('venda')} className="h-8">Vendas</Button>
          <Button variant={typeFilter === 'reposicao' ? 'destructive' : 'outline'} size="sm" onClick={() => setTypeFilter('reposicao')} className="h-8">Reposições</Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="active">Em Andamento</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-6">{renderGroupedOrders(activeGroups)}</TabsContent>
        <TabsContent value="history" className="mt-6">{renderGroupedOrders(historyGroups)}</TabsContent>
      </Tabs>

      {/* --- MODAL EDIÇÃO --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Editar Pedido</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Cliente</Label><Input value={editForm.customer} onChange={(e) => setEditForm({ ...editForm, customer: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={editForm.objective} onValueChange={(v) => setEditForm({ ...editForm, objective: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="venda">Venda</SelectItem><SelectItem value="reposicao">Reposição</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Valor (R$)</Label>
                        <Input type="number" step="0.01" value={editForm.value} onChange={(e) => setEditForm({...editForm, value: e.target.value})} />
                    </div>
                </div>
            </div>
            <DialogFooter><Button onClick={() => editOrderMutation.mutate(editForm)} className="w-full">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL EXCLUSÃO --- */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>Excluir Pedido?</DialogTitle><DialogDescription>Essa ação não pode ser desfeita.</DialogDescription></DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => deleteOrderMutation.mutate(selectedOrder?.id)}>Excluir</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL ENVIO (SIMPLIFICADO) --- */}
      <Dialog open={isShipOpen} onOpenChange={setIsShipOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Envio</DialogTitle><DialogDescription>Preencha os dados de envio.</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2"><Label>Número da NF-e</Label><div className="relative"><FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Digite o número da NF-e" value={invoiceKey} onChange={(e) => setInvoiceKey(e.target.value)} className="pl-9" /></div></div>
            <Separator />
            <div className="space-y-2"><Label>Rastreio</Label><Input placeholder="Código de rastreio" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} /></div>
            <div className="space-y-2"><Label>Método</Label><Select value={shipType} onValueChange={setShipType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="correios">Correios</SelectItem><SelectItem value="aviao">Avião</SelectItem><SelectItem value="transportadora">Transportadora</SelectItem><SelectItem value="tecnico">Técnico</SelectItem></SelectContent></Select></div>
            {(shipType === "transportadora" || shipType === "tecnico") && (<div className="space-y-2 animate-in fade-in slide-in-from-top-2"><Label>Detalhes</Label><Input placeholder="Ex: Jadlog" value={shipDetails} onChange={(e) => setShipDetails(e.target.value)} /></div>)}
          </div>
          <DialogFooter><Button onClick={handleShipOrder} className="w-full">Confirmar Envio</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
