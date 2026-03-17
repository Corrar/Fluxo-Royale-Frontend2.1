import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, FileText, ClipboardList, AlertTriangle, DollarSign, 
  Activity, TrendingUp, Calendar 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const response = await api.get("/dashboard/stats");
      return response.data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // --- COMPONENTE DE ANIMAÇÃO MELHORADO ---
  // Agora aceita "isCurrency" para decidir se formata como R$ ou Número Inteiro
  const AnimatedCounter = ({ value, isCurrency = true }: { value: number, isCurrency?: boolean }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      let startTimestamp: number | null = null;
      const duration = 2000; 
      const startValue = 0;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = startValue + (value - startValue) * ease;
        setDisplayValue(current);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
    }, [value]);

    if (isCurrency) {
      return <>{formatCurrency(displayValue)}</>;
    }
    
    // Para números inteiros (Quantidade)
    return <>{Math.round(displayValue)}</>;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  // --- SKELETON LOADING ---
  const DashboardSkeleton = () => (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-[85vh] rounded-xl border border-slate-100 shadow-sm animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-4 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 md:w-96 bg-slate-200" />
          <Skeleton className="h-4 w-48 bg-slate-200" />
        </div>
        <Skeleton className="h-8 w-40 rounded-full bg-slate-200" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24 bg-slate-100" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-2 bg-slate-200" />
              <Skeleton className="h-3 w-20 bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 border-slate-100 shadow-sm">
          <CardHeader><Skeleton className="h-5 w-48 bg-slate-100" /></CardHeader>
          <CardContent className="h-[300px] flex items-end justify-between p-6 gap-2">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="w-full bg-slate-100 rounded-t-md" style={{ height: `${Math.random() * 100}%` }} />)}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3 border-slate-100 shadow-sm">
          <CardHeader><Skeleton className="h-5 w-32 bg-slate-100" /></CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <Skeleton className="h-48 w-48 rounded-full bg-slate-100 border-4 border-white shadow-sm" />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Card Financeiro Branco
  const TotalValueCardWhite = () => (
    <Card className="bg-white text-black shadow-lg border border-slate-200 transform hover:-translate-y-1 transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-bold text-slate-800">Valor em Estoque</CardTitle>
        <DollarSign className="h-5 w-5 text-emerald-600" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold text-emerald-700">
          <AnimatedCounter value={stats?.totalValue || 0} isCurrency={true} />
        </div>
        <p className="text-xs font-medium text-slate-500 mt-1">Capital imobilizado total</p>
      </CardContent>
    </Card>
  );

  // --- DASHBOARD DO CHEFE ---
  const renderChefeDashboard = () => {
    const volumeData = [
      { name: 'Produtos', value: stats?.totalProducts || 0, color: '#64748b' },
      { name: 'Solicitações', value: stats?.totalRequests || 0, color: '#f59e0b' },
      { name: 'Separações', value: stats?.totalSeparations || 0, color: '#10b981' },
    ];
    const totalStock = stats?.totalProducts || 1;
    const lowStock = stats?.lowStock || 0;
    const healthyStock = totalStock - lowStock;
    const stockHealthData = [
      { name: 'Saudável', value: healthyStock, color: '#10b981' },
      { name: 'Crítico', value: lowStock, color: '#ef4444' },
    ];

    return (
      <div className="p-6 space-y-6 bg-slate-50/50 min-h-[85vh] rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-4 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-emerald-600" />
              {getGreeting()}, {profile?.name}.
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Visão estratégica e indicadores de performance.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full text-xs font-medium text-slate-500 border shadow-sm self-start md:self-auto">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{today}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <TotalValueCardWhite />
          <Card className="bg-white border-amber-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Estoque Crítico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{stats?.lowStock || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Produtos abaixo do mínimo</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-blue-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats?.openRequests || 0}</div>
              <p className="text-xs text-slate-500 mt-1">Solicitações em aberto</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
          <Card className="lg:col-span-4 bg-white shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base text-slate-800">Volume de Movimentações</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }} 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {volumeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 bg-white shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base text-slate-800">Saúde do Estoque</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockHealthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stockHealthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // --- DASHBOARDS ESPECÍFICOS ---

  const renderAdminDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Dashboard Admin</h1></div>
      <div className="grid gap-4 md:grid-cols-4">
        <TotalValueCardWhite />
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Produtos</CardTitle><Package className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalProducts}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Estoque Baixo</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-600"/></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats?.lowStock}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Solicitações</CardTitle><FileText className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalRequests}</div></CardContent></Card>
      </div>
    </div>
  );

  const renderAlmoxarifeDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Almoxarifado</h1></div>
      <div className="grid gap-4 md:grid-cols-4">
        
        {/* CARD FINANCEIRO */}
        <TotalValueCardWhite />
        
        {/* --- CARD PERSONALIZADO: PRODUTOS CADASTRADOS --- */}
        <Card className="bg-blue-600 text-white shadow-lg border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-white/90">PRODUTOS CADASTRADOS</CardTitle>
            <Package className="h-5 w-5 text-white/80" />
          </CardHeader>
          <CardContent>
            {/* EFEITO ANIMADO DE CONTAGEM (isCurrency={false} para número inteiro) */}
            <div className="text-4xl font-extrabold text-white drop-shadow-md">
              <AnimatedCounter value={stats?.totalProducts || 0} isCurrency={false} />
            </div>
            <p className="text-xs text-blue-100 mt-1 font-medium opacity-90">Total de itens no catálogo</p>
          </CardContent>
        </Card>

        {/* Demais cards */}
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Solicitações</CardTitle><FileText className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalRequests}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Separações</CardTitle><ClipboardList className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><div className="text-2xl font-bold">{stats?.totalSeparations}</div></CardContent></Card>
      </div>
    </div>
  );

  const renderSetorDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Setor</h1></div>
      <Card><CardHeader><CardTitle>Minhas Solicitações</CardTitle></CardHeader><CardContent><p>Acesse o menu lateral para ver suas solicitações.</p></CardContent></Card>
    </div>
  );

  const renderComprasDashboard = () => (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Compras</h1></div>
      <div className="grid gap-4 md:grid-cols-3">
        <TotalValueCardWhite />
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Estoque Baixo</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-600"/></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{stats?.lowStock}</div></CardContent></Card>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (isLoading) return <DashboardSkeleton />;

    switch (profile?.role) {
      case "admin": return renderAdminDashboard();
      case "chefe": return renderChefeDashboard();
      case "almoxarife": return renderAlmoxarifeDashboard();
      case "setor": return renderSetorDashboard();
      case "compras": return renderComprasDashboard();
      default: return <div className="p-8 text-center">Perfil não reconhecido.</div>;
    }
  };

  return renderDashboard();
}