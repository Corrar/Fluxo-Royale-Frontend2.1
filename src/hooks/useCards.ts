import { useState, useCallback, useEffect } from 'react';
import { CardData, CategoryColor, Priority, ChecklistItem } from '@/types/card';
import { toast } from 'sonner';

// ✨ IMPORTANTE: Importamos o nosso motor offline
import { apiWithOfflineFallback } from '@/utils/offlineSync';
import { api } from '@/services/api'; // Para carregar os dados iniciais

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useCards = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ============================================================================
  // 1. CARREGAMENTO INICIAL: Traz os cartões do Servidor (ou Cache se Offline)
  // ============================================================================
  const fetchCards = useCallback(async () => {
    try {
      setIsLoading(true);
      // O teu Service Worker vai intercetar isto e devolver a Cache se não houver internet
      const response = await api.get('/tasks'); 
      if (response.data) {
        setCards(response.data);
      }
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega ao montar o hook
  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // ============================================================================
  // 2. CRIAR CARTÃO (OFFLINE SAFE)
  // ============================================================================
  const addCard = useCallback(async (
    title: string,
    description: string,
    category: CategoryColor,
    priority: Priority,
    checklist: ChecklistItem[]
  ) => {
    const newCard: CardData = {
      id: generateId(), // ID provisório até o backend responder
      title,
      description,
      category,
      priority,
      checklist, // Mantém a compatibilidade com a tua interface ChecklistItem[]
      createdAt: new Date(),
      completed: false,
    };

    // 1. Atualiza a UI imediatamente para não fazer o técnico esperar
    setCards((prev) => [newCard, ...prev]);

    // 2. Grava no Servidor ou na Base de Dados Interna (IndexedDB)
    try {
      const resultado = await apiWithOfflineFallback(
        'POST',
        '/tasks',
        newCard,
        'criar_tarefa',
        'geral'
      );

      if (resultado && resultado.offline) {
        toast.warning("Sem internet. A nova tarefa foi guardada e será enviada mais tarde.");
      } else {
        // Opcional: Se o backend retornar o cartão criado com o ID real, podes atualizar a lista aqui
        // fetchCards(); 
      }
    } catch (error) {
      toast.error("Erro ao criar a tarefa.");
      // Em caso de erro fatal, podes remover o cartão provisório da UI
      setCards((prev) => prev.filter(c => c.id !== newCard.id));
    }
  }, []);

  // ============================================================================
  // 3. ATUALIZAR CARTÃO (OFFLINE SAFE)
  // ============================================================================
  const updateCard = useCallback(async (
    id: string,
    title: string,
    description: string,
    category: CategoryColor,
    priority: Priority,
    checklist: ChecklistItem[]
  ) => {
    
    const updateData = { title, description, category, priority, checklist };

    // 1. Atualiza a UI imediatamente (Optimistic UI)
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, ...updateData } : card
      )
    );

    // 2. Grava as alterações em Background
    try {
      await apiWithOfflineFallback(
        'PUT',
        `/tasks/${id}`,
        updateData,
        'atualizar_tarefa',
        id
      );
      // Não damos toast de sucesso aqui porque o AutoSave dispara muitas vezes
    } catch (error) {
      console.error("Falha ao atualizar tarefa", error);
    }
  }, []);

  // ============================================================================
  // 4. EXCLUIR CARTÃO (OFFLINE SAFE)
  // ============================================================================
  const deleteCard = useCallback(async (id: string) => {
    
    // Guarda uma cópia de segurança caso a exclusão falhe
    const previousCards = [...cards];
    
    // Atualiza UI
    setCards((prev) => prev.filter((card) => card.id !== id));

    try {
      const resultado = await apiWithOfflineFallback(
        'DELETE',
        `/tasks/${id}`,
        {},
        'excluir_tarefa',
        id
      );
      
      if (resultado && resultado.offline) {
        toast.warning("Tarefa excluída offline. Será sincronizada em breve.");
      }
    } catch (error) {
      toast.error("Não foi possível excluir a tarefa.");
      // Reverte a ação na UI
      setCards(previousCards);
    }
  }, [cards]);

  // ============================================================================
  // 5. MARCAR ITEM DA CHECKLIST (OFFLINE SAFE)
  // ============================================================================
  const toggleChecklistItem = useCallback(async (cardId: string, itemId: string) => {
    
    let updatedChecklist: ChecklistItem[] = [];

    // Atualiza a UI
    setCards((prev) =>
      prev.map((card) => {
        if (card.id === cardId) {
          updatedChecklist = card.checklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          );
          return { ...card, checklist: updatedChecklist };
        }
        return card;
      })
    );

    // Salva silenciosamente
    if (updatedChecklist.length > 0) {
      try {
        await apiWithOfflineFallback(
          'PUT',
          `/tasks/${cardId}`,
          { checklist: updatedChecklist },
          'atualizar_tarefa_checklist',
          cardId
        );
      } catch (error) {
         console.error(error);
      }
    }
  }, []);

  // ============================================================================
  // 6. CONCLUIR CARTÃO INTEIRO (OFFLINE SAFE)
  // ============================================================================
  const toggleCardCompleted = useCallback(async (cardId: string) => {
    
    let isCompleted = false;
    let completedDate = undefined;

    // Atualiza UI
    setCards((prev) =>
      prev.map((card) => {
        if (card.id === cardId) {
          isCompleted = !card.completed;
          completedDate = isCompleted ? new Date() : undefined;
          return { ...card, completed: isCompleted, completedAt: completedDate };
        }
        return card;
      })
    );

    // Grava as alterações
    try {
      await apiWithOfflineFallback(
        'PUT',
        `/tasks/${cardId}`,
        { completed: isCompleted, completedAt: completedDate },
        'concluir_tarefa',
        cardId
      );
    } catch (error) {
      toast.error("Erro ao alterar o estado de conclusão da tarefa.");
    }
  }, []);

  return { 
    cards, 
    isLoading, // Exportamos o loading para poderes mostrar um spinner se quiseres
    addCard, 
    updateCard, 
    deleteCard, 
    toggleChecklistItem, 
    toggleCardCompleted 
  };
};
