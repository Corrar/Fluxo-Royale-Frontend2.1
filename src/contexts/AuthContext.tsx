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
    // Se não houver internet, ignoramos para não causar erros de rede
    if (!navigator.onLine) return;

    if (userProfile.role !== 'almoxarife' && userProfile.role !== 'admin') return;

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const registration = await navigator.serviceWorker.ready;
      
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        console.log('Permissão de notificação negada.');
        return;
      }

      const { data } = await api.get("/notifications/push-key");
      const publicKey = data.publicKey;

      if (!publicKey) throw new Error("Chave VAPID pública não encontrada.");

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey
        });
      }

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
    // Se estiver offline, devolvemos o que já está guardado!
    if (!navigator.onLine) {
       const saved = localStorage.getItem("user_permissions");
       return saved ? JSON.parse(saved) : [];
    }

    try {
      const response = await api.get("/admin/permissions");
      const myPermissions = response.data[role] || [];
      setPermissions(myPermissions);
      localStorage.setItem("user_permissions", JSON.stringify(myPermissions));
      return myPermissions;
    } catch (error: any) {
      console.error("Erro ao buscar permissões:", error);
      // Proteção extra: se a API falhar (ex: servidor caiu), mantemos as locais
      const saved = localStorage.getItem("user_permissions");
      return saved ? JSON.parse(saved) : [];
    }
  };

  // 🔥 CARREGAR SESSÃO NO F5 (AGORA À PROVA DE BALAS PARA OFFLINE)
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

          // 1. Aplica IMEDIATAMENTE os dados guardados (Login Offline)
          setUser(JSON.parse(savedUser));
          setProfile(parsedProfile);
          
          if (savedPermissions) {
             setPermissions(JSON.parse(savedPermissions));
          }

          // 2. Tenta fazer as atualizações em background APENAS se houver internet
          if (navigator.onLine) {
             setupPushNotifications(parsedProfile).catch(() => {});
             fetchUserPermissions(parsedProfile.role).then(perms => {
                 if (perms.length > 0) setPermissions(perms);
             }).catch(() => {});
          }

        } catch (error) {
          console.error("Erro crítico ao restaurar sessão (parse falhou):", error);
          // Removemos o localStorage.clear() daqui para não te expulsar atoa!
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
        // Se estiver offline, nem tenta enviar o pulso para não acumular erros
        if (!navigator.onLine || isHeartbeatRunning.current) return;
        
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
    if (!navigator.onLine) {
      return { error: { message: "Precisas de internet para fazer login a primeira vez." } };
    }

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
