// ficheiro: src/hooks/useTravels.ts

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Travel } from '../types/travel';
import { toast } from 'sonner';
import { useSocket } from '../contexts/SocketContext';
// ✨ IMPORTAÇÃO DA MAGIA OFFLINE
import { apiWithOfflineFallback } from '../utils/offlineSync';

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
  // 1. FUNÇÃO PARA BUSCAR E FILTRAR (COM CACHE OFFLINE)
  // =========================================================================
  const fetchTravels = useCallback(async () => {
    try {
      const response = await api.get('/travels');
      let allTravels: Travel[] = response.data;

      if (!isAdminOrLeader) {
        allTravels = allTravels.filter(travel => {
          const isAssigned = travel.technicians?.some(
            (tech: any) => tech.user_id === profile?.id
          );
          const isCreator = travel.created_by === profile?.id;
          return isAssigned || isCreator;
        });
      }

      setTravels(allTravels);
      
      // ✨ GUARDA A "FOTOGRAFIA" MAIS RECENTE NO TELEMÓVEL
      localStorage.setItem('@FluxoRoyale:travels', JSON.stringify(allTravels));

    } catch (error: any) {
      // ✨ SE FALHAR A INTERNET, VAI BUSCAR A FOTOGRAFIA
      if (!navigator.onLine || error.message === 'Network Error') {
        const cachedData = localStorage.getItem('@FluxoRoyale:travels');
        if (cachedData) {
           setTravels(JSON.parse(cachedData));
           toast.warning('Modo Offline: A mostrar dados guardados no dispositivo.', { duration: 4000 });
        } else {
           toast.error('Sem internet e sem dados guardados. Conecte-se para sincronizar.');
        }
      } else {
        toast.error('Erro ao buscar as viagens.');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  }, [profile, isAdminOrLeader]);

  // Busca inicial
  useEffect(() => {
    if (profile) {
      setLoading(true);
      fetchTravels();
    }
  }, [profile, fetchTravels]);

  // =========================================================================
  // ✨ RECARREGAR AUTOMATICAMENTE QUANDO A INTERNET VOLTA
  // =========================================================================
  useEffect(() => {
    const handleSync = () => fetchTravels();
    window.addEventListener('offline_sync_completed', handleSync);
    return () => window.removeEventListener('offline_sync_completed', handleSync);
  }, [fetchTravels]);

  // =========================================================================
  // ✨ ATUALIZAÇÃO EM TEMPO REAL VIA SOCKET
  // =========================================================================
  useEffect(() => {
    if (!socket) return;
    socket.on('travel_board_updated', fetchTravels);
    return () => {
      socket.off('travel_board_updated', fetchTravels);
    };
  }, [socket, fetchTravels]);

  // =========================================================================
  // 2. MUTAÇÕES COM SUPORTE OFFLINE E ATUALIZAÇÃO OTIMISTA
  // =========================================================================

  const createTravel = async (title: string, description: string, priority?: string, checklists?: any[], tags?: any[], imageUrl?: string, dueDate?: Date, listId?: string) => {
    // 🚀 OTIMISTA: Cria um ID temporário e mostra o cartão na tela imediatamente!
    const tempId = crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`;
    const newTravel: any = {
      id: tempId,
      title, description, priority, checklists, tags, imageUrl, dueDate, 
      listId: listId || 'Pendente',
      status: listId || 'Pendente',
      created_by: profile?.id,
      technicians: []
    };

    setTravels(prev => [...prev, newTravel]);

    try {
      const payload = { title, description, priority, checklists, tags, imageUrl, dueDate, listId };
      // ✨ CORREÇÃO AQUI: Passamos o tempId para o cofre, para que o Tradutor Mágico saiba quem ele é!
      const res = await apiWithOfflineFallback('POST', '/travels', payload, 'geral', tempId);
      
      if (res.offline) {
        toast.info('Viagem guardada offline. Será criada assim que a internet voltar!');
      } else {
        toast.success('Viagem criada com sucesso!');
        fetchTravels(); // Só vai buscar ao servidor se tiver internet
      }
    } catch (error) {
      toast.error('Erro ao criar a viagem.');
      setTravels(prev => prev.filter(t => t.id !== tempId)); // Reverte visualmente se der erro
    }
  };

  const updateTravel = async (id: string, updates: Partial<Travel>) => {
    // 🚀 OTIMISTA: Atualiza o texto na tela imediatamente
    setTravels(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    try {
      const res = await apiWithOfflineFallback('PUT', `/travels/${id}`, updates, 'geral', id);
      if (res.offline) {
        toast.info('Atualizações guardadas offline.');
      } else {
        fetchTravels(); // Só atualiza a lista se estiver online
      }
    } catch (error) {
      toast.error('Erro ao atualizar a viagem.');
      fetchTravels(); // Reverte
    }
  };

  const deleteTravel = async (id: string) => {
    // 🚀 OTIMISTA: Remove o cartão da tela imediatamente
    setTravels(prev => prev.filter(t => t.id !== id));

    try {
      const res = await apiWithOfflineFallback('DELETE', `/travels/${id}`, {}, 'geral', id);
      if (res.offline) {
        toast.info('Eliminação agendada (Modo Offline).');
      } else {
        toast.success('Viagem excluída com sucesso.');
        fetchTravels();
      }
    } catch (error) {
      toast.error('Erro ao excluir a viagem.');
      fetchTravels(); // Reverte
    }
  };

  const updateTravelStatus = async (id: string, newStatus: string) => {
    // 🚀 OTIMISTA: Move o cartão na hora na tela!
    setTravels(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, listId: newStatus } : t));
    
    try {
      const res = await apiWithOfflineFallback('PUT', `/travels/${id}/status`, { status: newStatus }, 'geral', id);
      if (res.offline) toast.warning('Sem internet: Movimento guardado no dispositivo.');
    } catch (error) {
      toast.error('Erro ao mover a viagem. A reverter...');
      fetchTravels(); // Reverte visualmente caso dê erro no servidor
    }
  };

  const assignTraveler = async (travelId: string, userId: string) => {
    try {
      const res = await apiWithOfflineFallback('POST', `/travels/${travelId}/technicians`, { user_id: userId }, 'geral', travelId);
      if (res.offline) toast.info('Atribuição guardada offline.');
      if (!res.offline) fetchTravels(); // Evita recarregar a tela atoa se estiver offline
    } catch (error) {
      toast.error('Erro ao adicionar o viajante.');
    }
  };

  const removeTraveler = async (travelId: string, userId: string) => {
    try {
      const res = await apiWithOfflineFallback('DELETE', `/travels/${travelId}/technicians/${userId}`, {}, 'geral', travelId);
      if (res.offline) toast.info('Remoção guardada offline.');
      if (!res.offline) fetchTravels();
    } catch (error) {
      toast.error('Erro ao remover o viajante.');
    }
  };

  const toggleChecklistItem = async (travelId: string, itemId: string, groupId: string) => {
    // 🚀 OTIMISTA: Assinala como feito instantaneamente!
    setTravels(prev => prev.map(t => {
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
      fetchTravels(); // Reverte
    }
  };

  // =========================================================================
  // 3. RELÓGIO DE PONTO (COM RETORNO FANTASMA OFFLINE)
  // =========================================================================

  const clockIn = async (travelId: string, location?: {lat: number, lng: number}) => {
    try {
      const res = await apiWithOfflineFallback('POST', `/travels/${travelId}/checkin`, location, 'ponto', travelId);
      
      if (res.offline) {
         toast.success('Ponto de Entrada guardado no Modo Offline!');
         // Retornar um "fantasma" para o Modal atualizar logo na hora
         return { id: 'offline-log-in', travel_id: travelId, user_id: profile?.id, check_in: new Date().toISOString(), check_in_lat: location?.lat, check_in_lng: location?.lng };
      }
      
      toast.success('Entrada registada com sucesso!');
      fetchTravels();
      return res.data; 
    } catch (error) {
      toast.error('Erro ao registar entrada.');
      throw error; 
    }
  };

  const clockOut = async (travelId: string, location?: {lat: number, lng: number}) => {
    try {
      const res = await apiWithOfflineFallback('POST', `/travels/${travelId}/checkout`, location, 'ponto', travelId);
      
      if (res.offline) {
         toast.success('Ponto de Saída guardado no Modo Offline!');
         return { id: 'offline-log-out', travel_id: travelId, user_id: profile?.id, check_out: new Date().toISOString() };
      }
      
      toast.success('Saída registada com sucesso!');
      fetchTravels();
      return res.data; 
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao registar saída.');
      throw error; 
    }
  };

  return { 
    travels, 
    loading, 
    fetchTravels, 
    createTravel,
    updateTravel,
    deleteTravel,
    updateTravelStatus, 
    assignTraveler, 
    removeTraveler,
    toggleChecklistItem, 
    clockIn,
    clockOut,
    isAdminOrLeader, 
    userId: profile?.id
  };
}
