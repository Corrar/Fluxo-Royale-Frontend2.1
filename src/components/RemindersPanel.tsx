import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, AlertCircle, CheckCircle2, Clock, Info, Calendar } from "lucide-react";

interface RemindersPanelProps {
  stats: any;
}

export function RemindersPanel({ stats }: RemindersPanelProps) {
  return (
    // 1. Container principal relativo com borda sutil e cantos arredondados
    <div className="relative h-full rounded-xl overflow-hidden border border-white/10 shadow-xl">

      {/* 2. Imagem de Fundo Absoluta */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/wallpaper-chefe.png')",
        }}
      >
         {/* Overlay escuro para garantir contraste do texto */}
         <div className="absolute inset-0 bg-slate-950/70" />
      </div>

      {/* 3. O Card principal agora é transparente para mostrar o fundo */}
      <Card className="relative z-10 h-full bg-transparent border-none shadow-none flex flex-col">
        
        {/* Header com texto claro */}
        <CardHeader className="border-b border-white/10 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-400" />
            Quadro de Avisos
          </CardTitle>
          <CardDescription className="text-xs text-slate-300">
            Notificações estratégicas do sistema.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* Alerta Dinâmico: Estoque (Visual Glass Vermelho) */}
          {stats?.lowStock > 0 ? (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 backdrop-blur-md flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-100">Atenção: Estoque Baixo</h4>
                <p className="text-xs text-red-200/80 mt-1">
                  {stats.lowStock} produtos atingiram o nível crítico. Necessário reposição urgente.
                </p>
              </div>
            </div>
          ) : (
            // Estoque Estável (Visual Glass Verde)
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 backdrop-blur-md flex gap-3 items-start">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-100">Estoque Estável</h4>
                <p className="text-xs text-emerald-200/80">Níveis de segurança operacionais OK.</p>
              </div>
            </div>
          )}

          {/* Alerta Dinâmico: Pedidos (Visual Glass Azul) */}
          {stats?.openRequests > 0 && (
            <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/30 backdrop-blur-md flex gap-3 items-start">
              <Clock className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-100">Pedidos na Fila</h4>
                <p className="text-xs text-blue-200/80 mt-1">
                  {stats.openRequests} solicitações aguardando processamento pelo almoxarifado.
                </p>
              </div>
            </div>
          )}

          {/* Aviso Fixo 1 (Visual Glass Neutro) */}
          <div className="p-3 rounded-lg bg-slate-800/40 border border-white/10 backdrop-blur-md flex gap-3 items-start">
            <Info className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-slate-100">Relatórios Gerenciais</h4>
              <p className="text-xs text-slate-300 mt-1">
                O fechamento mensal e a análise de custos estão disponíveis na aba de relatórios.
              </p>
            </div>
          </div>

          {/* Aviso Fixo 2 (Visual Glass Amarelo) */}
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 backdrop-blur-md flex gap-3 items-start">
            <Calendar className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-100">Reunião de Alinhamento</h4>
              <p className="text-xs text-amber-200/80 mt-1">
                Revisão de metas de estoque toda Sexta-feira às 14h com a equipe.
              </p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}