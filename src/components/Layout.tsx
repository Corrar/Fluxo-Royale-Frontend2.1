import { Sidebar } from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { Bell, Search, Home, Boxes, ShoppingCart, Menu, Zap, Eye, ClipboardList } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut, canAccess } = useAuth();
  const { unreadCount } = useSocket();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // =========================================================================
  // PERMISSÕES
  // =========================================================================
  const userRole = profile?.role as string | undefined;
  const userSector = profile?.sector as string | undefined;

  const isAdminOrGerente = userRole === "admin" || userRole === "gerente";
  const isSetor = userRole === "setor";
  const isChefe = userRole === "chefe";
  const isEletrica = userSector?.toLowerCase() === 'elétrica' || userSector?.toLowerCase() === 'eletrica';
  const isEstoque = userSector?.toLowerCase() === 'estoque' || userSector?.toLowerCase() === 'almoxarifado' || userRole?.toLowerCase() === 'almoxarife';

  // =========================================================================
  // CONSTRUÇÃO DINÂMICA DA BARRA INFERIOR (BOTTOM NAV)
  // =========================================================================
  const navItems = [];

  // 1. Início (Sempre o 1º ícone)
  navItems.push({ 
    icon: Home, 
    label: "Início", 
    href: isSetor ? "/stock-view" : "/inicio" 
  });

  // 2. Ação Principal do Setor (2º ícone)
  if (isEletrica || isAdminOrGerente) {
    navItems.push({ 
      icon: Zap, 
      label: (isChefe || isAdminOrGerente) ? "Elétrica" : "Tarefas", 
      href: "/eletrica" 
    });
  } else if (canAccess('estoque') || isEstoque) {
    navItems.push({ 
      icon: Boxes, 
      label: "Estoque", 
      href: "/stock" 
    });
  } else if (canAccess('tarefas_visualizar')) {
    navItems.push({ 
      icon: ClipboardList, 
      label: "Tarefas", 
      href: "/tasks" 
    });
  }

  // 3. Ação Secundária (3º ícone)
  if (canAccess('solicitacoes')) {
    navItems.push({ 
      icon: ShoppingCart, 
      label: "Pedidos", 
      href: "/requests", 
      hasBadge: true 
    });
  } else if (canAccess('consultar') && !isSetor) {
    navItems.push({ 
      icon: Eye, 
      label: "Consultar", 
      href: "/stock-view" 
    });
  }

  // Limitamos a 3 itens no máximo para não encavalar com o botão "Menu" no mobile
  const mobileNavItems = navItems.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#020617] flex overflow-hidden font-sans selection:bg-yellow-500/30">
      
      {/* --- DESKTOP: SIDEBAR FIXA --- */}
      <aside className="hidden md:flex w-72 flex-col fixed inset-y-4 left-4 z-50 rounded-3xl overflow-hidden transition-all duration-300 border border-white/5 shadow-2xl bg-[#0f172a]/60 backdrop-blur-xl">
        <Sidebar />
      </aside>

      {/* --- ÁREA PRINCIPAL --- */}
      <main className="flex-1 flex flex-col md:ml-80 relative min-h-screen transition-all duration-300">
        
        {/* HEADER CORRIGIDO (Evita Overflow) */}
        <header className="h-20 flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-lg md:bg-transparent transition-all border-b border-white/5 md:border-none gap-4">
          
          {/* Logo Mobile */}
          <div className="md:hidden flex items-center gap-2 shrink-0">
             <img 
               src="/favicon.png" 
               alt="Fluxo Royale" 
               className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]"
             />
             <div className="flex flex-col">
                <span className="font-bold text-white text-xs tracking-tight leading-none">Fluxo</span>
                <span className="text-[9px] text-yellow-500 uppercase tracking-[0.2em] font-bold">Royale</span>
             </div>
          </div>

          {/* Search Bar Desktop */}
          <div className="hidden md:flex items-center flex-1 max-w-md relative group">
            <Search className="absolute left-4 w-4 h-4 text-slate-500 group-focus-within:text-yellow-400 transition-colors" />
            <Input 
              placeholder="Buscar no sistema..." 
              className="pl-11 h-10 w-full bg-white/5 border-white/5 text-white rounded-full focus-visible:ring-yellow-500/50 transition-all hover:bg-white/10 placeholder:text-slate-600 focus-visible:border-yellow-500/30"
            />
          </div>

          <div className="md:hidden flex-1" />

          {/* Ações de Usuário */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5 rounded-full relative transition-all active:scale-95 h-9 w-9 md:h-10 md:w-10">
              <Bell className="w-4 h-4 md:w-5 md:h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] border-2 border-[#020617]" />
              )}
            </Button>
            
            <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-white/10">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold text-white leading-none mb-1 truncate max-w-[140px]">{profile?.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium truncate max-w-[140px]">{profile?.role}</p>
              </div>
              
              <div className="relative group cursor-pointer hidden md:block" onClick={() => signOut()}>
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-blue-600 to-yellow-500 rounded-full blur opacity-0 group-hover:opacity-60 transition duration-500"></div>
                <Avatar className="w-9 h-9 md:w-10 md:h-10 border-2 border-[#020617] relative ring-1 ring-white/10 group-hover:ring-yellow-500/50 transition-all">
                  <AvatarImage src={`https://ui-avatars.com/api/?name=${profile?.name}&background=0f172a&color=facc15&bold=true`} />
                  <AvatarFallback className="bg-slate-900 text-yellow-500 font-bold">US</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>

        {/* CONTEÚDO */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 md:p-6 md:pt-2 md:pb-6 no-scrollbar">
          <div className="w-full max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {children}
          </div>
        </div>

      </main>

      {/* --- MOBILE: BARRA DE NAVEGAÇÃO EXPANSIVA --- */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 h-[64px] z-50">
        
        {/* Container Glass */}
        <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8)] flex items-center p-1.5 gap-1.5">
          
          {/* Loop Dinâmico dos Ícones de Navegação */}
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link 
                key={item.href} 
                to={item.href}
                className={cn(
                  "relative flex items-center justify-center h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden",
                  isActive 
                    ? "flex-[3] bg-blue-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]" 
                    : "flex-1 hover:bg-white/5 text-slate-400" 
                )}
              >
                <div className="flex items-center justify-center gap-2 px-2">
                  <item.icon 
                    className={cn(
                      "w-5 h-5 transition-all duration-300 flex-shrink-0",
                      isActive ? "text-white fill-white/20" : "text-slate-400"
                    )} 
                  />
                  
                  {isActive && (
                    <span className="font-bold text-sm text-white whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
                      {item.label}
                    </span>
                  )}
                </div>

                {item.hasBadge && unreadCount > 0 && !isActive && (
                   <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                )}
              </Link>
            )
          })}

          <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />

          {/* Botão MENU (Abre o Sidebar Completo) */}
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <button className={cn(
                "flex-1 flex items-center justify-center h-full rounded-full transition-all duration-300 hover:bg-white/10 active:scale-95 group",
                isMobileOpen ? "bg-white/10 text-yellow-400" : "text-slate-300"
              )}>
                <Menu className="w-6 h-6 group-hover:text-yellow-400 transition-colors" />
              </button>
            </SheetTrigger>
            
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[2.5rem] border-t border-white/10 bg-[#020617] p-0 shadow-[0_-10px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col">
               
               <div className="w-full flex justify-center pt-4 pb-2" onClick={() => setIsMobileOpen(false)}>
                  <div className="w-12 h-1.5 bg-slate-800 rounded-full cursor-pointer hover:bg-slate-700 transition-colors" />
               </div>

               <div className="px-8 pb-8 pt-4 flex items-center gap-5 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600 to-yellow-500 rounded-full blur opacity-40"></div>
                    <Avatar className="w-16 h-16 border-4 border-[#020617] relative">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${profile?.name}&background=0f172a&color=facc15&bold=true`} />
                        <AvatarFallback>US</AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">{profile?.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 uppercase tracking-wider">
                            {profile?.role}
                        </span>
                    </div>
                  </div>
               </div>

               <div className="flex-1 overflow-hidden">
                  <Sidebar mobile onClose={() => setIsMobileOpen(false)} />
               </div>
            </SheetContent>
          </Sheet>

        </div>
      </div>

    </div>
  );
}
