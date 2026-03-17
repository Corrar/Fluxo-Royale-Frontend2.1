import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Componentes UI (shadcn)
// CORREÇÃO 1: Adicionado TabsContent na importação
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// Ícones
import { 
  Plus, DollarSign, Package, AlertTriangle,
  Warehouse, Factory, Workflow, Waves, Zap, LayoutDashboard,
  Timer, Gauge as GaugeIcon, Play, Pause,
  Check, ArrowDownToLine, ArrowUpFromLine, RotateCw, Shield, CheckCircle2,
  GripVertical, Activity
} from "lucide-react";

// ============================================================================
// 0. CONFIGURAÇÕES DE ANIMAÇÃO E ESTILO
// ============================================================================

// CORREÇÃO 2: Adicionado 'as const' para garantir tipagem correta do 'ease'
const ANIMATION_CONFIG = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3, ease: "easeOut" }
} as const;

const CARD_HOVER = {
  y: -4,
  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
};

// ============================================================================
// 1. COMPONENTES UTILITÁRIOS
// ============================================================================

// Formatação de Moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Gráfico de Rosca (Donut) Moderno
function DonutChart({ value, color = "hsl(var(--primary))" }: { value: number, color?: string }) {
  const data = [
    { name: "done", value: Math.max(0, value) },
    { name: "remaining", value: Math.max(0, 100 - value) },
  ];
  return (
    <div className="h-[100px] w-[100px] relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
            <Pie 
              data={data} 
              cx="50%" 
              cy="50%" 
              innerRadius={38} 
              outerRadius={48} 
              dataKey="value" 
              startAngle={90} 
              endAngle={-270} 
              strokeWidth={0}
              cornerRadius={10}
              paddingAngle={5}
            >
            <Cell fill={color} />
            <Cell fill="hsl(var(--muted))" />
            </Pie>
        </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <span className="text-sm font-bold text-foreground">{value}%</span>
        </div>
    </div>
  );
}

// Card de Setor Genérico (Estilo Nubank)
export function SectorCard({ title, value, subtitle, icon: Icon, progress, className }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={CARD_HOVER}
      className={cn("bg-card/50 backdrop-blur-sm rounded-3xl p-6 border border-border/50 shadow-sm cursor-default transition-colors hover:bg-card", className)}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-black text-foreground tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
            <span>Progresso</span>
            <span>{progress}%</span>
        </div>
        <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
            <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-primary rounded-full"
            />
        </div>
      </div>
    </motion.div>
  );
}

// Gauge Component (Manômetro Minimalista)
function GaugeComponent({ value, max, label, unit = "", size = 100, color }: any) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference - percentage * circumference;

  const getColor = () => {
    if (color) return color;
    if (percentage > 0.8) return "hsl(var(--destructive))";
    if (percentage > 0.6) return "hsl(var(--primary))";
    return "hsl(var(--primary))";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 drop-shadow-md">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted)/0.3)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={getColor()} strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground">{value}</span>
          <span className="text-[10px] text-muted-foreground font-medium">{unit}</span>
        </div>
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

// Barra de Progresso Customizada (Suave)
function CustomProgressBar({ value, className, showLabel = false, size = "md", variant = "primary" }: any) {
  const clamped = Math.min(100, Math.max(0, value));
  const sizeClasses: any = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
  const variantClasses: any = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    accent: "bg-blue-600",
  };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progresso Total</span>
          <span className="text-xs font-bold text-foreground bg-background px-2 py-0.5 rounded-md border shadow-sm">{clamped}%</span>
        </div>
      )}
      <div className={cn("w-full bg-secondary/50 rounded-full overflow-hidden shadow-inner", sizeClasses[size])}>
        <motion.div
          className={cn("h-full rounded-full shadow-sm", variantClasses[variant])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: "circOut" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 2. DASHBOARDS ESPECÍFICOS POR SETOR
// ============================================================================

// --- ALMOXARIFADO (Operacional Clean) ---
const WarehouseBoard = () => {
  const [requisicoes, setRequisicoes] = useState([
    { id: 1, item: "Parafusos M6", setor: "Esteira", status: "pendente", quantidade: 200 },
    { id: 2, item: "Óleo Lubrificante", setor: "Lavadora", status: "aprovada", quantidade: 10 },
    { id: 3, item: "Fita Isolante", setor: "Elétrica", status: "entregue", quantidade: 50 },
    { id: 4, item: "Rolamentos", setor: "Esteira", status: "pendente", quantidade: 8 },
    { id: 5, item: "Detergente Industrial", setor: "Lavadora", status: "pendente", quantidade: 25 },
  ]);

  const [estoque, setEstoque] = useState([
    { id: 1, item: "Parafusos M6", atual: 150, minimo: 200 },
    { id: 2, item: "Óleo Lubrificante", atual: 45, minimo: 20 },
    { id: 3, item: "Fita Isolante", atual: 12, minimo: 30 },
    { id: 4, item: "Rolamentos", atual: 100, minimo: 50 },
    { id: 5, item: "Detergente Industrial", atual: 8, minimo: 15 },
  ]);

  const statusColors: Record<string, string> = {
    pendente: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
    aprovada: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
    entregue: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800",
  };

  const advanceStatus = (id: number) => {
    setRequisicoes((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (r.status === "pendente") return { ...r, status: "aprovada" };
        if (r.status === "aprovada") return { ...r, status: "entregue" };
        return r;
      })
    );
    toast.success("Status atualizado!");
  };

  const updateStock = (id: number, amount: number) => {
    setEstoque(prev => prev.map(item => {
        if (item.id !== id) return item;
        const newTotal = Math.max(0, item.atual + amount);
        return { ...item, atual: newTotal };
    }));
    toast.success(amount > 0 ? "Entrada registrada" : "Saída registrada");
  };

  const completedCount = requisicoes.filter((r) => r.status === "entregue").length;
  const progress = requisicoes.length ? Math.round((completedCount / requisicoes.length) * 100) : 0;

  return (
    <motion.div {...ANIMATION_CONFIG} className="space-y-8">
      <CustomProgressBar value={progress} showLabel size="lg" variant="primary" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card de Requisições */}
        <Card className="rounded-[2rem] border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl"><Package className="w-5 h-5 text-primary" /></div>
                    <div>
                        <CardTitle className="text-lg">Requisições</CardTitle>
                        <CardDescription>Pedidos de insumos internos</CardDescription>
                    </div>
                </div>
                <Button size="sm" className="rounded-full h-8" onClick={() => toast.info("Nova Requisição")}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Nova
                </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-2">
                    <AnimatePresence>
                        {requisicoes.map((r) => (
                        <motion.div 
                            key={r.id} 
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between p-4 rounded-2xl bg-card hover:bg-muted/50 transition-colors border border-border/50 group"
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{r.item}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px] font-normal rounded-md h-5 px-1.5">{r.setor}</Badge>
                                    <span className="text-xs text-muted-foreground">Qtd: <span className="font-bold text-foreground">{r.quantidade}</span></span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge className={cn("text-[10px] uppercase tracking-wider font-bold rounded-lg px-2.5 py-1", statusColors[r.status])}>
                                    {r.status}
                                </Badge>
                                {r.status !== "entregue" && (
                                    <Button size="icon" variant="ghost" onClick={() => advanceStatus(r.id)} className="h-8 w-8 rounded-full hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors">
                                        <Check className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Card de Estoque */}
        <Card className="rounded-[2rem] border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
                    <div>
                        <CardTitle className="text-lg">Nível de Estoque</CardTitle>
                        <CardDescription>Itens críticos e movimentação</CardDescription>
                    </div>
                </div>
                <Button size="sm" variant="outline" className="rounded-full h-8" onClick={() => toast.info("Novo Item")}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Item
                </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
                <div className="p-4 space-y-2">
                    {estoque.map((e) => {
                    const critico = e.atual < e.minimo;
                    return (
                        <motion.div 
                            key={e.id} 
                            layout
                            className={cn(
                                "flex items-center justify-between p-4 rounded-2xl transition-all border", 
                                critico ? "bg-red-500/5 border-red-500/20" : "bg-card border-border/50 hover:border-primary/20"
                            )}
                        >
                            <div className="flex-1 min-w-0 mr-6">
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-semibold text-foreground">{e.item}</span>
                                    <span className={cn("text-xs font-bold", critico ? "text-red-500" : "text-muted-foreground")}>
                                        {e.atual} <span className="text-muted-foreground/50 font-normal">/ {e.minimo}</span>
                                    </span>
                                </div>
                                <CustomProgressBar value={Math.min((e.atual / e.minimo) * 100, 100)} size="sm" variant={critico ? "warning" : "success"} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Button size="sm" variant="ghost" onClick={() => updateStock(e.id, 10)} className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10">
                                    <ArrowDownToLine className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateStock(e.id, -10)} className="h-7 w-7 p-0 rounded-lg text-red-600 hover:bg-red-500/10">
                                    <ArrowUpFromLine className="w-4 h-4" />
                                </Button>
                            </div>
                        </motion.div>
                    );
                    })}
                </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// --- ESTEIRA (Visualização Tech) ---
const EsteiraBoard = () => {
  const [steps, setSteps] = useState([
    { id: 1, label: "Corte", progress: 100, status: "concluido" },
    { id: 2, label: "Dobra", progress: 100, status: "concluido" },
    { id: 3, label: "Soldagem", progress: 78, status: "em_andamento" },
    { id: 4, label: "Montagem", progress: 0, status: "pendente" },
    { id: 5, label: "Acabamento", progress: 0, status: "pendente" },
    { id: 6, label: "Inspeção", progress: 0, status: "pendente" },
  ]);
  const [running, setRunning] = useState(true);

  const advanceStep = (id: number) => {
    setSteps((prev) => prev.map((s) => {
        if (s.id !== id) return s;
        const newProgress = Math.min(s.progress + 25, 100);
        return { ...s, progress: newProgress, status: newProgress === 100 ? "concluido" : "em_andamento" };
    }));
  };

  const totalProgress = Math.round(steps.reduce((a, s) => a + s.progress, 0) / steps.length);

  return (
    <motion.div {...ANIMATION_CONFIG} className="space-y-8">
      <CustomProgressBar value={totalProgress} showLabel size="lg" />
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <motion.div whileHover={CARD_HOVER} className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-1"><GaugeIcon className="w-7 h-7 text-primary" /></div>
          <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Peças/Hora</p><p className="text-4xl font-black text-foreground mt-1">142</p></div>
        </motion.div>
        
        <motion.div whileHover={CARD_HOVER} className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-1"><Timer className="w-7 h-7 text-amber-600" /></div>
          <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tempo Estimado</p><p className="text-4xl font-black text-foreground mt-1">2h 15m</p></div>
        </motion.div>
        
        <motion.div whileHover={CARD_HOVER} className="bg-card rounded-[2rem] p-6 border shadow-sm flex flex-col items-center justify-center gap-4">
          <Button 
            variant={running ? "destructive" : "default"} 
            size="lg" 
            onClick={() => setRunning(!running)} 
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg transition-all active:scale-95"
          >
            {running ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />} 
            {running ? "Pausar Linha" : "Iniciar Linha"}
          </Button>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
             <Activity className={cn("w-4 h-4", running ? "text-emerald-500 animate-pulse" : "text-muted-foreground")} />
             Status: {running ? "Operando" : "Parado"}
          </div>
        </motion.div>
      </div>

      <div className="bg-card rounded-[2.5rem] p-8 border shadow-sm overflow-hidden">
        <h3 className="text-lg font-bold text-foreground mb-8 flex items-center gap-2"><Workflow className="w-5 h-5 text-primary"/> Timeline de Produção</h3>
        <div className="relative">
          {/* Linha Conectora */}
          <div className="absolute top-6 left-0 right-0 h-1 bg-muted rounded-full overflow-hidden">
             <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${totalProgress}%` }} transition={{ duration: 1.5 }} />
          </div>
          
          <div className="flex justify-between relative overflow-x-auto pb-4 gap-4 px-2">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center gap-3 relative z-10 min-w-[100px] group">
                <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => advanceStep(step.id)} 
                    className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-bold transition-all duration-300 cursor-pointer shadow-lg border-4 border-card",
                        step.status === "concluido" && "bg-emerald-500 text-white shadow-emerald-500/30",
                        step.status === "em_andamento" && "bg-primary text-primary-foreground shadow-primary/30 ring-4 ring-primary/10",
                        step.status === "pendente" && "bg-muted text-muted-foreground",
                    )}
                >
                  {step.progress === 100 ? <Check className="w-5 h-5"/> : `${step.progress}%`}
                </motion.button>
                <span className={cn(
                    "text-xs font-bold uppercase tracking-wider text-center transition-colors",
                    step.status !== "pendente" ? "text-foreground" : "text-muted-foreground"
                )}>
                    {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- FLOW (Kanban Real com Drag-and-Drop) ---
type FlowColumn = "todo" | "doing" | "done";
const FlowBoard = () => {
  const [cards, setCards] = useState<Record<FlowColumn, any[]>>({
    todo: [
        { id: 1, title: "Preparar moldes", priority: "alta", progress: 0, assignee: "Carlos" },
        { id: 2, title: "Revisar especificações", priority: "media", progress: 10, assignee: "Ana" }
    ],
    doing: [
        { id: 3, title: "Montagem lote #42", priority: "alta", progress: 60, assignee: "Pedro" },
        { id: 4, title: "Teste de qualidade", priority: "baixa", progress: 35, assignee: "Maria" }
    ],
    done: [
        { id: 5, title: "Calibração", priority: "media", progress: 100, assignee: "João" }
    ],
  });

  const [dragging, setDragging] = useState<{ card: any; from: FlowColumn } | null>(null);

  const moveCard = (cardId: number, from: FlowColumn, to: FlowColumn) => {
    if (from === to) return;
    const card = cards[from].find((c) => c.id === cardId);
    if (!card) return;
    const updated = { ...card };
    
    // Atualiza progresso baseado na coluna
    if (to === "done") updated.progress = 100;
    if (to === "doing" && updated.progress === Math.max(25, updated.progress)) updated.progress = updated.progress === 0 ? 25 : updated.progress;
    if (to === "todo") updated.progress = 0;

    setCards((prev) => ({
      ...prev,
      [from]: prev[from].filter((c) => c.id !== cardId),
      [to]: [...prev[to], updated],
    }));
  };

  const priorityColors: any = {
    alta: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/30",
    media: "bg-amber-500/15 text-amber-600 border-amber-200 dark:border-amber-900/30",
    baixa: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900/30",
  };

  const columns: { id: FlowColumn; label: string; color: string; bg: string }[] = [
      { id: 'todo', label: 'A Fazer', color: 'border-l-muted-foreground', bg: "bg-muted/10" },
      { id: 'doing', label: 'Em Progresso', color: 'border-l-primary', bg: "bg-primary/5" },
      { id: 'done', label: 'Concluído', color: 'border-l-emerald-500', bg: "bg-emerald-500/5" }
  ];

  return (
    <motion.div {...ANIMATION_CONFIG} className="space-y-6 h-full">
      <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Fluxo de Tarefas</h2>
          <Button size="sm" className="rounded-full px-6" onClick={() => toast.info("Em breve: Criar Card")}>
            <Plus className="w-4 h-4 mr-2"/> Novo Card
          </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-320px)] min-h-[500px]">
        {columns.map((col) => (
          <div 
            key={col.id} 
            className={cn(
                "rounded-[1.5rem] p-4 flex flex-col gap-4 border transition-all duration-300", 
                col.bg,
                dragging ? "border-dashed border-primary/50" : "border-transparent",
                "hover:border-border/50"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragging) { moveCard(dragging.card.id, dragging.from, col.id); setDragging(null); } }}
          >
            <div className={cn("flex items-center justify-between mb-2 pl-3 border-l-4", col.color)}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{col.label}</h3>
                <Badge variant="secondary" className="bg-background/80 backdrop-blur font-mono">{cards[col.id]?.length || 0}</Badge>
            </div>
            
            <ScrollArea className="flex-1 pr-2 -mr-2">
                <div className="space-y-3 pb-4">
                    <AnimatePresence>
                        {cards[col.id]?.map((card: any) => (
                            <motion.div 
                                layout
                                layoutId={`card-${card.id}`}
                                key={card.id} 
                                draggable
                                onDragStart={() => setDragging({ card, from: col.id })}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-card rounded-2xl p-5 border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-lg hover:-translate-y-1 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-sm font-bold leading-tight">{card.title}</span>
                                    <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                
                                <div className="flex justify-between items-center mb-4">
                                    <span className={cn("text-[10px] uppercase font-bold px-2 py-1 rounded-md border", priorityColors[card.priority])}>
                                        {card.priority}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                            {card.assignee.charAt(0)}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                                        <span>Conclusão</span>
                                        <span>{card.progress}%</span>
                                    </div>
                                    <CustomProgressBar value={card.progress} size="sm" variant={card.progress === 100 ? "success" : "primary"} />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- LAVADORA ---
const LavadoraBoard = () => {
  const [cycles, setCycles] = useState([
    { id: 1, label: "Lavadora 01", phase: "Enxágue", progress: 85, temp: 72, chemical: 45 },
    { id: 2, label: "Lavadora 02", phase: "Lavagem", progress: 42, temp: 88, chemical: 78 },
    { id: 3, label: "Lavadora 03", phase: "Centrifugação", progress: 95, temp: 35, chemical: 12 },
  ]);

  const advanceCycle = (id: number) => {
    setCycles((prev) => prev.map((c) => c.id === id ? { ...c, progress: Math.min(c.progress + 10, 100) } : c));
  };

  return (
    <motion.div {...ANIMATION_CONFIG} className="space-y-8">
      <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Monitoramento de Ciclos</h2>
          <Button size="sm" className="rounded-full px-6" onClick={() => toast.info("Adicionar Ciclo")}><Plus className="w-4 h-4 mr-2"/> Novo Ciclo</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {cycles.map((cycle) => (
          <motion.div 
            whileHover={CARD_HOVER}
            key={cycle.id} 
            className="bg-card rounded-[2rem] p-6 border shadow-sm space-y-6 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{cycle.label}</h3>
              <span className="text-xs text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-full uppercase tracking-wider">{cycle.phase}</span>
            </div>
            
            <CustomProgressBar value={cycle.progress} showLabel variant={cycle.progress >= 90 ? "success" : "primary"} />
            
            <div className="flex justify-around py-2 gap-4">
              <div className="flex-1 bg-muted/20 rounded-2xl py-4 border border-border/50">
                 <GaugeComponent value={cycle.temp} max={100} label="Temperatura" unit="°C" size={70} />
              </div>
              <div className="flex-1 bg-muted/20 rounded-2xl py-4 border border-border/50">
                 <GaugeComponent value={cycle.chemical} max={100} label="Químico" unit="%" size={70} />
              </div>
            </div>
            
            <Button size="lg" variant="outline" className="w-full gap-2 rounded-xl h-12 font-bold hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => advanceCycle(cycle.id)}>
              <RotateCw className="w-4 h-4" /> Avançar Etapa
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// --- ELÉTRICA ---
const EletricaBoard = () => {
  const [sections, setSections] = useState([
    {
      id: "s1", title: "Fiação e Cabos", items: [
        { id: "1", label: "Verificar isolamento dos cabos", checked: true },
        { id: "2", label: "Testar continuidade", checked: true },
        { id: "3", label: "Inspecionar conexões", checked: false },
      ],
    },
    {
      id: "s2", title: "Painéis Elétricos", items: [
        { id: "5", label: "Verificar disjuntores", checked: true },
        { id: "6", label: "Limpar contatos", checked: false },
      ],
    },
  ]);

  const toggleItem = (sectionId: string, itemId: string) => {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, items: s.items.map((i) => i.id === itemId ? { ...i, checked: !i.checked } : i) } : s));
  };

  return (
    <motion.div {...ANIMATION_CONFIG} className="space-y-8">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center"><Shield className="w-6 h-6 text-primary" /></div>
                <div><p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Checklist Técnico</p><h2 className="text-xl font-black">Conformidade Elétrica</h2></div>
            </div>
            <Button size="sm" className="rounded-full px-6" onClick={() => toast.info("Nova Seção")}><Plus className="w-4 h-4 mr-2"/> Seção</Button>
        </div>

        <div className="bg-card rounded-[2.5rem] p-8 border shadow-sm">
            <Accordion type="multiple" defaultValue={sections.map((s) => s.id)} className="space-y-4">
            {sections.map((section) => {
                const checkedCount = section.items.filter(i => i.checked).length;
                const sProgress = section.items.length ? Math.round((checkedCount / section.items.length) * 100) : 0;
                return (
                <AccordionItem key={section.id} value={section.id} className="border border-border/50 rounded-2xl px-6 bg-muted/10 data-[state=open]:bg-muted/30 transition-colors">
                    <AccordionTrigger className="hover:no-underline py-5">
                    <div className="flex items-center gap-4 flex-1 mr-4">
                        <span className="text-base font-bold text-foreground">{section.title}</span>
                        <div className="ml-auto flex items-center gap-3">
                            <span className={cn("text-[10px] font-bold px-2 py-1 rounded-md border", sProgress === 100 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20")}>
                            {sProgress}% CONCLUÍDO
                            </span>
                            {sProgress === 100 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        </div>
                    </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pt-1">
                    <div className="space-y-3">
                        {section.items.map((item) => (
                        <motion.div 
                            whileTap={{ scale: 0.98 }}
                            key={item.id} 
                            className={cn(
                                "flex items-center gap-4 p-4 rounded-xl transition-all cursor-pointer border", 
                                item.checked ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border/50 hover:border-primary/30"
                            )} 
                            onClick={() => toggleItem(section.id, item.id)}
                        >
                            <Checkbox checked={item.checked} className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 w-5 h-5" />
                            <span className={cn("text-sm font-medium flex-1", item.checked ? "text-muted-foreground line-through decoration-emerald-500/30" : "text-foreground")}>{item.label}</span>
                        </motion.div>
                        ))}
                    </div>
                    </AccordionContent>
                </AccordionItem>
                );
            })}
            </Accordion>
        </div>
    </motion.div>
  );
}

// ============================================================================
// 3. DASHBOARD GERAL (VISÃO CONSOLIDADA)
// ============================================================================
const GeneralDashboard = () => {
    const sectors = [
        { title: "Almoxarifado", value: "82%", subtitle: "Requisições", icon: Warehouse, progress: 82 },
        { title: "Produção", value: "78%", subtitle: "Lote atual", icon: Factory, progress: 78 },
        { title: "Flow", value: "65%", subtitle: "Projetos", icon: Workflow, progress: 65 },
        { title: "Lavadora", value: "91%", subtitle: "Ciclos", icon: Waves, progress: 91 },
        { title: "Elétrica", value: "73%", subtitle: "Conformidade", icon: Zap, progress: 73 },
    ];
    const avgProgress = Math.round(sectors.reduce((a, s) => a + s.progress, 0) / sectors.length);

    return (
        <motion.div {...ANIMATION_CONFIG} className="space-y-8">
            <motion.div whileHover={{ scale: 1.01 }} className="bg-card border border-border/50 rounded-[2.5rem] p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                
                <DonutChart value={avgProgress} />
                <div className="text-center md:text-left z-10">
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Visão Global da Fábrica</p>
                    <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">{avgProgress}% <span className="text-lg font-medium text-muted-foreground">de Eficiência</span></h1>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">Média ponderada baseada no desempenho em tempo real de todos os departamentos operacionais.</p>
                </div>
                <div className="ml-auto flex gap-3">
                    <Button className="rounded-full px-6 h-12 font-bold shadow-lg shadow-primary/20">Gerar Relatório</Button>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {sectors.map((s, i) => (
                    <motion.div
                        key={s.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <SectorCard {...s} />
                    </motion.div>
                ))}
            </div>

            <div className="bg-card border border-border/50 rounded-[2.5rem] p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-8 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><LayoutDashboard className="h-5 w-5 text-primary" /></div>
                    Performance Detalhada
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-10">
                    {sectors.map((s) => (
                        <div key={s.title} className="flex flex-col items-center gap-4 group cursor-default">
                            <div className="transform transition-transform group-hover:scale-110 duration-500 ease-out">
                                <DonutChart value={s.progress} color={s.progress > 80 ? "hsl(var(--emerald-500))" : undefined} />
                            </div>
                            <div className="text-center">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1 group-hover:text-primary transition-colors">{s.title}</span>
                                <div className="h-1 w-8 bg-muted rounded-full mx-auto overflow-hidden group-hover:w-12 transition-all">
                                    <div className="h-full bg-primary" style={{ width: `${s.progress}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// ============================================================================
// 4. PÁGINA PRINCIPAL
// ============================================================================
export default function ManagementBoard() {
  const { profile } = useAuth();
  
  const sectors = ["visao_geral", "almoxarife", "producao", "flow", "lavadora", "eletrica"];
  const defaultTab = profile?.role === 'admin' ? "visao_geral" : (sectors.includes(profile?.role || "") ? profile?.role : "visao_geral");

  // Renderizador de Conteúdo por Aba
  const renderContent = (sector: string) => {
      switch(sector) {
          case "visao_geral": return <GeneralDashboard />;
          case "almoxarife": return <WarehouseBoard />; 
          case "producao": return <EsteiraBoard />; 
          case "flow": return <FlowBoard />; 
          case "lavadora": return <LavadoraBoard />;
          case "eletrica": return <EletricaBoard />;
          default: return <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-3xl">Painel em desenvolvimento</div>;
      }
  };

  return (
    <div className="min-h-screen bg-background/50 text-foreground flex flex-col">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
          <div className="container py-6">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Quadro de Gestão
            </h1>
            <p className="text-muted-foreground font-medium">Controle operacional unificado.</p>
          </div>
      </div>

      <div className="flex-1 container py-8">
        <Tabs defaultValue={defaultTab as string} className="space-y-8">
          <ScrollArea className="w-full pb-2">
              <TabsList className="w-full justify-start h-auto p-1.5 bg-muted/30 backdrop-blur border border-border/50 rounded-2xl gap-2 inline-flex min-w-max">
                {sectors.map((sector) => (
                  <TabsTrigger 
                    key={sector} 
                    value={sector} 
                    className="capitalize px-6 py-2.5 rounded-xl text-sm font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md hover:bg-background/50"
                  >
                    {sector.replace('_', ' ')}
                  </TabsTrigger>
                ))}
              </TabsList>
          </ScrollArea>

          <AnimatePresence mode="wait">
            {sectors.map((sector) => (
                <TabsContent key={sector} value={sector} className="m-0 min-h-[500px] outline-none">
                    {renderContent(sector)}
                </TabsContent>
            ))}
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}
