import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api"; 
import { CardData, Priority, ChecklistItem, Tag, ChecklistGroup } from "@/types/card";
import { useSocket } from "@/contexts/SocketContext"; 
import { useEffect } from "react";
import { toast } from "sonner";

// ✨ IMPORTANTE: Importamos o nosso Fallback Offline
import { apiWithOfflineFallback } from '@/utils/offlineSync';

export function useEletricaCards() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // 1. BUSCAR AS LISTAS (COLUNAS DO KANBAN)
  // (Em modo offline, o Service Worker serve a cache disto automaticamente)
  const { data: rawLists = [] } = useQuery({
    queryKey: ["eletrica_lists"],
    queryFn: async () => {
      try {
        const res = await api.get('/eletrica-tasks/lists');
        if (res.data && res.data.length > 0) return res.data;
        return [
          { id: 'list-todo', title: '⏳ A Fazer', position: 1 },
          { id: 'list-done', title: '✅ Concluído', position: 2 }
        ];
      } catch (error) {
        return [
          { id: 'list-todo', title: '⏳ A Fazer', position: 1 },
          { id: 'list-done', title: '✅ Concluído', position: 2 }
        ];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  // 2. BUSCAR OS CARTÕES
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["eletrica_tasks"],
    queryFn: async () => {
      const res = await api.get('/eletrica-tasks');
      return res.data.map((task: any) => {
        const rawChecklist = task.checklist || [];
        const isNewFormat = rawChecklist.length > 0 && rawChecklist[0].assignedToId !== undefined;

        return {
          ...task,
          checklists: isNewFormat ? rawChecklist : [], 
          checklist: !isNewFormat ? rawChecklist : [], 
          tags: task.tags || [],
          imageUrl: task.imageUrl || null,
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          createdAt: new Date(task.createdAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
          listId: task.listId || 'list-todo',
          comments: task.comments || []
        };
      });
    },
    staleTime: 1000 * 60 * 5, 
  });

  // 3. SOCKET IO
  useEffect(() => {
    if (!socket) return;
    socket.on("eletrica_board_updated", () => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["eletrica_lists"] });
    });
    return () => {
      socket.off("eletrica_board_updated");
    };
  }, [socket, queryClient]);

  // 4. MUTAÇÕES DE CARTÕES COM MODO OFFLINE ✨
  const createMutation = useMutation({
    mutationFn: async (newTask: any) => {
      const payload = { ...newTask };
      if (payload.checklists) {
        payload.checklist = payload.checklists;
        delete payload.checklists;
      }
      
      // SUBSTITUÍDO: api.post por apiWithOfflineFallback
      return await apiWithOfflineFallback('POST', '/eletrica-tasks', payload, 'criar_cartao_eletrica', 'geral');
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
      if (resultado && resultado.offline) {
        toast.warning("Sem rede. Cartão guardado no telemóvel e será enviado depois!");
      } else {
        toast.success("Cartão criado!");
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Erro ao salvar o cartão.");
    }
  });

  // ====================================================================
  // MAGIA: ATUALIZAÇÃO OTIMISTA 100% OFFLINE SAFE ✨
  // ====================================================================
  const updateMutation = useMutation({
    mutationFn: async ({ id, data, logAction, logDetails }: any) => {
      const payload = { ...data };
      if (payload.checklists !== undefined) {
        payload.checklist = payload.checklists;
        delete payload.checklists;
      }
      if (logAction) payload.logAction = logAction;
      if (logDetails) payload.logDetails = logDetails;
      
      // SUBSTITUÍDO: api.put por apiWithOfflineFallback
      // Como isto devolve "sucesso" mesmo quando estamos offline, a alteração visual nunca é revertida erradamente!
      return await apiWithOfflineFallback('PUT', `/eletrica-tasks/${id}`, payload, 'atualizar_cartao_eletrica', id);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["eletrica_tasks"] });
      const previousCards = queryClient.getQueryData(["eletrica_tasks"]);
      
      queryClient.setQueryData(["eletrica_tasks"], (old: any) => {
        if (!old) return old;
        return old.map((card: any) => 
          card.id === variables.id ? { ...card, ...variables.data } : card
        );
      });
      
      return { previousCards };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(["eletrica_tasks"], context?.previousCards);
      toast.error("Falha fatal ao atualizar o cartão.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // SUBSTITUÍDO: api.delete por apiWithOfflineFallback
      return await apiWithOfflineFallback('DELETE', `/eletrica-tasks/${id}`, {}, 'deletar_cartao_eletrica', id);
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
      if (resultado && resultado.offline) {
        toast.warning("Offline. Exclusão agendada.");
      } else {
        toast.success("Cartão excluído.");
      }
    }
  });

  // 5. MUTAÇÕES DE LISTAS COM MODO OFFLINE ✨
  const createListMutation = useMutation({
    mutationFn: async (newList: any) => {
      return await apiWithOfflineFallback('POST', '/eletrica-tasks/lists', newList, 'criar_lista_eletrica', 'geral');
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_lists"] });
      if (resultado && resultado.offline) toast.warning("Offline. Lista será criada mais tarde.");
      else toast.success("Nova lista criada!");
    },
    onError: () => toast.error("Erro ao criar lista!")
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiWithOfflineFallback('DELETE', `/eletrica-tasks/lists/${id}`, {}, 'deletar_lista_eletrica', id);
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ["eletrica_lists"] });
      queryClient.invalidateQueries({ queryKey: ["eletrica_tasks"] });
      if (resultado && resultado.offline) toast.warning("Offline. Exclusão da lista agendada.");
      else toast.success("Lista e cartões excluídos.");
    },
    onError: () => toast.error("Erro ao excluir lista.")
  });

  // --- FUNÇÕES DE INTERFACE ---
  
  const addList = (title: string) => {
    createListMutation.mutate({ id: `list-${Date.now()}`, title, position: rawLists.length });
  };

  const deleteList = (id: string) => {
    deleteListMutation.mutate(id);
  };

  const addCard = (
    title: string, description: string, priority: Priority, 
    checklists: ChecklistGroup[], tags: Tag[] = [], imageUrl?: string, dueDate?: Date, listId?: string
  ) => {
    createMutation.mutate({
      // Adicionamos um ID temporário super importante para uso offline
      id: `temp-${Date.now()}`,
      title, description, priority, checklists, tags, imageUrl, dueDate,
      listId: listId || 'list-todo',
      category: 'blue',
      completed: false,
    }); 
  };

  // ====================================================================
  // AUDITORIA APLICADA NA EDIÇÃO (COM DETALHES EXTREMOS / DIFF)
  // ====================================================================
  const updateCard = (
    id: string, title: string, description: string, priority: Priority, 
    checklists: ChecklistGroup[], tags: Tag[] = [], imageUrl?: string, dueDate?: Date, listId?: string
  ) => {
    // 1. Encontra o cartão original antes de ser alterado
    const oldCard = cards.find((c: CardData) => c.id === id);
    const alteracoes: Record<string, string> = {};

    // 2. Compara o Antes e o Depois e regista apenas o que mudou
    if (oldCard) {
      if (oldCard.title !== title) alteracoes.titulo = `De "${oldCard.title}" para "${title}"`;
      if (oldCard.priority !== priority) alteracoes.prioridade = `De "${oldCard.priority}" para "${priority}"`;
      if (oldCard.description !== description) alteracoes.descricao = "A descrição foi modificada.";
      
      const oldDateStr = oldCard.dueDate ? new Date(oldCard.dueDate).toLocaleDateString() : 'Nenhum';
      const newDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : 'Nenhum';
      if (oldDateStr !== newDateStr) alteracoes.prazo = `De [${oldDateStr}] para [${newDateStr}]`;
    }

    updateMutation.mutate({ 
      id, 
      data: { title, description, priority, checklists, tags, imageUrl, dueDate, listId },
      logAction: 'UPDATE_TASK_ELETRICA',
      logDetails: { 
        tarefa_alvo: oldCard?.title || title, 
        mudancas_efetuadas: Object.keys(alteracoes).length > 0 ? alteracoes : "Alteração estrutural (Checklists/Tags/Membros/Capa)"
      }
    });
  };

  const deleteCard = (id: string) => deleteMutation.mutate(id);

  const duplicateCard = (id: string) => {
    const cardToDuplicate = cards.find((c: CardData) => c.id === id);
    if (cardToDuplicate) {
      const newChecklists = cardToDuplicate.checklists
        ? cardToDuplicate.checklists.map((g: any) => ({ ...g, items: g.items.map((i: any) => ({...i, completed: false})) }))
        : [];
      
      addCard(
        `${cardToDuplicate.title} (Cópia)`,
        cardToDuplicate.description, cardToDuplicate.priority,
        newChecklists,
        cardToDuplicate.tags || [], cardToDuplicate.imageUrl, cardToDuplicate.dueDate, (cardToDuplicate as any).listId
      );
    }
  };

  const toggleChecklistItem = (cardId: string, itemId: string, groupId?: string) => {
    const card = cards.find((c: CardData) => c.id === cardId);
    if (!card) return;

    let logAction = '';
    let logDetails = null;

    if (groupId && card.checklists) {
      const newChecklists = card.checklists.map((group: any) => {
        if (group.id === groupId) {
          return {
            ...group,
            items: group.items.map((item: any) => {
              if (item.id === itemId) {
                const isNowCompleted = !item.completed;
                logAction = isNowCompleted ? 'CHECKLIST_COMPLETED' : 'CHECKLIST_UNCHECKED';
                logDetails = { item_text: item.text, assigned_to: group.assignedToName, status: isNowCompleted ? 'Concluído' : 'Pendente' };
                return { ...item, completed: isNowCompleted };
              }
              return item;
            })
          };
        }
        return group;
      });
      updateMutation.mutate({ id: cardId, data: { checklists: newChecklists }, logAction, logDetails });
    }
  };

  const toggleCardCompleted = (id: string) => {
    const card = cards.find((c: CardData) => c.id === id);
    if (!card) return;
    updateMutation.mutate({ 
      id, 
      data: { completed: !card.completed },
      logAction: !card.completed ? 'CARD_COMPLETED' : 'CARD_REOPENED',
      logDetails: { title: card.title }
    });
  };

  // AUDITORIA APLICADA NA MOVIMENTAÇÃO (DRAG AND DROP)
  const moveCard = (id: string, newListId: string) => {
    const card = cards.find((c: CardData) => c.id === id);
    const destinationList = rawLists.find((l: any) => l.id === newListId);

    updateMutation.mutate({
      id,
      data: { listId: newListId },
      logAction: 'MOVE_TASK_ELETRICA',
      logDetails: { 
        task_title: card?.title || "Desconhecida", 
        moved_to: destinationList?.title || "Coluna Oculta"
      }
    });
  };

  const assignTechnician = (cardId: string, techId: string, techName: string, userName: string) => {
    const card = cards.find((c: CardData) => c.id === cardId);
    if (!card) return;

    const newComment = {
      id: `log-${Date.now()}`,
      author: userName,
      text: `Atribuiu a tarefa a ${techName}.`,
      createdAt: new Date().toISOString(),
      isLog: true 
    };

    const updatedComments = [...(card.comments || []), newComment];

    updateMutation.mutate({
      id: cardId,
      data: { comments: updatedComments },
      logAction: 'TECHNICIAN_ASSIGNED',
      logDetails: { techId, techName, cardTitle: card.title }
    });
  };

  const updateMembers = (cardId: string, newChecklists: ChecklistGroup[], userName: string, action: 'added' | 'removed', techName: string) => {
     const card = cards.find((c: CardData) => c.id === cardId);
     if (!card) return;

     const newComment = {
      id: `log-${Date.now()}`,
      author: userName,
      text: action === 'added' ? `Adicionou ${techName} à ordem de serviço.` : `Removeu ${techName} da ordem de serviço.`,
      createdAt: new Date().toISOString(),
      isLog: true
    };

    const updatedComments = [...(card.comments || []), newComment];

    updateMutation.mutate({
      id: cardId,
      data: { checklists: newChecklists, comments: updatedComments },
      logAction: 'UPDATE_MEMBERS_ELETRICA',
      logDetails: { action, techName, cardTitle: card.title }
    });
  };

  return { cards, rawLists, isLoading, addCard, updateCard, deleteCard, duplicateCard, toggleChecklistItem, toggleCardCompleted, moveCard, addList, deleteList, assignTechnician, updateMembers };
}
