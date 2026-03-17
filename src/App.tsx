import { useState, useEffect, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Layout from "./components/Layout"; 
import { LoadingScreen } from "./components/LoadingScreen";
import { subscribeToLoading } from "./services/api";
import { ThemeProvider } from "@/components/theme-provider";
import { AnnouncementModal } from "./components/AnnouncementModal";

// ✨ IMPORTANTE: O nosso Vigilante Offline
import { useOfflineSync } from "./hooks/useOfflineSync";

// --- LAZY LOADING ---
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inicio = lazy(() => import("./pages/Inicio"));
const Products = lazy(() => import("./pages/Products"));
const Stock = lazy(() => import("./pages/Stock"));
const StockView = lazy(() => import("./pages/StockView"));
const StockSectors = lazy(() => import("./pages/StockSectors"));
const Requests = lazy(() => import("./pages/Requests"));
const MyRequests = lazy(() => import("./pages/MyRequests"));
const Orders = lazy(() => import("./pages/Orders"));
const Separations = lazy(() => import("./pages/Separations"));
const StockWithdrawalPage = lazy(() => import("./pages/StockWithdrawalPage"));
const TravelReconciliation = lazy(() => import("./pages/TravelReconciliation"));
const LowStock = lazy(() => import("./pages/LowStock"));
const Reports = lazy(() => import("./pages/Reports"));
const CalcMinStock = lazy(() => import("./pages/CalcMinStock"));
const CalculatorPage = lazy(() => import("./pages/CalculatorPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const Users = lazy(() => import("./pages/Users"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const PermissionsPage = lazy(() => import("./pages/PermissionsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TasksBoard = lazy(() => import("./pages/TasksBoard"));
// NOVA: Página do Quadro da Elétrica
const EletricaBoard = lazy(() => import("./pages/EletricaBoard"));
// Nova Página de Gestão
const ManagementBoard = lazy(() => import("./pages/ManagementBoard"));
// Nova Página de Destaques
const AdminDestaques = lazy(() => import("./pages/AdminDestaques"));

// ✨ NOVO: Nossa página de Viagens Externas
const TravelBoard = lazy(() => import("./pages/TravelBoard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const GlobalLoader = () => {
  const { loading: authLoading } = useAuth();
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    return subscribeToLoading(setApiLoading);
  }, []);

  return <LoadingScreen isLoading={authLoading || apiLoading} />;
};

// --- ESTILOS GLOBAIS ---
const GlobalStyles = () => (
  <style>{`
    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 84% 4.9%;
      --primary: 221.2 83.2% 53.3%;
      --radius: 0.5rem;
    }
    .dark {
      --background: 224 71% 4%; 
      --foreground: 210 40% 100%;
    }
    .dark input, .dark textarea, .dark select {
      background-color: hsl(217 32% 18%) !important;
      color: #FFFFFF !important;
      border: 1px solid hsl(217 32% 40%) !important;
    }
  `}</style>
);

const App = () => {
  // A variável isOnline já não é estritamente necessária aqui porque removemos o OfflineCard, 
  // mas mantive a lógica de escuta caso precises de usar este estado para outra coisa no futuro.
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ✨ ATIVA O VIGILANTE DE MODO OFFLINE AQUI (GLOBAL)
  useOfflineSync();

  useEffect(() => {
    // 1. Monitoramento de Conexão
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // ✨ NOTA: O bloco manual "navigator.serviceWorker.register" foi removido.
    // O vite-plugin-pwa já se encarrega de fazer isto automaticamente e sem erros!

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalStyles />
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme" attribute="class">
        <TooltipProvider>
          {/* CORREÇÃO: Removido 'asChild' que causava erro TS2322 */}
          <Toaster /> 
          <Sonner />

          {/* O <OfflineCard /> foi removido para não bloquear a tela! */}

          <BrowserRouter>
            <AuthProvider>
              <SocketProvider>
                <GlobalLoader />
                
                <AnnouncementModal />

                <Suspense fallback={<LoadingScreen isLoading={true} />}>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    
                    {/* Rotas Protegidas do Sistema */}
                    <Route path="/" element={<ProtectedRoute requiredPermission="dashboard"><Layout><Dashboard /></Layout></ProtectedRoute>} />
                    <Route path="/inicio" element={<ProtectedRoute><Layout><Inicio /></Layout></ProtectedRoute>} />
                    
                    {/* Utilitários */}
                    <Route path="/calculator" element={<ProtectedRoute requiredPermission="calculadora"><Layout><CalculatorPage /></Layout></ProtectedRoute>} />
                    <Route path="/reminders" element={<ProtectedRoute requiredPermission="avisos"><Layout><RemindersPage /></Layout></ProtectedRoute>} />
                    <Route path="/tasks" element={<ProtectedRoute requiredPermission="tarefas_visualizar"><Layout><TasksBoard /></Layout></ProtectedRoute>} />
                    
                    {/* NOVO: Rota da Elétrica */}
                    <Route path="/eletrica" element={<ProtectedRoute><Layout><EletricaBoard /></Layout></ProtectedRoute>} />
                    
                    {/* ✨ NOVO: Rota das Viagens Técnicas */}
                    <Route path="/travels" element={
                      <ProtectedRoute requiredPermission="viagens_externas">
                        <Layout><TravelBoard /></Layout>
                      </ProtectedRoute>
                    } />

                    {/* NOVO: Quadro de Gestão Global */}
                    <Route path="/gestao" element={<ProtectedRoute><Layout><ManagementBoard /></Layout></ProtectedRoute>} />

                    {/* Estoque */}
                    <Route path="/stock-view" element={<ProtectedRoute requiredPermission="consultar"><Layout><StockView /></Layout></ProtectedRoute>} />
                    <Route path="/products" element={<ProtectedRoute requiredPermission="produtos"><Layout><Products /></Layout></ProtectedRoute>} />
                    <Route path="/sectors" element={<ProtectedRoute requiredPermission="consultar"><Layout><StockSectors /></Layout></ProtectedRoute>} />
                    <Route path="/stock" element={<ProtectedRoute requiredPermission="estoque"><Layout><Stock /></Layout></ProtectedRoute>} />
                    <Route path="/withdrawal" element={<ProtectedRoute requiredPermission="estoque"><Layout><StockWithdrawalPage /></Layout></ProtectedRoute>} />
                    <Route path="/low-stock" element={<ProtectedRoute requiredPermission="estoque_critico"><Layout><LowStock /></Layout></ProtectedRoute>} />
                    <Route path="/calc-min-stock" element={<ProtectedRoute requiredPermission="calculo_minimo"><Layout><CalcMinStock /></Layout></ProtectedRoute>} />

                    {/* Operações */}
                    <Route path="/requests" element={<ProtectedRoute requiredPermission="solicitacoes"><Layout><Requests /></Layout></ProtectedRoute>} />
                    <Route path="/my-requests" element={<ProtectedRoute requiredPermission="minhas_solicitacoes"><Layout><MyRequests /></Layout></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><Layout><Orders /></Layout></ProtectedRoute>} /> 
                    <Route path="/separations" element={<ProtectedRoute requiredPermission="separacoes"><Layout><Separations /></Layout></ProtectedRoute>} />
                    <Route path="/reconciliation" element={<ProtectedRoute requiredPermission="confronto_viagem"><Layout><TravelReconciliation /></Layout></ProtectedRoute>} />

                    {/* Admin */}
                    <Route path="/admin/destaques" element={<ProtectedRoute><Layout><AdminDestaques /></Layout></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute requiredPermission="relatorios"><Layout><Reports /></Layout></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute requiredPermission="usuarios"><Layout><Users /></Layout></ProtectedRoute>} />
                    <Route path="/audit" element={<ProtectedRoute requiredPermission="logs"><Layout><AuditLogs /></Layout></ProtectedRoute>} />
                    <Route path="/permissions" element={<ProtectedRoute requiredPermission="permissoes"><Layout><PermissionsPage /></Layout></ProtectedRoute>} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </SocketProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
