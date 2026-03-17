import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { toast } from "sonner";

// --- TIPAGEM DE CARGOS ---
type UserRole = 
  | "admin" 
  | "almoxarife" 
  | "setor" 
  | "compras" 
  | "auxiliar" 
  | "chefe" 
  | "assistente_tecnico"
  | "engenharia"
  | "prototipo"
  | "gerente"
  | "desenvolvimento";

interface User {
  id: string;
  email: string;
}

interface Profile {
  id: string;
  name: string;
  role: UserRole;
  sector: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  permissions: string[];
  loading: boolean;
  canAccess: (pageKey: string) => boolean;
  updatePermissions: (newPermissions: string[]) => void;
  signIn: (id: string, password: string) => Promise<{ error: any }>;
  signUp: (
    id: string,
    password: string,
    name: string,
    role: UserRole,
    sector?: string
  ) => Promise<{ error: any }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isHeartbeatRunning = useRef(false);

  // ========================================================================
  // 🔔 LÓGICA DE NOTIFICAÇÕES PUSH (ROBUSTA)
  // ========================================================================
  const setupPushNotifications = async (userProfile: Profile) => {
    // Apenas Almoxarifes e Admins precisam receber alertas
    if (userProfile.role !== 'almoxarife' && userProfile.role !== 'admin') return;

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      // Aguarda o Service Worker estar pronto (registrado no App.tsx)
      const registration = await navigator.serviceWorker.ready;
      
      // Verifica permissão atual
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        console.log('Permissão de notificação negada.');
        return;
      }

      // Obtém a chave pública VAPID do servidor
      const { data } = await api.get("/notifications/push-key");
      const publicKey = data.publicKey;

      if (!publicKey) throw new Error("Chave VAPID pública não encontrada.");

      // Tenta recuperar subscrição existente ou cria uma nova
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey
        });
      }

      // Envia a subscrição para o backend salvar
      await api.post("/notifications/subscribe", {
        profileId: userProfile.id,
        subscription
      });

      console.log("📢 Notificações Push ativadas com sucesso.");
    } catch (error) {
      console.error("Falha ao configurar Push Notifications:", error);
    }
  };

  // --- BUSCAR PERMISSÕES ---
  const fetchUserPermissions = async (role: string) => {
    try {
      const response = await api.get("/admin/permissions");
      const myPermissions = response.data[role] || [];
      setPermissions(myPermissions);
      localStorage.setItem("user_permissions", JSON.stringify(myPermissions));
      return myPermissions;
    } catch (error) {
      console.error("Erro ao buscar permissões:", error);
      return [];
    }
  };

  // 🔥 CARREGAR SESSÃO NO F5
  useEffect(() => {
    const loadSession = async () => {
      const token = localStorage.getItem("auth_token");
      const savedUser = localStorage.getItem("user_data");
      const savedProfile = localStorage.getItem("user_profile");
      const savedPermissions = localStorage.getItem("user_permissions");

      if (token && savedUser && savedProfile) {
        try {
          api.defaults.headers.Authorization = `Bearer ${token}`;
          const parsedProfile = JSON.parse(savedProfile);

          setUser(JSON.parse(savedUser));
          setProfile(parsedProfile);
          
          // Tenta reativar as notificações silenciosamente ao recarregar a página
          setupPushNotifications(parsedProfile);
          
          if (savedPermissions) {
             setPermissions(JSON.parse(savedPermissions));
             // Atualiza permissões em background para garantir sincronia
             fetchUserPermissions(parsedProfile.role); 
          } else {
             await fetchUserPermissions(parsedProfile.role);
          }
        } catch (error) {
          console.error("Erro ao restaurar sessão:", error);
          localStorage.clear();
        }
      }
      setLoading(false);
    };
    loadSession();
  }, []);

  // ⏱️ HEARTBEAT
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (user && profile) {
      const sendHeartbeat = async () => {
        if (isHeartbeatRunning.current) return;
        isHeartbeatRunning.current = true;
        try {
          await api.put(`/users/${profile.id}/heartbeat`, {}, { skipLoading: true } as any);
        } catch (error) {
          // Silencioso
        } finally {
          isHeartbeatRunning.current = false;
        }
      };
      sendHeartbeat();
      intervalId = setInterval(sendHeartbeat, 60000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user, profile]);

  const canAccess = (pageKey: string) => {
    if (profile?.role === 'admin') return true;
    return permissions.includes(pageKey);
  };

  const updatePermissions = (newPermissions: string[]) => {
    setPermissions(newPermissions);
    localStorage.setItem("user_permissions", JSON.stringify(newPermissions));
  };

  // 🔥 LOGIN
  const signIn = async (id: string, password: string) => {
    setLoading(true);
    try {
      const email = id.includes("@") ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@fluxoroyale.local`;
      const response = await api.post("/auth/login", { email, password });
      const { token, user, profile } = response.data;

      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_data", JSON.stringify(user));
      localStorage.setItem("user_profile", JSON.stringify(profile));
      api.defaults.headers.Authorization = `Bearer ${token}`;

      setUser(user);
      setProfile(profile);
      
      // REGISTRA NOTIFICAÇÕES LOGO APÓS LOGIN BEM-SUCEDIDO
      await setupPushNotifications(profile);
      await fetchUserPermissions(profile.role);

      navigate("/inicio");
      return { error: null };
    } catch (error: any) {
      const msg = error.response?.data?.error || "Erro ao conectar com o servidor";
      return { error: { message: msg } };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (id: string, password: string, name: string, role: UserRole, sector?: string) => {
    toast.error("Cadastro desabilitado.");
    return { error: { message: "Funcionalidade restrita" } };
  };

  const signOut = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.clear();
      delete api.defaults.headers.Authorization;
      setUser(null);
      setProfile(null);
      setPermissions([]);
      navigate("/auth");
      setLoading(false);
    }, 500);
  };

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading, canAccess, updatePermissions, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
