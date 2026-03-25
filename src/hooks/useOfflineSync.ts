// ficheiro: src/hooks/useOfflineSync.ts

import { useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { getOfflineActions, removeOfflineAction } from '../utils/offlineSync';
import { toast } from 'sonner';

export function useOfflineSync() {

  // Função que faz o trabalho pesado de sincronizar
  const syncOfflineActions = useCallback(async () => {
    // 1. Se não houver internet, abortamos a missão
    if (!navigator.onLine) return; 

    try {
      // 2. Abre o cofre e vê se há ações pendentes
      const actions = await getOfflineActions();
      if (actions.length === 0) return; // O cofre está vazio, ótimo!

      toast.info(`A sincronizar ${actions.length} ações offline com o servidor...`, { duration: 3000 });
      let successCount = 0;

      // ✨ NOVIDADE: Organiza por ordem de criação (muito importante para não atropelar a ordem cronológica)
      actions.sort((a, b) => a.createdAt - b.createdAt);

      // ✨ O TRADUTOR DE IDs MÁGICO ✨
      // Vai mapear os IDs fantasmas (temp-...) para os IDs reais gerados pela base de dados
      const idMap: Record<string, string> = {};

      // 3. Vamos tentar enviar cada ação pendente para o backend
      for (const action of actions) {
        try {
          // Substituir IDs temporários pelos reais no URL e no Body (se existirem no dicionário)
          let url = action.url;
          let body = action.body;

          for (const [tempId, realId] of Object.entries(idMap)) {
            // Troca no URL (ex: /travels/temp-123 vira /travels/55)
            url = url.replace(tempId, realId);
            
            // Troca no Body se for preciso (ex: caso um checklist tenha o ID guardado no corpo do pedido)
            if (body) {
              const bodyString = JSON.stringify(body).replace(new RegExp(tempId, 'g'), realId);
              body = JSON.parse(bodyString);
            }
          }

          let res;
          if (action.method === 'POST') {
            res = await api.post(url, body);
            
            // ✨ Se criámos algo e o servidor devolveu um ID real, guardamos no dicionário!
            if (res.data?.id && action.travelId && action.travelId.startsWith('temp-')) {
              idMap[action.travelId] = String(res.data.id);
            }
          } else if (action.method === 'PUT') {
            await api.put(url, body);
          } else if (action.method === 'DELETE') {
            // ✨ NOVIDADE: Adicionado suporte para DELETE
            await api.delete(url, { data: body });
          }
          
          // 4. Se o envio foi um sucesso, apagamos a ação do cofre
          await removeOfflineAction(action.id);
          successCount++;
        } catch (error: any) {
          console.error(`Falha ao sincronizar ação ${action.id}:`, error);
          
          // ✨ NOVIDADE: Se o servidor rejeitou de vez (ex: Cartão já tinha sido apagado),
          // removemos do cofre para não encravar os próximos envios.
          if (error.response && error.response.status >= 400 && error.response.status < 500) {
             await removeOfflineAction(action.id);
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Tudo atualizado! ${successCount} ações sincronizadas.`, {
          style: { backgroundColor: '#10b981', color: 'white' }
        });
        
        // ✨ NOVIDADE: Dispara um evento global! O teu `useTravels.ts` vai ouvir isto e dar Refresh automático!
        window.dispatchEvent(new CustomEvent('offline_sync_completed'));
      }

    } catch (error) {
      console.error('Erro ao aceder ao cofre offline:', error);
    }
  }, []);

  // O "useEffect" é o nosso vigilante que fica à escuta
  useEffect(() => {
    // Quando o navegador detetar que a internet voltou ('online'), chama a função
    window.addEventListener('online', syncOfflineActions);
    
    // Tenta sincronizar logo que o utilizador abre a aplicação
    syncOfflineActions();

    return () => {
      // Limpeza de segurança quando o componente for destruído
      window.removeEventListener('online', syncOfflineActions);
    };
  }, [syncOfflineActions]);

  return { syncOfflineActions };
}
