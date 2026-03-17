// ficheiro: src/utils/offlineSync.ts
import { api } from '../services/api';

export interface OfflineAction {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE'; // Adicionado DELETE
  body?: any;
  // ✨ MUDANÇA: Agora aceita qualquer texto descritivo (string)
  type: string; 
  travelId: string;
  createdAt: number;
}

const DB_NAME = 'FluxoRoyaleOfflineDB';
const STORE_NAME = 'offlineActions';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveOfflineAction = async (action: OfflineAction): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(action);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

export const getOfflineActions = async (): Promise<OfflineAction[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const removeOfflineAction = async (id: string): Promise<boolean> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
};

// ✨ NOVA FUNÇÃO MAGICA QUE SUBSTITUI A API DIRETA
export const apiWithOfflineFallback = async (
  method: 'POST' | 'PUT' | 'DELETE',
  url: string,
  body: any,
  type: string, // ✨ MUDANÇA: Corrigido aqui também para string
  travelId: string = 'geral'
) => {
  // 1. Se não há internet, guarda no cofre na hora!
  if (!navigator.onLine) {
    await saveOfflineAction({ 
      id: 'offline-' + Date.now() + '-' + Math.floor(Math.random() * 1000), 
      url, method, body, type, travelId, createdAt: Date.now() 
    });
    return { offline: true, data: null };
  }

  // 2. Se há internet, tenta enviar normalmente
  try {
    let res;
    if (method === 'POST') res = await api.post(url, body);
    else if (method === 'PUT') res = await api.put(url, body);
    else if (method === 'DELETE') res = await api.delete(url, { data: body });
    return { offline: false, data: res?.data };

  } catch (error: any) {
    // 3. A rede falhou no exato milissegundo do clique? Guarda no cofre!
    if (error.message === 'Network Error' || error.code === 'ECONNABORTED' || !error.response) {
      await saveOfflineAction({ 
        id: 'offline-' + Date.now() + '-' + Math.floor(Math.random() * 1000), 
        url, method, body, type, travelId, createdAt: Date.now() 
      });
      return { offline: true, data: null };
    }
    throw error;
  }
};
