import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/LoadingScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string; // Mudamos de allowedRoles para requiredPermission
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, loading, canAccess } = useAuth();
  const location = useLocation();

  // 1. Loading: Espera o AuthContext carregar o usuário e as permissões do banco
  if (loading) {
    return <LoadingScreen isLoading={true} message="Verificando permissões..." />;
  }

  // 2. Autenticação: Se não tiver usuário, manda pro login
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Autorização: Verifica se o usuário tem a permissão exigida (definida no PermissionsPage)
  // A função canAccess() já cuida de liberar tudo se for Admin
  if (requiredPermission && !canAccess(requiredPermission)) {
    // Se não tiver permissão, redireciona para o Início (página segura padrão)
    return <Navigate to="/inicio" replace />;
  }

  // 4. Tudo certo: Renderiza a página
  return <>{children}</>;
}