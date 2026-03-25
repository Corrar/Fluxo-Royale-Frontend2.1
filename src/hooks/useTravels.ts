// ficheiro: src/hooks/useTravels.ts

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Travel } from '../types/travel';
import { toast } from 'sonner';
import { useSocket } from '../contexts/SocketContext';
// ✨ IMPORTAÇÃO DA MAGIA OFFLINE E DO COFRE
import { apiWithOfflineFallback, getOfflineActions } from '../utils/offlineSync';

export function useTravels() {
  const { profile, canAccess } = useAuth();
  const { socket } = useSocket(); 
  const [travels, setTravels] = useState<Travel[]>([]);
  const [loading, setLoading] = useState(true);

  // =========================================================================
  // ✨ QUEM É ESTE UTILIZADOR?
  // =========================================================================
  const isTecnico = profile?.role === 'assistente_tecnico' || profile?.role === 'setor';
  const isAdminOrLeader = profile?.role === 'admin' || (canAccess('viagens_externas') && !isTecnico);

  // =========================================================================
  // ✨ FUNÇÃO MESTRA: ATUALIZA TELA E LOCALSTORAGE EM SIMULTÂNEO
  // =========================================================================
  const updateLocalTravels = useCallback((updater: (prev: Travel[]) => Travel[]) => {
    setTravels(prev => {
      const nextState = updater(prev);
      // Guarda imediatamente a versão mais recente no telemóvel para aguentar o F5!
      localStorage.setItem('@FluxoRoyale:travels', JSON.stringify(nextState));
      return nextState;
    });
  }, []);

  // =========================================================================
  // 1. FUNÇÃO PARA BUSCAR E FILTRAR (COM ESCUDO OFFLINE)
  // =========================================================================
  const fetchTravels = useCallback(async () => {
    // 🛡️ PROTEÇÃO CRÍTICA: Não carrega viagens sem saber quem é o utilizador! (Evita tela limpa no F5)
    if (!profile) return; 

    try {
      // 🛡️ ESCUDO: Se estamos offline ou temos coisas no cofre, usamos SÓ os dados locais!
      const pendingActions = await getOfflineActions();
      const hasPending = pendingActions.some(a => a.url.includes('/travels'));

      if (!navigator.onLine || hasPending) {
        const cachedData = localStorage.getItem('@FluxoRoyale:travels');
        if (cachedData) {
           let parsed = JSON.parse(cachedData);
           
           // ✨ CORREÇÃO CRÍTICA: Filtragem usando String() para evitar que os cartões desapareçam
           if (!isAdminOrLeader) {
             parsed = parsed.filter((travel: any) => {
               const isAssigned = travel.technicians?.some((tech: any) => String(tech.user_id) === String(profile?.id));
               const isCreator = String(travel.created_by) === String(profile?.id);
               return isAssigned || isCreator;
             });
           }
           setTravels(parsed);
        }
        setLoading(false);
        return; // ABORTA A CHAMADA À API PARA NÃO LER CACHE VELHO E PERDER AS TAREFAS!
      }

      // Se há internet E o cofre está vazio, busca dados frescos do servidor:
      const response = await api.get('/travels');
      let allTravels: Travel[] = response.data;

      // ✨ CORREÇÃO CRÍTICA ONLINE: Mesma lógica de segurança com String()
      if (!isAdminOrLeader) {
        allTravels = allTravels.filter(travel => {
          const isAssigned = travel.technicians?.some(
            (tech: any) => String(tech.user_id) === String(profile?.id)
          );
          const isCreator = String(travel.created_by) === String(profile?.id);
          return isAssigned || isCreator;
        });
      }

      setTravels(allTravels);
      localStorage.setItem('@FluxoRoyale:travels', JSON.stringify(allTravels));

    } catch (error: any) {
      // ✨ SEGURANÇA EXTRA: Se o servidor falhar, também usamos a cache com a correção String()
      const cachedData = localStorage.getItem('@FluxoRoyale:travels');
      if (cachedData) {
         let parsed = JSON.parse(cachedData);
         if (!isAdminOrLeader) {
           parsed = parsed.filter((travel: any) => {
             const isAssigned = travel.technicians?.some((tech: any) => String(tech.user_id) === String(profile?.id));
             const isCreator = String(travel.created_by) === String(profile?.id);
             return isAssigned || isCreator;
           });
         }
         setTravels(parsed);
      } else {
         toast.error('Erro ao buscar as viagens.');
      }
    } finally {
      setLoading(false);
    }
  }, [profile, isAdminOrLeader]);

  useEffect(() => {
    if (profile) {
      setLoading(true);
      fetchTravels();
    }
  }, [profile, fetchTravels]);

  useEffect(() => {
    const handleSync = () => fetchTravels();
    window.addEventListener('offline_sync_completed', handleSync);
    return () => window.removeEventListener('offline_sync_completed', handleSync);
  }, [fetchTravels]);

  useEffect(() => {
    if (!socket) return;
    socket.on('travel_board_updated', fetchTravels);
    return () => socket.off('travel_board_updated', fetchTravels);
  }, [socket, fetchTravels]);

  // =========================================================================
  // 2. MUTAÇÕES BLINDADAS COM `updateLocalTravels`
  // =========================================================================

  const createTravel = async (title: string, description: string, priority?: string, checklists?: any[], tags?: any[], imageUrl?: string, dueDate?: Date, listId?: string) => {
    const tempId = crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`;
    // ✨ CORREÇÃO DA COLUNA: Agora vai para o 'list-todo' para não desaparecer do quadro!
    const newTravel: any = {
      id: tempId, title, description, priority, checklists, tags, imageUrl, dueDate, 
      listId: listId || 'list-todo', status: listId || 'list-todo', created_by: profile?.id, technicians: []
    };

    updateLocalTravels(prev => [...prev, newTravel]);

    try {
      const payload = { title, description, priority, checklists, tags, imageUrl, dueDate, listId };
      const res = await apiWithOfflineFallback('POST', '/travels', payload, 'geral', tempId);
      
      if (res.offline) toast.info('Viagem guardada offline. Será enviada quando a net voltar!');
      else { toast.success('Viagem criada com sucesso!'); fetchTravels(); }
    } catch (error) {
      toast.error('Erro ao criar a viagem.');
      updateLocalTravels(prev => prev.filter(t => t.id !== tempId)); 
    }
  };

  const updateTravel = async (id: string, updates: Partial<Travel>) => {
    updateLocalTravels(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    try {
      const res = await apiWithOfflineFallback('PUT', `/travels/${id}`, updates, 'geral', id);
      if (res.offline) toast.info('Atualizações guardadas offline.');
      else fetchTravels(); 
    } catch (error) {
      fetchTravels(); 
    }
  };

  const deleteTravel = async (id: string) => {
    updateLocalTravels(prev => prev.filter(t => t.id !== id));

    try {
      const res = await apiWithOfflineFallback('DELETE', `/travels/${id}`, {}, 'geral', id);
      if (res.offline) toast.info('Eliminação agendada (Modo Offline).');
      else { toast.success('Viagem excluída com sucesso.'); fetchTravels(); }
    } catch (error) {
      fetchTravels(); 
    }
  };

  const updateTravelStatus = async (id: string, newStatus: string) => {
    updateLocalTravels(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, listId: newStatus } : t));
    
    try {
      const res = await apiWithOfflineFallback('PUT', `/travels/${id}/status`, { status: newStatus }, 'geral', id);
      if (res.offline) toast.warning('Sem internet: Movimento guardado no dispositivo.');
    } catch (error) {
      fetchTravels(); 
    }
  };

  const assignTraveler = async (travelId: string, userId: string) => {
    updateLocalTravels(prev => prev.map(t => {
      if (t.id === travelId) {
         const exists = t.technicians?.some((tech: any) => String(tech.user_id) === String(userId));
         if (!exists) return { ...t, technicians: [...(t.technicians || []), { user_id: userId, travel_id: travelId }] };
      }
      return t;
    }));

    try {
      const res = await apiWithOfflineFallback('POST', `/travels/${travelId}/technicians`, { user_id: userId }, 'geral', travelId);
      if (res.offline) toast.info('Atribuição guardada offline.');
      if (!res.offline) fetchTravels();
    } catch (error) {
      toast.error('Erro ao adicionar o viajante.');
    }
  };

  const removeTraveler = async (travelId: string, userId: string) => {
    updateLocalTravels(prev => prev.map(t => {
      if (t.id === travelId) return { ...t, technicians: t.technicians?.filter((tech: any) => String(tech.user_id) !== String(userId)) };
      return t;
    }));

    try {
      const res = await apiWithOfflineFallback('DELETE', `/travels/${travelId}/technicians/${userId}`, {}, 'geral', travelId);
      if (res.offline) toast.info('Remoção guardada offline.');
      if (!res.offline) fetchTravels();
    } catch (error) {
      toast.error('Erro ao remover o viajante.');
    }
  };

  const toggleChecklistItem = async (travelId: string, itemId: string, groupId: string) => {
    updateLocalTravels(prev => prev.map(t => {
      if (t.id === travelId) {
        const newChecklists = t.checklists?.map((g: any) => {
          if (g.id === groupId) {
            return { ...g, items: g.items.map((i: any) => i.id === itemId ? { ...i, completed: !i.completed } : i) };
          }
          return g;
        });
        return { ...t, checklists: newChecklists };
      }
      return t;
    }));

    try {
      const res = await apiWithOfflineFallback('PUT', `/travels/${travelId}/checklist/${groupId}/item/${itemId}/toggle`, {}, 'checklist', travelId);
      if (res.offline) toast.info('Tarefa guardada localmente!');
    } catch (error) {
      toast.error('Erro ao sincronizar a tarefa.');
      fetchTravels(); 
    }
  };

  // =========================================================================
  // 3. RELÓGIO DE PONTO 
  // =========================================================================

  const clockIn = async (travelId: string, location?: {lat: number, lng: number}) => {
    const tempLog = { id: 'offline-log-in', travel_id: travelId, user_id: profile?.id, check_in: new Date().toISOString(), check_in_lat: location?.lat, check_in_lng: location?.lng };
    
    updateLocalTravels(prev => prev.map(t => {
       if (t.id === travelId) return { ...t, time_logs: [...(t.time_logs || []), tempLog] };
       return t;
    }));

    try {
      const res = await apiWithOfflineFallback('POST', `/travels/${travelId}/checkin`, location, 'ponto', travelId);
      if (res.offline) {
         toast.success('Ponto de Entrada guardado no Modo Offline!');
         return tempLog;
      }
      toast.success('Entrada registada com sucesso!');
      fetchTravels();
      return res.data; 
    } catch (error) {
      throw error; 
    }
  };

  const clockOut = async (travelId: string, location?: {lat: number, lng: number}) => {
    const tempOutTime = new Date().toISOString();

    updateLocalTravels(prev => prev.map(t => {
       if (t.id === travelId) {
          return { ...t, time_logs: t.time_logs?.map((l: any) => (!l.check_out && String(l.user_id) === String(profile?.id)) ? { ...l, check_out: tempOutTime } : l) };
       }
       return t;
    }));

    try {
      const res = await apiWithOfflineFallback('POST', `/travels/${travelId}/checkout`, location, 'ponto', travelId);
      if (res.offline) {
         toast.success('Ponto de Saída guardado no Modo Offline!');
         return { id: 'offline-log-out', travel_id: travelId, user_id: profile?.id, check_out: tempOutTime };
      }
      toast.success('Saída registada com sucesso!');
      fetchTravels();
      return res.data; 
    } catch (error: any) {
      throw error; 
    }
  };

  return { 
    travels, loading, fetchTravels, createTravel, updateTravel, deleteTravel,
    updateTravelStatus, assignTraveler, removeTraveler, toggleChecklistItem, 
    clockIn, clockOut, isAdminOrLeader, userId: profile?.id
  };
}
