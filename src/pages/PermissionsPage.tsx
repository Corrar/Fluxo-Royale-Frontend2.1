import { useState, useEffect, useMemo } from "react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Lock, Save, RefreshCw, Search, Layers, 
  LayoutDashboard, Truck, Settings, FileText, Undo2, 
  ClipboardList, UserCog, Shield, Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// --- TIPAGEM ---
// 1. ADICIONADO: Categoria específica para os Quadros de Setor
type PermissionCategory = "Geral" | "Gestão" | "Movimentação" | "Relatórios" | "Administração" | "Tarefas" | "Painéis de Setor";

interface PermissionItem {
  key: string;
  label: string;
  category: PermissionCategory;
  description?: string;
}

// --- DADOS ---
const AVAILABLE_PAGES: PermissionItem[] = [
  // Geral
  { key: "dashboard", label: "Dashboard", category: "Geral", description: "Visão geral e estatísticas" },
  { key: "avisos", label: "Avisos", category: "Geral", description: "Mural de recados" },
  { key: "calculadora", label: "Calculadora", category: "Geral", description: "Cálculo de materiais" },
  { key: "calculo_minimo", label: "Calc. Mínimo", category: "Geral", description: "Sugestão de compra" },
  { key: "lembretes", label: "Painel de Lembretes", category: "Geral", description: "Quadro de avisos rápidos" },

  // Tarefas
  { key: "tarefas_visualizar", label: "Ver Tarefas", category: "Tarefas", description: "Visualizar quadro" },
  { key: "tarefas_editar", label: "Gerenciar Tarefas", category: "Tarefas", description: "Criar/Editar/Excluir" },
  
  // ✨ CORREÇÃO AQUI: O texto agora explica que o sistema restringe sozinho!
  { key: "viagens_externas", label: "Módulo de Viagens", category: "Tarefas", description: "Acesso Inteligente (Admin gere tudo, Técnico só executa e bate ponto)" },

  // ✨ NOVO: Permissões Específicas dos Setores para liberar aos Técnicos
  { key: "painel_lavadora", label: "Setor Lavadora", category: "Painéis de Setor", description: "Acesso ao quadro Lavadora" },
  { key: "painel_flow", label: "Setor Flow", category: "Painéis de Setor", description: "Acesso ao quadro Flow" },
  { key: "painel_eletrica", label: "Setor Elétrica", category: "Painéis de Setor", description: "Acesso ao quadro Elétrica" },
  { key: "painel_esteira", label: "Setor Esteira", category: "Painéis de Setor", description: "Acesso ao quadro Esteira" },
  { key: "painel_usinagem", label: "Setor Usinagem", category: "Painéis de Setor", description: "Acesso ao quadro Usinagem" },
  { key: "painel_ferro", label: "Setor Ferro", category: "Painéis de Setor", description: "Acesso ao quadro Ferro" },
  { key: "painel_geral", label: "Setor Geral", category: "Painéis de Setor", description: "Acesso ao quadro Geral" },

  // Gestão
  { key: "produtos", label: "Produtos", category: "Gestão", description: "Catálogo de produtos" },
  { key: "estoque", label: "Estoque Físico", category: "Gestão", description: "Ajuste manual" },
  { key: "consultar", label: "Consulta Estoque", category: "Gestão", description: "Ver saldo atual" },
  { key: "stock_view_financial", label: "Ver Valores", category: "Gestão", description: "Ver Custo e Preço" },
  { key: "stock_view_edit", label: "Editar Preços", category: "Gestão", description: "Alterar valores" },
  { key: "painel_gestao", label: "Painel de Gestão", category: "Gestão", description: "Quadro de gestão estratégica" },

  // Movimentação
  { key: "pedidos", label: "Pedidos & Expedição", category: "Movimentação", description: "Vendas e garantias" },
  { key: "solicitacoes", label: "Gestão Solicitações", category: "Movimentação", description: "Aprovar pedidos" },
  { key: "minhas_solicitacoes", label: "Meus Pedidos", category: "Movimentação", description: "Criar solicitações" },
  { key: "separacoes", label: "Separações", category: "Movimentação", description: "Fila do almoxarifado" },
  { key: "confronto_viagem", label: "Confronto", category: "Movimentação", description: "Auditoria de retorno" },

  // Relatórios
  { key: "estoque_critico", label: "Estoque Crítico", category: "Relatórios", description: "Relatório de compras" },
  { key: "relatorios", label: "Relatórios BI", category: "Relatórios", description: "Gráficos gerenciais" },

  // Admin
  { key: "usuarios", label: "Usuários", category: "Administração", description: "Logins e senhas" },
  { key: "logs", label: "Auditoria", category: "Administração", description: "Logs de segurança" },
  { key: "permissoes", label: "Permissões", category: "Administração", description: "Gerenciar acessos" },
];

// 2. ADICIONADO: Labels bonitas alinhadas com o ecrã de Usuários
const ROLE_OPTIONS = [
  { id: "admin", label: "Administrador" },
  { id: "gerente", label: "Gerente" },
  { id: "almoxarife", label: "Almoxarife" },
  { id: "compras", label: "Compras" },
  { id: "setor", label: "Operacional" },
  { id: "auxiliar", label: "Auxiliar" },
  { id: "chefe", label: "Chefe" },
  { id: "assistente_tecnico", label: "Técnico" },
  { id: "engenharia", label: "Engenharia" },
  { id: "prototipo", label: "Protótipo" },
  { id: "desenvolvimento", label: "Desenvolvimento" },
];

const CATEGORY_ICONS: Record<PermissionCategory, any> = {
  "Geral": LayoutDashboard,
  "Tarefas": ClipboardList,
  "Painéis de Setor": Briefcase, // Ícone novo para os setores
  "Gestão": Layers,
  "Movimentação": Truck,
  "Relatórios": FileText,
  "Administração": Settings
};

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const hasChanges = useMemo(() => {
    return JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
  }, [permissions, originalPermissions]);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/permissions");
      setPermissions(res.data);
      setOriginalPermissions(res.data);
    } catch (error) {
      toast.error("Erro ao carregar permissões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const togglePermission = (role: string, pageKey: string) => {
    setPermissions((prev) => {
      const rolePermissions = prev[role] || [];
      const hasPermission = rolePermissions.includes(pageKey);
      const newRolePermissions = hasPermission
        ? rolePermissions.filter((p) => p !== pageKey)
        : [...rolePermissions, pageKey];
      return { ...prev, [role]: newRolePermissions };
    });
  };

  const toggleCategoryForRole = (role: string, category: string, enable: boolean) => {
    const keysInCategory = AVAILABLE_PAGES.filter(p => p.category === category).map(p => p.key);
    setPermissions(prev => {
        const currentRolePerms = prev[role] || [];
        let newPerms;
        if (enable) {
            const toAdd = keysInCategory.filter(k => !currentRolePerms.includes(k));
            newPerms = [...currentRolePerms, ...toAdd];
        } else {
            newPerms = currentRolePerms.filter(k => !keysInCategory.includes(k));
        }
        return { ...prev, [role]: newPerms };
    });
  };

  // ✨ CORREÇÃO DO BLOQUEIO DE TELA (Deadlock)
  // Agora os requests vão um a um de forma segura em vez de Promise.all
  const handleSave = async () => {
    setSaving(true);
    try {
      for (const role of ROLE_OPTIONS) {
        const rolePerms = permissions[role.id] || [];
        await api.post("/admin/permissions", { role: role.id, permissions: rolePerms });
      }
      
      setOriginalPermissions(permissions);
      toast.success("Permissões salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar permissões.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = useMemo(() => {
    const filtered = AVAILABLE_PAGES.filter(p => 
      p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const grouped: Record<string, PermissionItem[]> = {};
    const order: PermissionCategory[] = ["Geral", "Tarefas", "Painéis de Setor", "Gestão", "Movimentação", "Relatórios", "Administração"];
    order.forEach(cat => grouped[cat] = []);

    filtered.forEach(item => {
      grouped[item.category].push(item);
    });

    Object.keys(grouped).forEach(key => { if (grouped[key].length === 0) delete grouped[key]; });

    return grouped;
  }, [searchTerm]);

  const activeCount = (permissions[selectedRole] || []).length;
  const totalCount = AVAILABLE_PAGES.length;

  return (
    // Container Principal com Background Royale Profundo
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-32 lg:h-[calc(100vh-6rem)] lg:pb-0">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 px-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-white">
            <Lock className="h-6 w-6 md:h-8 md:w-8 text-yellow-400" /> 
            <span className="hidden md:inline">Controle de Acesso</span>
            <span className="md:hidden">Acessos</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 hidden md:block">Gerencie o que cada cargo pode ver e fazer.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            {hasChanges && (
                <Button variant="ghost" size="sm" onClick={() => setPermissions(originalPermissions)} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-10 px-4 rounded-xl">
                    <Undo2 className="mr-2 h-4 w-4" /> Desfazer
                </Button>
            )}
            <Button 
                onClick={handleSave} 
                disabled={!hasChanges || saving} 
                className={`flex-1 md:flex-none h-10 rounded-xl font-bold shadow-lg transition-all ${hasChanges ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/50' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
            >
                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {hasChanges ? "Salvar Alterações" : "Salvo"}
            </Button>
        </div>
      </div>

      {/* --- MOBILE: DROPDOWN DE CARGOS PREMIUM --- */}
      <div className="lg:hidden w-full space-y-2 px-1 sticky top-0 z-30 bg-[#09090b]/80 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 border-b border-white/5">
          <label className="text-xs font-bold text-yellow-500 uppercase tracking-widest pl-1">Selecionar Cargo</label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full h-14 rounded-2xl border-white/10 bg-[#0f172a] text-white focus:ring-yellow-500/50 shadow-xl">
                  <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-900/50 flex items-center justify-center border border-blue-500/30">
                        <UserCog className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="capitalize font-bold text-sm">
                          {ROLE_OPTIONS.find(r => r.id === selectedRole)?.label || selectedRole}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">Editando permissões</span>
                      </div>
                  </div>
              </SelectTrigger>
              <SelectContent className="bg-[#0f172a] border-white/10 text-white">
                  {ROLE_OPTIONS.map(role => (
                      <SelectItem key={role.id} value={role.id} className="capitalize py-3 focus:bg-white/5 focus:text-yellow-400 cursor-pointer">
                          {role.label}
                      </SelectItem>
                  ))}
              </SelectContent>
          </Select>
          
          <div className="flex justify-between items-center px-2 mt-2">
             <div className="text-xs text-slate-500">Permissões Ativas</div>
             <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800">{activeCount} de {totalCount}</Badge>
          </div>
      </div>

      {/* --- LAYOUT DUAS COLUNAS (Desktop) --- */}
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* ESQUERDA (Desktop Sidebar) */}
        <Card className="hidden lg:flex w-72 flex-col border-none shadow-2xl bg-[#0f172a] shrink-0 h-full rounded-3xl overflow-hidden border border-white/5">
            <CardHeader className="pb-4 pt-6 border-b border-white/5">
                <CardTitle className="text-xl flex items-center gap-2 text-white">
                    <UserCog className="h-6 w-6 text-yellow-400" /> Cargos
                </CardTitle>
                <CardDescription className="text-slate-400">Selecione para configurar</CardDescription>
            </CardHeader>
            <ScrollArea className="h-full">
                <div className="flex flex-col gap-2 p-4">
                    {ROLE_OPTIONS.map(role => {
                        const isSelected = selectedRole === role.id;
                        const count = (permissions[role.id] || []).length;
                        return (
                            <button
                                key={role.id}
                                onClick={() => setSelectedRole(role.id)}
                                className={cn(
                                    "relative flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all group w-full border",
                                    isSelected 
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50' 
                                        : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10 hover:text-white'
                                )}
                            >
                                <span className="capitalize">{role.label}</span>
                                <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5 border-0", isSelected ? "bg-white/20 text-white" : "bg-black/40 text-slate-400")}>
                                    {count}
                                </Badge>
                            </button>
                        )
                    })}
                </div>
            </ScrollArea>
        </Card>

        {/* DIREITA (Área de Permissões) */}
        <Card className="flex-1 flex flex-col border border-white/5 shadow-2xl bg-[#0f172a]/60 backdrop-blur-xl rounded-3xl overflow-hidden min-h-[500px]">
            {/* Header da Lista */}
            <div className="p-4 md:p-6 border-b border-white/5 bg-[#0f172a]/80 flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-0 z-10">
                <div className="hidden lg:flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center text-yellow-400 shadow-lg border border-white/10">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold capitalize text-white leading-none">
                            {ROLE_OPTIONS.find(r => r.id === selectedRole)?.label || selectedRole}
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Gerenciando acessos
                        </p>
                    </div>
                </div>
                
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input 
                        placeholder="Buscar permissão..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:ring-yellow-500/50"
                    />
                </div>
            </div>

            {/* Lista com Scroll */}
            <ScrollArea className="flex-1 h-full">
                {loading ? (
                    <div className="space-y-4 p-6">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl bg-white/5" />)}
                    </div>
                ) : (
                    <div className="space-y-8 pb-20 p-4 lg:p-8">
                        {Object.entries(groupedPermissions).map(([category, items]) => {
                            const CatIcon = CATEGORY_ICONS[category as PermissionCategory] || Layers;
                            const allInCategory = items.map(i => i.key);
                            const rolePerms = permissions[selectedRole] || [];
                            const isAllActive = allInCategory.every(k => rolePerms.includes(k));

                            return (
                                <div key={category} className="rounded-2xl border border-white/5 bg-[#0f172a]/40 overflow-hidden">
                                    {/* Cabeçalho da Categoria */}
                                    <div className="px-5 py-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                        <div className="flex items-center gap-3 text-white font-bold text-sm uppercase tracking-wide">
                                            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                                                <CatIcon className="h-4 w-4" />
                                            </div>
                                            {category}
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => toggleCategoryForRole(selectedRole, category, !isAllActive)}
                                            className={`text-[10px] h-8 px-3 rounded-lg font-bold uppercase tracking-wider border ${isAllActive ? 'border-red-900/30 text-red-400 hover:bg-red-900/20' : 'border-emerald-900/30 text-emerald-400 hover:bg-emerald-900/20'}`}
                                        >
                                            {isAllActive ? "Remover Todos" : "Ativar Todos"}
                                        </Button>
                                    </div>

                                    {/* Itens */}
                                    <div className="divide-y divide-white/5">
                                        {items.map((item) => {
                                            const isChecked = rolePerms.includes(item.key);
                                            const isLocked = selectedRole === 'admin' && ['permissoes', 'usuarios'].includes(item.key);

                                            return (
                                                <div 
                                                    key={item.key} 
                                                    className={cn(
                                                        "px-5 py-4 flex items-center justify-between transition-all cursor-pointer active:scale-[0.98]",
                                                        isChecked ? 'bg-blue-500/5' : 'hover:bg-white/5'
                                                    )}
                                                    onClick={() => !isLocked && togglePermission(selectedRole, item.key)}
                                                >
                                                    <div className="flex flex-col gap-1 pr-4 flex-1">
                                                        <span className={cn(
                                                            "font-medium text-sm transition-colors",
                                                            isChecked ? 'text-blue-400' : 'text-slate-300'
                                                        )}>
                                                            {item.label}
                                                        </span>
                                                        {item.description && (
                                                            <span className="text-xs text-slate-500 leading-tight block">
                                                                {item.description}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Switch Royale Style */}
                                                    <div className="flex items-center shrink-0 ml-2">
                                                        {isLocked ? (
                                                            <Lock className="h-5 w-5 text-yellow-600 opacity-50" />
                                                        ) : (
                                                            <div className={cn(
                                                                "w-12 h-7 rounded-full flex items-center p-1 transition-colors duration-300 border",
                                                                isChecked 
                                                                    ? "bg-blue-600 border-blue-500 justify-end" 
                                                                    : "bg-slate-800 border-slate-700 justify-start"
                                                            )}>
                                                                <div className={cn(
                                                                    "w-5 h-5 rounded-full shadow-md transition-all duration-300",
                                                                    isChecked ? "bg-white" : "bg-slate-500"
                                                                )} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {Object.keys(groupedPermissions).length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                                <Search className="h-12 w-12 mb-3 opacity-20" />
                                <p>Nenhuma permissão encontrada</p>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
