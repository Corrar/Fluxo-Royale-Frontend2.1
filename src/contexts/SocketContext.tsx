import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { Bell, Lock } from 'lucide-react';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  hasUnreadRequests: boolean; 
  unreadCount: number;        
  markRequestsAsRead: () => void;
  requestNotificationPermission: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  hasUnreadRequests: false,
  unreadCount: 0,
  markRequestsAsRead: () => {},
  requestNotificationPermission: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updatePermissions } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // --- ESTADO DO CONTADOR (COM PERSISTÊNCIA) ---
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const saved = localStorage.getItem('@fluxo:unreadCount');
    return saved ? parseInt(saved, 10) : 0;
  });

  const hasUnreadRequests = unreadCount > 0;

  // --- FUNÇÃO DE LIMPEZA ---
  const markRequestsAsRead = () => {
    setUnreadCount(0);
    localStorage.setItem('@fluxo:unreadCount', '0');
  };

  // --- FUNÇÃO INTERNA PARA INCREMENTAR ---
  const incrementCount = () => {
    if (window.location.pathname !== '/requests') {
      setUnreadCount((prev) => {
        const newValue = prev + 1;
        localStorage.setItem('@fluxo:unreadCount', String(newValue));
        return newValue;
      });
    }
  };

  // --- REGISTRAR SERVICE WORKER ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .catch(err => console.error('Falha no SW:', err));
    }
  }, []);

  // --- NOTIFICAÇÃO DO SISTEMA ---
  const sendSystemNotification = async (title: string, body: string) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const urgentVibration = [500, 200, 500, 200, 500];

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration) {
          await registration.showNotification(title, {
            body: body,
            icon: "/favicon.png",
            badge: "/favicon.png",
            tag: "fluxo-alert-" + Date.now(),
            renotify: true,
            requireInteraction: true,
            vibrate: urgentVibration,
            silent: false,
            priority: 2,
            data: { url: '/requests' }
          } as any); 
          return; 
        }
      } catch (e) { console.warn("SW falhou", e); }
    }

    try {
      const notification = new Notification(title, {
        body: body,
        icon: "/favicon.png",
        tag: "fluxo-alert-" + Date.now(),
        renotify: true,
        requireInteraction: true,
        silent: false,
      } as any);
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(urgentVibration);
      }
      
      notification.onclick = function() {
        window.focus();
        window.location.href = '/requests';
        notification.close();
      };
    } catch (e) { console.error("Erro fallback", e); }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        toast.success("Notificações ativadas!");
        sendSystemNotification("Sistema Conectado", "Notificações ativadas.");
      }
    }
  };

  useEffect(() => {
    if (!user || !profile) return;

    const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace('/api', '');
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'], 
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log("✅ Conectado!");
      setIsConnected(true);
      
      if (profile.role) newSocket.emit('join_room', profile.role);
      
      if (profile.role === 'admin') {
          newSocket.emit('join_room', 'almoxarife');
          newSocket.emit('join_room', 'compras');
      }
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    // --- ESCUTAR NOVAS NOTIFICAÇÕES ---
    newSocket.on('new_request_notification', (data: any) => {
      // --- FILTRO DE SEGURANÇA PARA O ALMOXARIFE ---
      if (profile.role === 'almoxarife') {
        // Se a notificação for de "Entrada de Material" (compras), IGNORAR.
        // O backend precisa mandar type: 'entrada' ou isPurchase: true
        if (data.type === 'entrada' || data.type === 'entry' || data.isPurchase) {
           console.log("🙈 Entrada de material ignorada pelo Almoxarife");
           return; 
        }
        // Se for "Nova Solicitação" (pedido de usuário), CONTINUA e notifica!
      }

      incrementCount(); 

      toast(data.message, {
        icon: <Bell className="h-5 w-5 text-blue-500" />,
        action: { label: 'Ver', onClick: () => window.location.href = '/requests' }
      });

      sendSystemNotification("🚨 NOVA SOLICITAÇÃO!", data.message || "Novo pedido pendente.");
    });

    // Evento genérico (também aplica o filtro)
    newSocket.on('new_request', (data: any) => {
       if (profile.role === 'almoxarife') {
          // Filtra aqui também se o backend enviar dados
          if (data && (data.type === 'entrada' || data.type === 'entry')) return;
       }
       incrementCount(); 
    });

    newSocket.on('permissions_updated', (newPermissions: string[]) => {
      updatePermissions(newPermissions);
      toast.info("Permissões atualizadas.");
    });

    return () => {
      newSocket.disconnect();
      setIsConnected(false);
    };
  }, [user, profile]);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      isConnected, 
      hasUnreadRequests, 
      unreadCount, 
      markRequestsAsRead, 
      requestNotificationPermission 
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
