import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { RemindersBoard } from "@/components/RemindersBoard"; 
import { LayoutDashboard, Loader2, CalendarClock } from "lucide-react";

export default function RemindersPage() {
  const { profile } = useAuth();

  // Busca estatísticas vitais para gerar alertas automáticos
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      try {
        const response = await api.get("/dashboard/stats");
        return response.data;
      } catch (e) {
        return { lowStock: 0, openRequests: 0, totalSeparations: 0 };
      }
    },
    refetchInterval: 30000, // Atualiza a cada 30s
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <LayoutDashboard className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Quadro de Gestão</h1>
            <p className="text-muted-foreground">
              Central de alertas automáticos e tarefas da equipe.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border">
          <CalendarClock className="h-4 w-4" />
          <span>Hoje: {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      {/* O Quadro Kanban */}
      <div className="flex-1 min-h-0">
        <RemindersBoard stats={stats} />
      </div>
    </div>
  );
}