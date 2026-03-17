import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { format } from "date-fns";
import { 
  ShieldCheck, Search, Filter, RefreshCw, Calendar, 
  Download, FileSpreadsheet, FileText, Loader2, FileJson
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSocket } from "@/contexts/SocketContext";

// IMPORTA O UTILITÁRIO DE EXPORTAÇÃO
import { exportToExcel, exportToPDF } from "@/utils/exportUtils";

// ============================================================================
// NOVO COMPONENTE: VISUALIZADOR DE DETALHES AVANÇADO
// ============================================================================
const LogDetailsViewer = ({ details }: { details: any }) => {
  let parsed = details;
  let isJson = false;

  // Tenta converter texto para JSON
  if (typeof details === 'string') {
    try {
      parsed = JSON.parse(details);
      isJson = typeof parsed === 'object' && parsed !== null;
    } catch (e) {
      isJson = false;
    }
  } else if (typeof details === 'object' && details !== null) {
    isJson = true;
  }

  // Se for vazio
  if (!details || details === "{}" || details === "[]" || (isJson && Object.keys(parsed).length === 0)) {
    return <span className="text-xs text-muted-foreground italic px-2">Sem detalhes adicionais</span>;
  }

  // Se for apenas um texto normal (não JSON)
  if (!isJson) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50 max-h-[80px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
        {String(parsed)}
      </div>
    );
  }

  const entries = Object.entries(parsed);

  return (
    <div className="flex flex-col gap-2 my-1">
      {/* Resumo Formatado Inline */}
      <div className="bg-muted/30 p-2.5 rounded-lg border border-border/50 max-h-[120px] overflow-y-auto custom-scrollbar flex flex-col gap-1.5 shadow-sm">
        {entries.map(([key, val]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:gap-3 text-[11px] leading-relaxed border-b border-border/40 last:border-0 pb-1.5 last:pb-0">
            <span className="font-bold text-foreground/70 uppercase tracking-wider text-[9px] mt-0.5 sm:w-[110px] shrink-0">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-muted-foreground font-mono break-all">
              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
      </div>
      
      {/* Botão e Modal para ver o JSON Cru Profundo */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-primary w-fit px-3 self-start bg-primary/5 hover:bg-primary/15 border border-primary/10 shadow-sm transition-all hover:scale-105">
            <FileJson className="w-3.5 h-3.5 mr-1.5" />
            Ver JSON Completo
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileJson className="w-5 h-5 text-primary" />
              Detalhes Técnicos da Auditoria
            </DialogTitle>
          </DialogHeader>
          <div className="bg-[#0d1117] p-5 rounded-xl border border-border/50 mt-2 max-h-[65vh] overflow-y-auto custom-scrollbar shadow-inner relative group">
            <div className="absolute top-2 right-4 text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest opacity-50">Payload.json</div>
            <pre className="text-xs font-mono text-[#a5d6ff] whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


// ============================================================================
// TELA PRINCIPAL DE LOGS
// ============================================================================
export default function AuditLogs() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  // --- ESTADOS DE FILTRO ---
  const [actionFilter, setActionFilter] = useState("ALL");
  const [userSearch, setUserSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // 1. BUSCAR LOGS
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter, userSearch, dateStart, dateEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (actionFilter !== "ALL") params.append("action", actionFilter);
      if (userSearch) params.append("user", userSearch);
      if (dateStart) params.append("startDate", dateStart);
      if (dateEnd) params.append("endDate", dateEnd);

      const response = await api.get(`/admin/logs?${params.toString()}`);
      return response.data;
    },
  });

  // 2. ATUALIZAÇÃO EM TEMPO REAL
  useEffect(() => {
    if (socket) {
      socket.on('new_audit_log', (newLog: any) => {
        // Recarrega os logs para garantir que os filtros se mantêm consistentes
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
        
        toast("Novo evento de auditoria registrado", {
            description: `${newLog.user_name} - ${newLog.action}`,
            duration: 3000,
        });
      });

      return () => {
        socket.off('new_audit_log');
      };
    }
  }, [socket, queryClient]);

  // 3. FUNÇÃO DE EXPORTAÇÃO
  const handleExport = (type: 'pdf' | 'excel') => {
    if (!logs || logs.length === 0) {
        toast.error("Sem dados para exportar.");
        return;
    }

    // Formata os dados
    const exportData = logs.map((log: any) => {
        // Formata o JSON de detalhes para string legível
        let detailsString = "-";
        try {
            if (typeof log.details === 'object' && log.details !== null) {
                detailsString = JSON.stringify(log.details).substring(0, 500); // Limita tamanho
            } else if (log.details) {
                detailsString = String(log.details);
            }
        } catch (e) { detailsString = "Erro ao ler detalhes"; }

        return {
            ID: log.id,
            Data: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
            Usuário: log.user_name || "Desconhecido",
            Cargo: log.user_role || "-",
            Ação: log.action,
            IP: log.ip_address || "-",
            Detalhes: detailsString
        };
    });

    if (type === 'excel') {
        exportToExcel(exportData, "Relatorio_Auditoria");
        toast.success("Excel baixado!");
    } else {
        const columns = [
            { header: "Data", dataKey: "Data" },
            { header: "Usuário", dataKey: "Usuário" },
            { header: "Cargo", dataKey: "Cargo" },
            { header: "Ação", dataKey: "Ação" },
            { header: "Detalhes", dataKey: "Detalhes" }, // Cuidado com PDF, detalhes longos quebram layout
        ];
        exportToPDF("Relatório de Auditoria e Segurança", columns, exportData, "Auditoria_PDF");
        toast.success("PDF gerado!");
    }
  };

  // Cores das ações (Atualizado para cobrir a Elétrica de forma inteligente)
  const getActionColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("LOGIN")) return "bg-blue-100 text-blue-700 border-blue-200";
    if (act.includes("DELETE")) return "bg-red-100 text-red-700 border-red-200";
    if (act.includes("UPDATE") || act.includes("MOVE") || act.includes("UNCHECKED")) return "bg-amber-100 text-amber-700 border-amber-200";
    if (act.includes("CREATE") || act.includes("COMPLETED") || act.includes("ASSIGNED")) return "bg-green-100 text-green-700 border-green-200";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Monitoramento de segurança e ações do sistema.
            {isConnected ? (
                <span className="flex items-center text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full shadow-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Ao Vivo
                </span>
            ) : (
                <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded-full shadow-sm">Offline</span>
            )}
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading} className="shadow-sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
            </Button>

            {/* BOTÃO EXPORTAR */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="gap-2 shadow-sm">
                  <Download className="h-4 w-4" /> Exportar Logs
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleExport('excel')} className="gap-2 cursor-pointer py-2.5">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2 cursor-pointer py-2.5">
                  <FileText className="h-4 w-4 text-red-600" /> Relatório PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* FILTROS */}
      <Card className="shadow-md border-border/60">
        <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Buscar Usuário</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Nome ou Email..." 
                            className="pl-10 h-10 shadow-sm"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Tipo de Ação</label>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="h-10 shadow-sm">
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas as Ações</SelectItem>
                            <SelectItem value="LOGIN">Login</SelectItem>
                            
                            {/* --- FILTROS DA ELÉTRICA --- */}
                            <SelectItem value="CREATE_TASK_ELETRICA">Criar Tarefa (Elétrica)</SelectItem>
                            <SelectItem value="UPDATE_TASK_ELETRICA">Editar Tarefa (Elétrica)</SelectItem>
                            <SelectItem value="MOVE_TASK_ELETRICA">Mover Tarefa (Elétrica)</SelectItem>
                            <SelectItem value="DELETE_TASK_ELETRICA">Excluir Tarefa (Elétrica)</SelectItem>
                            <SelectItem value="CREATE_LIST_ELETRICA">Criar Lista (Elétrica)</SelectItem>
                            <SelectItem value="UPDATE_LIST_ELETRICA">Editar Lista (Elétrica)</SelectItem>
                            <SelectItem value="DELETE_LIST_ELETRICA">Excluir Lista (Elétrica)</SelectItem>
                            <SelectItem value="CHECKLIST_COMPLETED">Item Concluído (Elétrica)</SelectItem>
                            <SelectItem value="CHECKLIST_UNCHECKED">Item Desmarcado (Elétrica)</SelectItem>
                            <SelectItem value="CARD_COMPLETED">Cartão Concluído (Elétrica)</SelectItem>
                            <SelectItem value="CARD_REOPENED">Cartão Reaberto (Elétrica)</SelectItem>
                            <SelectItem value="TECHNICIAN_ASSIGNED">Técnico Atribuído (Elétrica)</SelectItem>
                            <SelectItem value="UPDATE_MEMBERS_ELETRICA">Membros Editados (Elétrica)</SelectItem>

                            {/* --- FILTROS DO ESTOQUE / ADMIN --- */}
                            <SelectItem value="CREATE_PRODUCT">Criar Produto</SelectItem>
                            <SelectItem value="UPDATE_PRODUCT">Editar Produto</SelectItem>
                            <SelectItem value="UPDATE_STOCK">Ajuste de Estoque</SelectItem>
                            <SelectItem value="DELETE_PRODUCT">Excluir Produto</SelectItem>
                            <SelectItem value="UPDATE_PERMISSIONS">Permissões</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Data Inicial</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="date" 
                            className="pl-10 h-10 shadow-sm"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider text-[11px]">Data Final</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="date" 
                            className="pl-10 h-10 shadow-sm"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* TABELA DE LOGS */}
      <div className="border rounded-2xl bg-card shadow-lg overflow-hidden">
        <Table>
            <TableHeader className="bg-muted/60 border-b border-border/50">
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[150px] font-bold text-foreground">Data / Hora</TableHead>
                    <TableHead className="font-bold text-foreground w-[200px]">Usuário</TableHead>
                    <TableHead className="font-bold text-foreground w-[120px]">Cargo</TableHead>
                    <TableHead className="font-bold text-foreground w-[200px]">Ação</TableHead>
                    <TableHead className="font-bold text-foreground">Detalhes do Evento</TableHead>
                    <TableHead className="text-right font-bold text-foreground w-[120px]">Endereço IP</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                            <div className="flex justify-center items-center gap-3 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="font-medium text-sm">A carregar registos de segurança...</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : logs?.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center">
                                <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                <span className="font-medium text-sm">Nenhum registo encontrado com estes filtros.</span>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : (
                    logs?.map((log: any) => (
                        <TableRow key={log.id} className="hover:bg-muted/30 transition-colors group">
                            <TableCell className="font-mono text-[11px] align-top pt-4">
                                <span className="font-bold text-foreground">{format(new Date(log.created_at), "dd/MM/yyyy")}</span>
                                <br />
                                <span className="text-muted-foreground">{format(new Date(log.created_at), "HH:mm:ss")}</span>
                            </TableCell>
                            <TableCell className="align-top pt-4">
                                <div className="font-bold text-foreground text-sm flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                                    {log.user_name?.substring(0, 2).toUpperCase() || 'U'}
                                  </div>
                                  {log.user_name}
                                </div>
                            </TableCell>
                            <TableCell className="align-top pt-4">
                                <Badge variant="secondary" className="capitalize text-[10px] font-bold tracking-wider">
                                    {log.user_role?.replace('_', ' ')}
                                </Badge>
                            </TableCell>
                            <TableCell className="align-top pt-4">
                                <Badge variant="outline" className={`font-mono text-[10px] font-extrabold tracking-wider ${getActionColor(log.action)}`}>
                                    {log.action}
                                </Badge>
                            </TableCell>
                            <TableCell className="align-top max-w-[450px] py-2">
                                {/* NOVO VISUALIZADOR DE DETALHES */}
                                <LogDetailsViewer details={log.details} />
                            </TableCell>
                            <TableCell className="text-right text-[11px] font-mono text-muted-foreground align-top pt-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                {log.ip_address}
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
      </div>
    </div>
  );
}
