import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow, differenceInMinutes } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { 
  UserPlus, Trash2, KeyRound, Shield, User as UserIcon, 
  MoreVertical, Fingerprint, Building2, Filter, Briefcase, Mail
} from "lucide-react"; 
import { useAuth } from "@/contexts/AuthContext";

// --- DESIGN SYSTEM: Cores de Cargos (Neon/Glow) ---
const roleThemes: Record<string, { border: string, shadow: string, badge: string, icon: string }> = {
  admin: { border: "group-hover:border-red-500/50", shadow: "group-hover:shadow-red-900/20", badge: "bg-red-500/10 text-red-400 border-red-500/20", icon: "text-red-500" },
  gerente: { border: "group-hover:border-cyan-500/50", shadow: "group-hover:shadow-cyan-900/20", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20", icon: "text-cyan-500" },
  almoxarife: { border: "group-hover:border-blue-500/50", shadow: "group-hover:shadow-blue-900/20", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: "text-blue-500" },
  setor: { border: "group-hover:border-zinc-500/50", shadow: "group-hover:shadow-zinc-900/20", badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: "text-zinc-500" },
  compras: { border: "group-hover:border-purple-500/50", shadow: "group-hover:shadow-purple-900/20", badge: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: "text-purple-500" },
  auxiliar: { border: "group-hover:border-emerald-500/50", shadow: "group-hover:shadow-emerald-900/20", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "text-emerald-500" },
  chefe: { border: "group-hover:border-amber-500/50", shadow: "group-hover:shadow-amber-900/20", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: "text-amber-500" },
  assistente_tecnico: { border: "group-hover:border-indigo-500/50", shadow: "group-hover:shadow-indigo-900/20", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", icon: "text-indigo-500" },
  // Default fallback
  default: { border: "group-hover:border-white/20", shadow: "group-hover:shadow-white/5", badge: "bg-zinc-800 text-zinc-400 border-zinc-700", icon: "text-zinc-500" }
};

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "almoxarife", label: "Almoxarife" },
  { value: "compras", label: "Compras" },
  { value: "setor", label: "Operacional" },
  { value: "auxiliar", label: "Auxiliar" },
  { value: "chefe", label: "Chefe" },
  { value: "assistente_tecnico", label: "Técnico" },
  { value: "engenharia", label: "Engenharia" },
  { value: "prototipo", label: "Protótipo" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
];

const SECTOR_OPTIONS = ["Lavadora", "Flow", "Elétrica", "Esteira", "Usinagem", "Ferro", "Geral"];

// 1. NOVIDADE: Definimos quais cargos precisam exibir a caixinha de Setor
const ROLES_WITH_SECTOR = ["setor", "assistente_tecnico", "chefe", "gerente"];

export default function Users() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  const [roleFilter, setRoleFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "setor", sector: "" });
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string, name: string } | null>(null);
  
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<{ id: string, name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
    refetchInterval: 5000, 
  });

  const filteredUsers = users?.filter((user: any) => 
    roleFilter === "all" ? true : user.role === roleFilter
  );

  // --- MUTAÇÕES ---
  const handleMutationSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    toast.success(message);
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const emailFormatado = data.email.includes("@") ? data.email : `${data.email.trim()}@fluxoroyale.local`;
      // 2. ATUALIZAÇÃO: Verifica se o cargo escolhido exige setor.
      const setorFinal = ROLES_WITH_SECTOR.includes(data.role) ? (data.sector || "Geral") : "Geral";
      await api.post("/auth/register", { ...data, email: emailFormatado, sector: setorFinal });
    },
    onSuccess: () => { handleMutationSuccess("Usuário criado!"); setIsCreateOpen(false); setNewUser({ name: "", email: "", password: "", role: "setor", sector: "" }); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Erro ao criar usuário"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => await api.put(`/users/${id}/role`, { role }),
    onSuccess: () => handleMutationSuccess("Função atualizada!"),
    onError: () => toast.error("Erro ao atualizar função"),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => await api.delete(`/users/${userId}`),
    onSuccess: () => { handleMutationSuccess("Usuário excluído!"); setDeleteDialogOpen(false); setUserToDelete(null); },
    onError: () => toast.error("Erro ao excluir usuário"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (!userToReset || !newPassword) return;
      await api.post("/admin/reset-password", { userId: userToReset.id, newPassword });
    },
    onSuccess: () => { handleMutationSuccess(`Senha de ${userToReset?.name} alterada!`); setResetDialogOpen(false); setNewPassword(""); setUserToReset(null); },
    onError: () => toast.error("Erro ao resetar senha"),
  });

  // --- HELPERS ---
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (/^\d*$/.test(e.target.value)) setNewUser({ ...newUser, email: e.target.value });
  };

  const displayId = (email: string) => email ? email.split('@')[0] : "-";

  const renderStatus = (dateString: string | null) => {
    if (!dateString) return <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500"><span className="w-2 h-2 rounded-full bg-zinc-700"/> Offline</span>;
    const isOnline = Math.abs(differenceInMinutes(new Date(), new Date(dateString))) < 5; // Aumentei tolerância para 5min
    
    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition-all ${isOnline ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-zinc-800/50 text-zinc-500 border-white/5"}`}>
        <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
        {isOnline ? "Online Agora" : formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: ptBR })}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col xl:flex-row justify-between items-end gap-6 bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 backdrop-blur-md">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <UserIcon className="h-8 w-8 text-blue-500" /> Equipe & Acessos
          </h1>
          <p className="text-zinc-400 mt-1 font-light">Gestão de identidade e controle de permissões.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {/* Filtro Glass */}
          <div className="w-full sm:w-[220px]">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full h-12 rounded-xl bg-black/40 border-white/10 text-white focus:ring-blue-500/50">
                <Filter className="w-4 h-4 mr-2 text-blue-400" />
                <SelectValue placeholder="Filtrar por cargo" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                <SelectItem value="all">Todos os Cargos</SelectItem>
                {ROLES.map((role) => (<SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-all hover:scale-105">
            <UserPlus className="h-5 w-5 mr-2" /> Novo Membro
          </Button>
        </div>
      </div>

      {/* GRID DE CARDS (ID BADGE STYLE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? Array.from({length:4}).map((_,i) => <div key={i} className="h-72 rounded-[2rem] bg-zinc-900/30 animate-pulse border border-white/5" />) : 
         filteredUsers?.map((user: any) => {
           const theme = roleThemes[user.role] || roleThemes.default;
           
           return (
            <div key={user.id} className={`group relative bg-zinc-900/40 backdrop-blur-sm rounded-[2rem] p-6 border border-white/5 transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-900/60 ${theme.border} ${theme.shadow} hover:shadow-xl`}>
              
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] pointer-events-none" />

              {/* Menu de Ações (Flutuante) */}
              <div className="absolute top-4 right-4 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-500 hover:text-white hover:bg-white/10">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-950 border-white/10 text-white w-48">
                    <DropdownMenuLabel>Gerenciar {user.name.split(' ')[0]}</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={() => { setUserToReset(user); setResetDialogOpen(true); }}>
                      <KeyRound className="mr-2 h-4 w-4 text-blue-400" /> Resetar Senha
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}
                      disabled={user.id === currentUser?.id}
                      className="text-red-400 focus:text-red-300 focus:bg-red-900/20"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir Conta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Conteúdo do Card */}
              <div className="relative z-10 flex flex-col items-center text-center">
                
                {/* Avatar com Anel de Cargo */}
                <div className="relative mb-4 group-hover:scale-105 transition-transform duration-300">
                  <div className={`absolute -inset-1 rounded-full opacity-20 blur-md group-hover:opacity-40 transition-opacity ${theme.badge.split(' ')[0].replace('bg-', 'bg-')}`} />
                  <Avatar className="h-24 w-24 border-4 border-[#09090b] shadow-2xl">
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${user.name}&background=random&color=fff&bold=true`} />
                    <AvatarFallback className="bg-zinc-800 text-zinc-400 text-2xl font-bold">{user.name.substring(0,2)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-0 right-0 bg-[#09090b] rounded-full p-1 border border-zinc-800">
                    <div className={`p-1.5 rounded-full ${theme.badge}`}>
                      <Shield className="h-3 w-3" />
                    </div>
                  </div>
                </div>

                {/* Info Principal */}
                <h3 className="text-xl font-bold text-white mb-1 truncate w-full" title={user.name}>{user.name}</h3>
                
                <div className="flex items-center gap-2 mb-6">
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <Fingerprint className="h-3 w-3" /> {displayId(user.email)}
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                    <Building2 className="h-3 w-3" /> {user.sector || "Geral"}
                  </span>
                </div>

                {/* Seletor de Cargo (Estilizado) */}
                <div className="w-full mb-4">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1 text-left pl-1">Função</div>
                  <Select 
                    value={user.role} 
                    onValueChange={(value) => updateRoleMutation.mutate({ id: user.id, role: value })} 
                    disabled={user.id === currentUser?.id}
                  >
                    <SelectTrigger className="h-10 w-full bg-black/20 border-white/5 text-sm text-zinc-300 focus:ring-0 hover:bg-black/40 transition-colors">
                      <Briefcase className={`h-4 w-4 mr-2 ${theme.icon}`} />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-white/10 text-white">
                      {ROLES.map((role) => (<SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Footer */}
                <div className="mt-auto pt-4 border-t border-white/5 w-full flex justify-center">
                  {renderStatus(user.last_active)}
                </div>

              </div>
            </div>
           );
         })}
      </div>

      {/* DIALOG DE CRIAÇÃO (MODERNO) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" /> Novo Acesso
            </DialogTitle>
            <DialogDescription className="text-zinc-400">Preencha os dados para criar um novo perfil.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-400">Nome Completo</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <Input className="pl-10 bg-zinc-900 border-white/10 text-white focus:border-blue-500/50" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Ex: João Silva" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">ID (Numérico)</Label>
                <div className="relative">
                  <Fingerprint className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input className="pl-10 bg-zinc-900 border-white/10 text-white font-mono" value={newUser.email} onChange={handleIdChange} placeholder="101" maxLength={6} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input type="password" className="pl-10 bg-zinc-900 border-white/10 text-white" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="******" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Cargo / Função</Label>
              <Select value={newUser.role} onValueChange={v => setNewUser({...newUser, role: v})}>
                <SelectTrigger className="bg-zinc-900 border-white/10 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-white/10 text-white">
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* 3. ATUALIZAÇÃO: Aparece para Técnico, Chefe, Gerente e Setor */}
            {ROLES_WITH_SECTOR.includes(newUser.role) && (
                <div className="space-y-2 animate-in fade-in zoom-in slide-in-from-top-2">
                    <Label className="text-blue-400">Setor da Empresa</Label>
                    <Select value={newUser.sector} onValueChange={v => setNewUser({...newUser, sector: v})}>
                        <SelectTrigger className="bg-blue-500/10 border-blue-500/30 text-white"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/10 text-white">
                            {SECTOR_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="hover:bg-white/10 text-zinc-400">Cancelar</Button>
            <Button onClick={() => createUserMutation.mutate(newUser)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending ? "Criando..." : "Criar Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-zinc-950 border-red-900/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2"><Trash2 className="h-5 w-5"/> Remover Acesso?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Esta ação excluirá permanentemente o usuário <strong>{userToDelete?.name}</strong>. O histórico de logs será mantido para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)} className="bg-red-600 hover:bg-red-700 text-white border-0">Sim, Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG DE RESET DE SENHA */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white">
            <DialogHeader><DialogTitle>Redefinir Credenciais</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
                <Label>Nova Senha Temporária</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-zinc-900 border-white/10 text-white font-mono text-lg tracking-widest" placeholder="••••••" />
            </div>
            <DialogFooter>
                <Button onClick={() => resetPasswordMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold w-full">Confirmar Alteração</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
