import axios from 'axios';

// Sistema de Notificação de Loading
type Listener = (isLoading: boolean) => void;
let listeners: Listener[] = [];
let activeRequests = 0;
let loadingTimer: any = null;
let isLoaderVisible = false;

export const subscribeToLoading = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

const notifyListeners = (isLoading: boolean) => {
  listeners.forEach(l => l(isLoading));
};

// --- FUNÇÕES AUXILIARES ---

const handleRequestStart = () => {
  activeRequests++;
  if (activeRequests === 1) {
    // Só exibe o loading se a requisição demorar mais de 300ms
    loadingTimer = setTimeout(() => {
      isLoaderVisible = true;
      notifyListeners(true);
    }, 300);
  }
};

const handleRequestEnd = () => {
  activeRequests--;
  
  // Segurança para nunca ficar negativo
  if (activeRequests < 0) activeRequests = 0;

  if (activeRequests === 0) {
    // Se terminou antes do tempo limite, cancela o timer
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    
    // CORREÇÃO CRÍTICA:
    // Sempre notifica false quando as requisições acabam para destravar a tela.
    // Antes, isso estava dentro de um "if (isLoaderVisible)", o que podia causar travamentos.
    isLoaderVisible = false;
    notifyListeners(false);
  }
};

// Função inteligente para definir o endereço
const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { hostname } = window.location;
  if (hostname === 'localhost') {
    return 'http://localhost:3000';
  }
  return `http://${hostname}:3000`;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
});

// --- INTERCEPTADORES INTELIGENTES ---

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // LÓGICA DE FILTRO ANTI-FLICKER:
    // 1. Verifica se é GET (leitura)
    const isGetRequest = config.method?.toLowerCase() === 'get';
    // 2. Verifica se tem opção explícita de pular
    const skipOption = (config as any).skipLoading;
    
    // Se não tiver opção explícita, assume TRUE (pular) para GET e FALSE para o resto
    const shouldSkip = skipOption !== undefined ? skipOption : isGetRequest;

    if (!shouldSkip) {
      (config as any)._usesLoader = true; // Marca que essa requisição ativou o loader
      handleRequestStart(); 
    }
    
    return config;
  },
  (error) => {
    // Se deu erro antes de sair e estava usando loader, finaliza
    if ((error.config as any)?._usesLoader) {
      handleRequestEnd(); 
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Só finaliza se essa requisição específica ativou o loader
    if ((response.config as any)._usesLoader) {
      handleRequestEnd(); 
    }
    return response;
  },
  (error) => {
    // Só finaliza se essa requisição específica ativou o loader
    if ((error.config as any)?._usesLoader) {
      handleRequestEnd(); 
    }
    return Promise.reject(error);
  }
);
