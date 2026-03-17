import { 
  Home, Package, ShoppingCart, FileText, Users, BarChart3, LogOut, 
  ClipboardList, Truck, AlertTriangle, ShieldCheck, Lock, Settings, 
  Boxes, Building2, Eye, Kanban, Zap, MapPin // <--- 1. IMPORTADO O ÍCONE MapPin PARA VIAGENS
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { NavLink } from "./NavLink";
import { ScrollArea } from "./ui/scroll-area";

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean; 
  toggleSidebar?: () => void;
  onItemClick?: () => void;
}

export function Sidebar({ mobile, onClose, isCollapsed = false, toggleSidebar, onItemClick }: SidebarProps) {
  const { profile, signOut, canAccess } = useAuth();
  const { unreadCount } = useSocket(); 

  const isAdmin = profile?.role === "admin";
  const isSetor = profile?.role === "setor";
  
  // Verifica se o utilizador pertence à equipa da Elétrica
  const isEletrica = profile?.sector?.toLowerCase() === 'elétrica' || profile?.sector?.toLowerCase() === 'eletrica';

  // --- CORES DO TEMA ROYALE (Azul Profundo + Amarelo Ouro) ---
  const baseClass = "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-slate-400 hover:text-white hover:bg-white/5 group relative overflow-hidden";
  
  // Item Ativo: Fundo Azul Translúcido + Texto Amarelo + Borda Sutil Dourada
  const activeClass = "bg-blue-900/30 text-yellow-400 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.2)]";

  const formatBadgeCount = (count: number) => {
    if (!count || count <= 0) return null;
    return count > 9 ? "9+" : count;
  };

  const renderLink = (to: string, icon: React.ReactNode, label: string) => {
    const isRequestsRoute = to === "/requests";
    const hasCount = unreadCount > 0;
    const showBadge = isRequestsRoute && hasCount;
    
    return (
      <NavLink 
        to={to} 
        className={`${baseClass} ${isCollapsed ? "justify-center px-2" : ""}`}
        activeClassName={activeClass}
        title={isCollapsed ? label : ""}
        onClick={() => {
          if (onClose) onClose();
          if (onItemClick) onItemClick();
        }}
      >
        {/* Indicador Ativo Lateral (Barra Dourada) */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400 rounded-r-full opacity-0 transition-opacity duration-200 group-[.active]:opacity-100 shadow-[0_0_10px_rgba(250,204,21,0.5)]" />

        <div className="relative flex items-center justify-center">
          {icon}
          
          {showBadge && isCollapsed && (
            <span className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse border border-[#0f172a]">
              {formatBadgeCount(unreadCount)}
            </span>
          )}
        </div>
        
        {!isCollapsed && (
          <>
            <span className="truncate flex-1">{label}</span>
            
            {showBadge && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                {formatBadgeCount(unreadCount)}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className={`flex flex-col h-full ${mobile ? 'bg-[#09090b]' : 'bg-transparent'} text-white transition-all duration-300 w-full`}>
      
      {/* CABEÇALHO DA SIDEBAR */}
      <div className={`h-24 flex items-center ${isCollapsed ? "justify-center" : "px-6"} border-b border-white/5`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            {/* Ícone da Aba com Brilho Dourado */}
            <img 
               src="/favicon.png" 
               alt="Fluxo Royale" 
               className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.3)] transition-transform hover:scale-110"
            />
            <div className="flex flex-col">
              <h1 className="font-bold text-white tracking-tight text-lg leading-none">Fluxo Royale</h1>
              <p className="text-[10px] text-yellow-500 uppercase tracking-widest font-bold mt-1">Royale System</p>
            </div>
          </div>
        ) : (
          <img 
             src="/favicon.png" 
             alt="F" 
             className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]"
          />
        )}
      </div>

      {/* NAVEGAÇÃO COM SCROLL INVISÍVEL */}
      <ScrollArea className="flex-1 py-6 no-scrollbar">
        <nav className="flex flex-col gap-1 px-4 space-y-6">
          
          {/* GRUPO PRINCIPAL */}
          <div>
            {!isCollapsed && <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Visão Geral</p>}
            {renderLink(isSetor ? "/stock-view" : "/inicio", <Home className="w-5 h-5" />, "Início")}
            
            {/* LINK GESTÃO (Visível para todos) */}
            {renderLink("/gestao", <Kanban className="w-5 h-5" />, "Quadro de Gestão")}
          </div>

          {/* GRUPO ESTOQUE */}
          {(canAccess('produtos') || canAccess('estoque') || canAccess('consultar')) && (
            <div>
              {!isCollapsed && <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gestão de Estoque</p>}
              
              {canAccess('produtos') && renderLink("/products", <Package className="w-5 h-5" />, "Catálogo Produtos")}
              {canAccess('estoque') && renderLink("/stock", <Boxes className="w-5 h-5" />, "Movimentação")}
              
              {canAccess('consultar') && renderLink("/stock-view", <Eye className="w-5 h-5" />, "Consulta Rápida")}
              {canAccess('consultar') && renderLink("/sectors", <Building2 className="w-5 h-5" />, "Estoque por Setores")}
            </div>
          )}

          {/* GRUPO OPERACIONAL */}
          {(canAccess('solicitacoes') || canAccess('separacoes') || canAccess('tarefas_visualizar') || canAccess('viagens_externas') || isEletrica) && (
            <div>
              {!isCollapsed && <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Operacional</p>}
              
              {canAccess('solicitacoes') && renderLink("/requests", <ShoppingCart className="w-5 h-5" />, "Solicitações")}
              {canAccess('separacoes') && renderLink("/separations", <Truck className="w-5 h-5" />, "Separação / Saída")}
              
              {(canAccess('tarefas_visualizar') || canAccess('tarefas_editar')) && 
                renderLink("/tasks", <ClipboardList className="w-5 h-5" />, "Tarefas")
              }
              
              {/* Botão Dinâmico da Elétrica */}
              {(isAdmin || isEletrica) && 
                renderLink("/eletrica", <Zap className="w-5 h-5 text-yellow-500 group-hover:text-yellow-400" />, "Quadro Elétrica")
              }

              {/* ✨ NOVO: Botão das Viagens Externas */}
              {(isAdmin || canAccess('viagens_externas')) && 
                renderLink("/travels", <MapPin className="w-5 h-5" />, "Viagens Externas")
              }
              
              {canAccess('confronto_viagem') && renderLink("/reconciliation", <FileText className="w-5 h-5" />, "Confronto")}
            </div>
          )}

          {/* GRUPO ADMINISTRAÇÃO */}
          {(isAdmin || canAccess('relatorios') || canAccess('estoque_critico')) && (
            <div>
              {!isCollapsed && <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gerência</p>}
              
              {canAccess('estoque_critico') && renderLink("/low-stock", <AlertTriangle className="w-5 h-5" />, "Compras & Críticos")}
              {canAccess('relatorios') && renderLink("/reports", <BarChart3 className="w-5 h-5" />, "Relatórios")}
              
              {isAdmin && (
                <>
                  {renderLink("/users", <Users className="w-5 h-5" />, "Usuários")}
                  {renderLink("/audit", <ShieldCheck className="w-5 h-5" />, "Auditoria")}
                  {renderLink("/permissions", <Lock className="w-5 h-5" />, "Permissões")}
                  {renderLink("/settings", <Settings className="w-5 h-5" />, "Configurações")}
                </>
              )}
            </div>
          )}

        </nav>
      </ScrollArea>

      {/* RODAPÉ PERFIL */}
      <div className="p-4 border-t border-white/5">
        <button 
          onClick={() => { signOut(); if(onClose) onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && <span>Sair do Sistema</span>}
        </button>
      </div>
    </div>
  );
}
