import { useAuth } from "@/contexts/AuthContext";
// Importamos TODOS os ícones do Lucide para permitir a injeção dinâmica vinda do Banco de Dados
import * as LucideIcons from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { api } from "@/services/api"; 

// --- COMPONENTE EDUCATIVO: RENDERIZADOR DINÂMICO DE ÍCONES ---
const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.Info;
  return <IconComponent className={className} />;
};

export default function Home() {
  const { profile } = useAuth();
  const [greeting, setGreeting] = useState("");
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [currentHighlight, setCurrentHighlight] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [homeData, setHomeData] = useState({
    stats: { patrimonio: 0, ativos: 0, criticos: 0, obsoletos: 0 },
    highlights: [] as any[],
    activities: [] as any[]
  });

  const [notifications, setNotifications] = useState([
    { id: 1, title: "Alerta: Estoque Obsoleto", desc: "3 itens sem movimentação há +90 dias.", time: "Agora", type: "alert", read: false },
    { id: 2, title: "Pedido #492 Aprovado", desc: "Material liberado para retirada.", time: "10 min", type: "success", read: false },
    { id: 3, title: "Estoque Crítico", desc: "Cola PVC atingiu nível mínimo.", time: "45 min", type: "error", read: false }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);

  useEffect(() => {
    const fetchDados = async () => {
      try {
        setIsLoading(true);
        // ✨ O nosso Service Worker vai intercetar isto e devolver a cache se falhar a net!
        const response = await api.get('/dashboard/home'); 
        setHomeData(response.data);
      } catch (error) {
        console.error("Erro ao carregar os dados reais da Home:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDados();
  }, []);

  useEffect(() => {
    if (homeData.highlights.length === 0) return;
    const timer = setInterval(() => setCurrentHighlight((prev) => (prev + 1) % homeData.highlights.length), 5000);
    return () => clearInterval(timer);
  }, [homeData.highlights.length]);

  const userName = profile?.name ? profile.name.split(' ')[0] : "Colaborador";

  // =========================================================================
  // SISTEMA DE PERMISSÕES E ACESSOS DINÂMICOS (CORRIGIDO PARA TYPESCRIPT)
  // =========================================================================
  // Convertendo as variáveis para 'string' ajuda a contornar o erro do TS (TS2367)
  const userRole = profile?.role as string | undefined;
  const userSector = profile?.sector as string | undefined;

  const isTecnico = userRole === 'assistente_tecnico' || userRole === 'tecnico';
  const isAdminOrGerente = userRole === 'admin' || userRole === 'gerente';
  const isChefe = userRole === 'chefe';
  const isEletrica = userSector?.toLowerCase() === 'elétrica' || userSector?.toLowerCase() === 'eletrica';
  
  // Condição blindada para o almoxarife/setor de estoque
  const isEstoque = userSector?.toLowerCase() === 'estoque' || 
                    userSector?.toLowerCase() === 'almoxarifado' || 
                    userRole?.toLowerCase() === 'almoxarife';

  // 1. CARDS DE ESTATÍSTICAS (KPIs)
  const stats = [];
  
  // Apenas quem não é técnico pode ver capital parado (Patrimônio)
  if (!isTecnico) {
    stats.push({ id: 'patrimonio', label: "Patrimônio", value: `R$ ${(homeData.stats.patrimonio / 1000).toFixed(1)}k`, desc: "Total", icon: "DollarSign", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" });
  }
  
  // Todos podem ver a quantidade de ativos e os materiais críticos
  stats.push({ id: 'ativos', label: "Ativos", value: homeData.stats.ativos.toLocaleString('pt-BR'), desc: "Itens Físicos", icon: "Box", color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" });
  stats.push({ id: 'criticos', label: "Críticos", value: homeData.stats.criticos.toString().padStart(2, '0'), desc: "Urgente", icon: "AlertTriangle", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" });
  
  // Apenas quem não é técnico pode ver material obsoleto
  if (!isTecnico) {
    stats.push({ id: 'obsoletos', label: "Obsoletos", value: homeData.stats.obsoletos.toString().padStart(2, '0'), desc: "+90d", icon: "Timer", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20" });
  }

  // 2. BOTÕES DE ACESSO RÁPIDO
  const quickActions = [];

  // Todos podem pedir material e consultar estoque
  quickActions.push({ id: 'pedir', label: "Pedir Material", icon: "ShoppingCart", href: "/requests", color: "text-emerald-400", bg: "bg-emerald-400/10" });
  quickActions.push({ id: 'consultar', label: "Consultar", icon: "Search", href: "/stock-view", color: "text-purple-400", bg: "bg-purple-400/10" });

  // Apenas elétrica ou Admins/Gerentes vêm o quadro de tarefas
  if (isEletrica || isAdminOrGerente) {
    quickActions.push({ id: 'tarefas', label: "Minhas Tarefas", icon: "ClipboardList", href: "/tasks", color: "text-pink-400", bg: "bg-pink-400/10" });
  }

  // Apenas Almoxarife e Admins podem ver a gestão direta de produtos e estoque (Chefes não!)
  if (isAdminOrGerente || isEstoque) {
    quickActions.push({ id: 'mover', label: "Movimentar", icon: "Box", href: "/stock", color: "text-blue-400", bg: "bg-blue-400/10" });
    quickActions.push({ id: 'produtos', label: "Produtos", icon: "PackagePlus", href: "/products", color: "text-amber-400", bg: "bg-amber-400/10" });
  }


  // --- FUNÇÕES DE NOTIFICAÇÃO ---
  const markAllRead = () => setNotifications(notifications.map(n => ({ ...n, read: true })));
  const markOneRead = (id: number) => setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  const removeNotification = (id: number) => setNotifications(notifications.filter(n => n.id !== id));

  const getNotifStyle = (type: string) => {
    switch(type) {
        case 'success': return { icon: "CheckCircle2", bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/20" };
        case 'alert': return { icon: "AlertOctagon", bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/20" };
        case 'error': return { icon: "AlertTriangle", bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/20" };
        default: return { icon: "Info", bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/20" };
    }
  };

  return (
    <div className="w-full min-h-screen overflow-x-hidden flex flex-col items-center bg-[#020617]">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col gap-6 px-4 md:px-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-hidden">
        
        {/* --- HEADER --- */}
        <div className="w-full relative overflow-hidden rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-white/5 shadow-2xl bg-gradient-to-br from-[#0f172a] via-[#020617] to-blue-950/20 shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10 flex flex-row justify-between items-start gap-3">
            
            <div className="space-y-1 flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-4xl font-black text-white tracking-tight leading-tight truncate">
                {greeting}, <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600">{userName}</span>
              </h1>
              <p className="text-slate-400 text-xs md:text-lg font-medium mt-1 truncate">
                Bem-vindo ao <span className="font-semibold text-slate-200">Fluxo Royale</span>.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Sheet open={isNotifOpen} onOpenChange={setIsNotifOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-[#0f172a] border border-white/10 hover:bg-white/10 shadow-lg group transition-all active:scale-95">
                        <LucideIcons.Bell className="h-5 w-5 md:h-6 md:w-6 text-slate-300 group-hover:text-yellow-400 transition-colors" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2.5 right-3 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[#0f172a] animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span>
                        )}
                    </Button>
                  </SheetTrigger>
                  
                  {/* CONTEÚDO DA GAVETA DE NOTIFICAÇÕES */}
                  <SheetContent side="right" className="w-[85vw] sm:max-w-md bg-[#020617] border-l border-white/10 text-white p-0 shadow-2xl flex flex-col">
                      <div className="p-5 border-b border-white/10 bg-[#0f172a]/90 backdrop-blur-xl sticky top-0 z-20 flex justify-between items-center shrink-0">
                          <SheetHeader>
                              <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
                                  Notificações 
                                  {unreadCount > 0 && <Badge className="bg-red-600 text-white border-0 text-[10px] h-5 px-1.5 shadow-lg shadow-red-900/40">{unreadCount}</Badge>}
                              </SheetTitle>
                          </SheetHeader>
                          {unreadCount > 0 && (
                              <Button variant="ghost" size="sm" onClick={markAllRead} className="text-[10px] text-blue-400 hover:text-blue-300 h-8 uppercase font-bold tracking-wider hover:bg-blue-900/20 rounded-lg transition-colors">
                                  <LucideIcons.CheckCheck className="w-3.5 h-3.5 mr-1" /> Lidas
                              </Button>
                          )}
                      </div>

                      <ScrollArea className="flex-1 p-4">
                          {notifications.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4 py-20">
                                  <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center">
                                      <LucideIcons.Bell className="h-10 w-10 text-slate-500" />
                                  </div>
                                  <p className="text-sm text-slate-400">Tudo limpo por aqui.</p>
                              </div>
                          ) : (
                              <div className="space-y-6 pb-6">
                                  {notifications.some(n => !n.read) && (
                                      <div className="space-y-3">
                                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center gap-2">
                                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.8)]"/> Novas
                                          </h4>
                                          {notifications.filter(n => !n.read).map((notif) => {
                                              const style = getNotifStyle(notif.type);
                                              return (
                                                  <div key={notif.id} className="group relative bg-[#0f172a] border border-white/10 hover:border-white/20 p-4 rounded-2xl shadow-lg transition-all active:scale-[0.99] overflow-hidden">
                                                      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r", style.text === "text-red-400" ? "from-red-500" : "from-blue-500")} />
                                                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 to-amber-600 shadow-[0_0_15px_rgba(250,204,21,0.4)]" />
                                                      <div className="flex gap-4 pl-2 relative z-10">
                                                          <div className={cn("mt-0.5 shrink-0 p-2.5 rounded-xl h-fit border shadow-inner", style.bg, style.border)}>
                                                              <DynamicIcon name={style.icon} className={cn("h-5 w-5", style.text)} />
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                              <div className="flex justify-between items-start mb-1">
                                                                  <h5 className="font-bold text-sm text-white leading-tight truncate">{notif.title}</h5>
                                                                  <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2 bg-black/20 px-1.5 py-0.5 rounded-md">{notif.time}</span>
                                                              </div>
                                                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{notif.desc}</p>
                                                              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                                                  <button onClick={() => markOneRead(notif.id)} className="text-[10px] font-bold text-blue-400 hover:text-white transition-colors">Marcar lida</button>
                                                              </div>
                                                          </div>
                                                          <button onClick={() => removeNotification(notif.id)} className="absolute -top-1 -right-1 p-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                                              <LucideIcons.X className="h-3.5 w-3.5" />
                                                          </button>
                                                      </div>
                                                  </div>
                                              )
                                          })}
                                      </div>
                                  )}
                                  <div className="space-y-3">
                                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Anteriores</h4>
                                      {notifications.filter(n => n.read).map((notif) => {
                                          const style = getNotifStyle(notif.type);
                                          return (
                                              <div key={notif.id} className="flex gap-4 p-4 rounded-2xl border border-transparent hover:bg-white/5 transition-all opacity-60 hover:opacity-100 group relative">
                                                  <div className="mt-0.5 shrink-0 grayscale opacity-50 p-2 rounded-xl bg-white/5">
                                                      <DynamicIcon name={style.icon} className={cn("h-4 w-4", style.text)} />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                      <div className="flex justify-between items-start mb-1">
                                                          <h5 className="font-medium text-sm text-slate-300 leading-tight truncate">{notif.title}</h5>
                                                          <span className="text-[10px] text-slate-600 font-mono shrink-0 ml-2">{notif.time}</span>
                                                      </div>
                                                      <p className="text-xs text-slate-500 leading-snug line-clamp-2">{notif.desc}</p>
                                                  </div>
                                                  <button onClick={() => removeNotification(notif.id)} className="absolute top-2 right-2 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <LucideIcons.X className="h-3 w-3" />
                                                  </button>
                                              </div>
                                          )
                                      })}
                                  </div>
                              </div>
                          )}
                      </ScrollArea>
                  </SheetContent>
              </Sheet>

              <div className="hidden xs:flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 text-slate-300 text-[10px] md:text-xs font-medium backdrop-blur-md">
                  <LucideIcons.Calendar className="h-3 w-3 text-blue-400" />
                  <span className="capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- KPIs (GRID DINÂMICA) --- */}
        <div className="w-full shrink-0">
          <div className={cn("grid gap-3", stats.length <= 2 ? "grid-cols-2 lg:grid-cols-2 max-w-2xl" : "grid-cols-2 lg:grid-cols-4")}>
              {stats.map((stat, index) => (
              <Card key={index} className={cn("border-white/5 bg-[#0f172a]/60 backdrop-blur-xl relative overflow-hidden group hover:border-white/10 transition-all duration-300 shadow-lg", stat.border)}>
                  <CardContent className="p-3 md:p-6 flex flex-col justify-between h-full min-h-[100px]">
                  <div className="flex justify-between items-start mb-2">
                      <div className={cn("h-8 w-8 md:h-10 md:w-10 rounded-xl flex items-center justify-center shadow-lg", stat.bg, stat.color)}>
                          <DynamicIcon name={stat.icon} className="h-4 w-4 md:h-5 md:w-5" />
                      </div>
                      {stat.id === 'obsoletos' && Number(homeData.stats.obsoletos) > 0 && (
                          <span className="flex h-2.5 w-2.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                      )}
                  </div>
                  
                  <div className="min-w-0">
                      <h3 className="text-lg md:text-2xl font-black text-white tracking-tight leading-none mb-1 truncate">
                        {isLoading ? "Carregando..." : stat.value}
                      </h3>
                      <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5 truncate">{stat.label}</p>
                      <p className={cn("text-[9px] md:text-[10px] font-medium flex items-center gap-1 opacity-80 truncate", stat.color)}>
                      {stat.desc}
                      </p>
                  </div>
                  </CardContent>
              </Card>
              ))}
          </div>
        </div>

        {/* --- DESTAQUES (CARROSSEL DINÂMICO DO BANCO) --- */}
        <div className="w-full shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <LucideIcons.Sparkles className="h-4 w-4 md:h-5 md:w-5 text-yellow-400" /> Destaques
              </h2>
              {/* Opção para o Admin acessar as configurações dos Destaques */}
              {(profile?.role === 'admin' || profile?.role === 'gerente') && (
                 <Link to="/admin/destaques" className="text-xs text-blue-400 hover:text-blue-300">
                    Gerir Banners
                 </Link>
              )}
          </div>
          
          <div className="relative w-full h-36 md:h-40 overflow-hidden rounded-[1.5rem] shadow-xl bg-[#0f172a]">
              {homeData.highlights.length > 0 ? homeData.highlights.map((item, index) => (
                  <div 
                      key={index}
                      className={cn(
                          "absolute inset-0 w-full h-full p-5 md:p-6 transition-opacity duration-1000 ease-in-out border flex flex-col justify-center",
                          item.bg, item.border, 
                          index === currentHighlight ? "opacity-100 z-10" : "opacity-0 z-0"
                      )}
                  >
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                          <DynamicIcon name={item.icon} className="h-24 w-24 text-white" />
                      </div>
                      <div className="relative z-10 flex flex-col justify-center h-full min-w-0">
                          <div className="bg-black/20 w-fit p-1.5 rounded-lg mb-2 backdrop-blur-sm border border-white/10">
                              <DynamicIcon name={item.icon} className="h-5 w-5 text-white" />
                          </div>
                          <h3 className="text-lg md:text-2xl font-bold text-white leading-tight mb-1 truncate pr-2">{item.title}</h3>
                          <p className="text-xs md:text-sm text-white/90 font-medium max-w-[90%] leading-snug line-clamp-2">{item.desc}</p>
                      </div>
                  </div>
              )) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  Sem destaques no momento.
                </div>
              )}
              
              {homeData.highlights.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                    {homeData.highlights.map((_, i) => (
                        <div key={i} className={cn("h-1.5 rounded-full transition-all duration-300", i === currentHighlight ? "w-4 bg-white" : "w-1.5 bg-white/40")} />
                    ))}
                </div>
              )}
          </div>
        </div>

        {/* --- MENU RÁPIDO (COM ACESSO CONDICIONAL) --- */}
        <div className="w-full shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                  <LucideIcons.Zap className="h-4 w-4 md:h-5 md:w-5 text-blue-400" /> Acesso Rápido
              </h2>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 md:flex md:flex-wrap gap-3 w-full">
              {quickActions.map((action, i) => (
                  <Link key={i} to={action.href} className="w-full md:w-auto md:flex-1 md:min-w-[150px]">
                      <div className="group w-full h-24 md:h-28 p-2 md:p-3 rounded-[1.2rem] md:rounded-[1.5rem] bg-[#0f172a] border border-white/5 active:bg-white/5 flex flex-col items-center justify-center gap-2 cursor-pointer shadow-md transition-all hover:border-white/10">
                          <div className={cn("h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner mb-0.5 transition-transform group-active:scale-90", action.bg)}>
                              <DynamicIcon name={action.icon} className={cn("h-5 w-5 md:h-6 md:w-6", action.color)} />
                          </div>
                          <span className="text-[10px] md:text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors">{action.label}</span>
                      </div>
                  </Link>
              ))}
          </div>
        </div>

        {/* --- SEÇÃO INFERIOR --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full shrink-0">
            
            {/* Timeline Integrada ao Banco */}
            <Card className="lg:col-span-2 border-white/5 bg-[#0f172a]/60 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2rem]">
              <CardContent className="p-5 md:p-6">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2"><LucideIcons.Activity className="h-4 w-4 md:h-5 md:w-5 text-blue-400"/> Atividade Recente</h3>
                      <Link to="/logs" className="text-[10px] md:text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline">Ver completo</Link>
                  </div>
                  <div className="relative border-l-2 border-white/5 ml-2 md:ml-3 space-y-6 md:space-y-8 pb-2">
                      {homeData.activities.map((activity, i) => (
                          <div key={i} className="relative pl-6">
                              <div className="absolute -left-[7px] md:-left-[9px] top-0 h-3.5 w-3.5 md:h-4 md:w-4 rounded-full bg-[#0f172a] border-2 border-slate-700 flex items-center justify-center shadow-sm">
                                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400"></div>
                              </div>
                              <div className="flex flex-col gap-1 min-w-0">
                                  <div className="flex justify-between items-start pr-2">
                                      <p className="text-xs md:text-sm text-slate-300 leading-snug truncate">
                                          <span className="font-bold text-white">{activity.user}</span> registrou: {activity.action}
                                      </p>
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap ml-2">{activity.time}</span>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {homeData.activities.length === 0 && (
                          <p className="text-xs text-slate-500 ml-4">Nenhuma atividade registrada hoje.</p>
                      )}
                  </div>
              </CardContent>
            </Card>

            {/* DICA DO DIA (Muda de acordo com a função do utilizador!) */}
            {!isTecnico ? (
              <div className="relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] bg-gradient-to-br from-violet-900 via-[#1e1b4b] to-[#020617] border border-white/10 shadow-2xl p-6 flex flex-col justify-between min-h-[220px] group transition-all hover:scale-[1.01] hover:shadow-violet-900/20 w-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/20 rounded-full blur-[60px] pointer-events-none group-hover:bg-fuchsia-500/30 transition-all duration-700"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none"></div>
                <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 rotate-12">
                    <LucideIcons.Lightbulb className="h-28 w-28 text-white" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-white/10 p-2 rounded-xl border border-white/20 backdrop-blur-md shadow-inner">
                            <LucideIcons.Sparkles className="h-4 w-4 text-fuchsia-300" />
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-fuchsia-200 uppercase tracking-[0.2em]">Insight de Gestão</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-white leading-tight mb-2 tracking-tight truncate">
                        Otimize seu Fluxo
                    </h3>
                    <p className="text-indigo-200/80 text-xs md:text-sm leading-relaxed max-w-[90%] font-medium">
                        Produtos sem giro há mais de 90 dias representam <span className="text-white font-bold border-b border-fuchsia-500/50">custo oculto</span>. Gere o relatório de obsoletos para liberar capital.
                    </p>
                </div>
                <div className="relative z-10 mt-6">
                    <Button className="w-full bg-white text-indigo-950 hover:bg-indigo-50 font-bold rounded-xl h-11 text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all flex justify-between items-center px-6 group/btn">
                        Ver Relatório
                        <LucideIcons.ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] bg-gradient-to-br from-blue-900 via-slate-800 to-[#020617] border border-white/10 shadow-2xl p-6 flex flex-col justify-between min-h-[220px] group transition-all hover:scale-[1.01] hover:shadow-blue-900/20 w-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-[60px] pointer-events-none group-hover:bg-blue-500/30 transition-all duration-700"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sky-500/20 rounded-full blur-[60px] pointer-events-none"></div>
                <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500 -rotate-12">
                    <LucideIcons.Wrench className="h-28 w-28 text-white" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-white/10 p-2 rounded-xl border border-white/20 backdrop-blur-md shadow-inner">
                            <LucideIcons.ShieldCheck className="h-4 w-4 text-blue-300" />
                        </div>
                        <span className="text-[10px] md:text-xs font-bold text-blue-200 uppercase tracking-[0.2em]">Aviso de Segurança</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-white leading-tight mb-2 tracking-tight truncate">
                        Segurança em 1º Lugar
                    </h3>
                    <p className="text-blue-200/80 text-xs md:text-sm leading-relaxed max-w-[90%] font-medium">
                        Lembre-se sempre de utilizar os <span className="text-white font-bold border-b border-blue-500/50">EPIs adequados</span> antes de iniciar qualquer manutenção. A sua segurança é essencial!
                    </p>
                </div>
                <div className="relative z-10 mt-6">
                    <Link to="/tasks">
                      <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl h-11 text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] transition-all flex justify-between items-center px-6 group/btn">
                          Ir para Tarefas
                          <LucideIcons.ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                </div>
              </div>
            )}

        </div>
      </div>
    </div>
  );
}
