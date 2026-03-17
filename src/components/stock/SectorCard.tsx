import { useState } from 'react';
import { Building2, Package, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, BarChart3, PieChart, Activity, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { StockLocation, StockWithProduct } from '@/types/stock-display'; // Importe do arquivo criado no Passo 1
import { cn } from '@/lib/utils';
import { AreaChart, Area, PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface SectorCardProps {
  location: StockLocation;
  items: StockWithProduct[];
  index: number;
}

// Cores originais do design Lovable
const sectorColors = [
  { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-600', shadow: 'shadow-violet-500/25' },
  { bg: 'from-cyan-500 to-blue-600', light: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-600', shadow: 'shadow-cyan-500/25' },
  { bg: 'from-emerald-500 to-teal-600', light: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600', shadow: 'shadow-emerald-500/25' },
  { bg: 'from-orange-500 to-red-500', light: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600', shadow: 'shadow-orange-500/25' },
  { bg: 'from-pink-500 to-rose-600', light: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-600', shadow: 'shadow-pink-500/25' },
  { bg: 'from-amber-500 to-yellow-600', light: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600', shadow: 'shadow-amber-500/25' },
];

export function SectorCard({ location, items, index }: SectorCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorScheme = sectorColors[index % sectorColors.length];

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const lowItems = items.filter(i => i.status !== 'normal').length;
  const criticalItems = items.filter(i => i.status === 'critical').length;
  const normalItems = items.filter(i => i.status === 'normal').length;
  
  const healthPercentage = totalItems > 0 ? Math.round((normalItems / totalItems) * 100) : 100;
  
  // Mock data para gráficos
  const trendData = [
    { day: 'Seg', value: 65 + Math.random() * 20 },
    { day: 'Ter', value: 70 + Math.random() * 20 },
    { day: 'Qua', value: 75 + Math.random() * 20 },
    { day: 'Qui', value: 68 + Math.random() * 20 },
    { day: 'Sex', value: 80 + Math.random() * 20 },
    { day: 'Sáb', value: 72 + Math.random() * 20 },
    { day: 'Dom', value: totalQuantity },
  ];

  const pieData = [
    { name: 'Normal', value: normalItems, color: '#22c55e' },
    { name: 'Baixo', value: lowItems - criticalItems, color: '#f59e0b' },
    { name: 'Crítico', value: criticalItems, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const categoryData = items.reduce((acc, item) => {
    const category = item.product.category;
    acc[category] = (acc[category] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <Card 
        className={cn(
          'group cursor-pointer overflow-hidden transition-all duration-500 ease-out',
          'hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.02]',
          'border-2',
          colorScheme.border,
          isExpanded && 'ring-2 ring-offset-2 ring-primary'
        )}
        onClick={() => setIsExpanded(true)}
      >
        <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br', colorScheme.bg)} style={{ opacity: 0.05 }} />
        
        <CardContent className="pt-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-3 rounded-2xl bg-gradient-to-br shadow-lg', colorScheme.bg, colorScheme.shadow)}>
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{location.name}</h3>
                <p className="text-sm text-muted-foreground">{location.description}</p>
              </div>
            </div>
            {lowItems > 0 && (
              <div className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 animate-pulse',
                criticalItems > 0 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
              )}>
                <AlertTriangle className="w-4 h-4" />
                {lowItems} alertas
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className={cn('p-3 rounded-xl', colorScheme.light)}>
              <div className="flex items-center gap-2 mb-1">
                <Package className={cn('w-4 h-4', colorScheme.text)} />
                <span className="text-xs text-muted-foreground">Produtos</span>
              </div>
              <p className={cn('text-2xl font-bold', colorScheme.text)}>{totalItems}</p>
            </div>
            <div className={cn('p-3 rounded-xl', colorScheme.light)}>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className={cn('w-4 h-4', colorScheme.text)} />
                <span className="text-xs text-muted-foreground">Qtd</span>
              </div>
              <p className={cn('text-2xl font-bold', colorScheme.text)}>{totalQuantity}</p>
            </div>
            <div className={cn('p-3 rounded-xl', colorScheme.light)}>
              <div className="flex items-center gap-2 mb-1">
                <Activity className={cn('w-4 h-4', colorScheme.text)} />
                <span className="text-xs text-muted-foreground">Saúde</span>
              </div>
              <p className={cn('text-2xl font-bold', colorScheme.text)}>{healthPercentage}%</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status do Estoque</span>
              <span className={cn('font-medium', healthPercentage >= 70 ? 'text-success' : healthPercentage >= 40 ? 'text-warning' : 'text-destructive')}>
                {healthPercentage >= 70 ? 'Saudável' : healthPercentage >= 40 ? 'Atenção' : 'Crítico'}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn('h-full rounded-full transition-all duration-1000 bg-gradient-to-r', colorScheme.bg)}
                style={{ width: `${healthPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center mt-4 text-muted-foreground group-hover:text-foreground transition-colors">
            <span className="text-sm">Clique para expandir</span>
            <ArrowUpRight className="w-4 h-4 ml-1 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Modal Expandido */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsExpanded(false)}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <Card 
            className={cn(
              'relative w-full max-w-5xl max-h-[90vh] overflow-auto',
              'animate-scale-in border-2',
              colorScheme.border,
              'shadow-2xl'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn('h-32 bg-gradient-to-br relative', colorScheme.bg)}>
               <div className="absolute inset-0 bg-white/10" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={() => setIsExpanded(false)}
              >
                <X className="w-6 h-6" />
              </Button>
              <div className="absolute bottom-4 left-6 flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-white/20 backdrop-blur-sm">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{location.name}</h2>
                  <p className="text-white/80">{location.description}</p>
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 -mt-10 relative z-10">
                <KPICard title="Total de Produtos" value={totalItems} icon={Package} trend={5} colorScheme={colorScheme} />
                <KPICard title="Quantidade Total" value={totalQuantity} icon={BarChart3} trend={12} colorScheme={colorScheme} />
                <KPICard title="Itens em Alerta" value={lowItems} icon={AlertTriangle} trend={-8} isNegativeGood colorScheme={colorScheme} />
                <KPICard title="Saúde do Estoque" value={`${healthPercentage}%`} icon={Activity} trend={3} colorScheme={colorScheme} />
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                 {/* Gráficos aqui (mantive a estrutura, mas simplifiquei para caber na resposta) */}
                 <Card className="p-4 border-2">
                    <h3 className="font-semibold mb-4">Tendência</h3>
                    <div className="h-48">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                <linearGradient id={`gradient-${location.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                                </defs>
                                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px' }}/>
                                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill={`url(#gradient-${location.id})`} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                 </Card>
                 <Card className="p-4 border-2">
                    <h3 className="font-semibold mb-4">Status</h3>
                    <div className="h-48 flex items-center justify-center">
                         <ResponsiveContainer width="100%" height={160}>
                            <RechartsPie>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                                {pieData.map((entry, i) => <Cell key={`cell-${i}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                            </RechartsPie>
                        </ResponsiveContainer>
                    </div>
                 </Card>
              </div>

              {/* Lista de Itens */}
              <Card className="border-2 overflow-hidden">
                <div className={cn('px-4 py-3 bg-gradient-to-r', colorScheme.bg)}>
                  <h3 className="font-semibold text-white">Produtos em Estoque</h3>
                </div>
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold bg-gradient-to-br', colorScheme.bg)}>
                                {item.product.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-medium">{item.product.name}</p>
                                <p className="text-xs text-muted-foreground">{item.product.category}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="font-bold">{item.quantity} {item.product.unit}</p>
                             <span className={cn('text-xs font-medium', item.status === 'normal' ? 'text-success' : 'text-destructive')}>
                                {item.status === 'normal' ? 'Normal' : 'Atenção'}
                             </span>
                        </div>
                    </div>
                  ))}
                </div>
              </Card>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function KPICard({ title, value, icon: Icon, trend, isNegativeGood, colorScheme }: any) {
  const isPositive = trend ? (isNegativeGood ? trend < 0 : trend > 0) : true;
  return (
    <Card className="p-4 bg-card border-2 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('p-2 rounded-lg', colorScheme.light)}>
          <Icon className={cn('w-5 h-5', colorScheme.text)} />
        </div>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold">{value}</p>
        <div className={cn('flex items-center gap-1 text-sm font-medium', isPositive ? 'text-success' : 'text-destructive')}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {Math.abs(trend)}%
        </div>
      </div>
    </Card>
  );
}