import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Calculator, TrendingUp, Info, CalendarClock, 
  ShieldCheck, AlertTriangle, BarChart3, Activity, ArrowRight,
  History, Download, ArrowUpRight, ArrowDownRight, 
  FileSpreadsheet, FileText, ChevronDown
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UpdateLog {
  id: string;
  sku: string;
  name: string;
  oldMin: number;
  newMin: number;
  avgConsumption: number;
}

export default function CalcMinStock() {
  const [days, setDays] = useState([30]); 
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [updateHistory, setUpdateHistory] = useState<UpdateLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // --- MOCK GENERATOR (Apenas visual, usado se não houver dados reais) ---
  const generateMockHistory = () => {
    return Array.from({ length: 5 }).map((_, i) => {
      const oldMin = Math.floor(Math.random() * 20) + 5;
      const newMin = Math.floor(Math.random() * 30) + 5;
      return {
        id: `prod-${i}`,
        sku: `SKU-${1000 + i}`,
        name: `Produto Exemplo ${i + 1}`,
        oldMin,
        newMin,
        avgConsumption: Number((newMin / 15).toFixed(2))
      };
    });
  };

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/stock/calculate-min", { days: days[0] });
      return response.data;
    },
    onSuccess: (data) => {
      // CORREÇÃO: Pega os dados reais do backend (updatedProducts)
      const products = data.updatedProducts || []; 
      
      if (products.length > 0) {
         setUpdateHistory(products);
         setShowHistory(true); // Força a aba a aparecer
         toast.success("Níveis de Estoque Atualizados", {
            description: `O ponto de pedido de ${products.length} produtos foi redefinido.`,
            duration: 5000,
            icon: <ShieldCheck className="text-emerald-500 h-5 w-5" />
         });
      } else {
         // Se não houve mudanças, mostra toast informativo mas mantém na tela de simulação
         toast.info("Tudo Atualizado", { 
             description: "Nenhum produto precisou de alteração no estoque mínimo com base nesse período.",
             icon: <ShieldCheck className="text-blue-500 h-5 w-5" />
         });
      }
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error("Erro na Operação", {
        description: error.response?.data?.error || "Não foi possível conectar ao servidor.",
      });
      setIsDialogOpen(false);
    },
  });

  // --- EXPORTAR EXCEL (.XLSX) ---
  const handleExportExcel = () => {
    if (updateHistory.length === 0) return toast.error("Sem dados para exportar.");

    const worksheetData = updateHistory.map(item => ({
      "SKU": item.sku,
      "Produto": item.name,
      "Média Diária": item.avgConsumption,
      "Mínimo Anterior": item.oldMin,
      "Novo Mínimo": item.newMin,
      "Variação": item.newMin - item.oldMin
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Estoque Mínimo");

    const wscols = [{wch: 15}, {wch: 40}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 10}];
    worksheet['!cols'] = wscols;

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Relatorio_Estoque_${date}.xlsx`);
    toast.success("Arquivo Excel gerado com sucesso!");
  };

  // --- EXPORTAR PDF (.PDF) ---
  const handleExportPDF = () => {
    if (updateHistory.length === 0) return toast.error("Sem dados para exportar.");

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Alteração de Estoque Mínimo", 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Data: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Base de Cálculo: Média dos últimos ${days[0]} dias`, 14, 33);

    const tableColumn = ["SKU", "Produto", "Média/Dia", "Antes", "Depois", "Diff"];
    const tableRows = updateHistory.map(item => [
      item.sku,
      item.name,
      item.avgConsumption.toString(),
      item.oldMin.toString(),
      item.newMin.toString(),
      (item.newMin - item.oldMin).toString()
    ]);

    autoTable(doc, {
      startY: 40,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 8 },
    });

    const date = new Date().toISOString().split('T')[0];
    doc.save(`Relatorio_Estoque_${date}.pdf`);
    toast.success("Arquivo PDF gerado com sucesso!");
  };

  // --- SIMULAÇÃO GRÁFICO ---
  const simulationData = useMemo(() => {
    const data = [];
    let volatility = days[0] < 20 ? 15 : 5;
    for (let i = 1; i <= 15; i++) {
      const baseConsumption = 10;
      const noise = Math.floor(Math.random() * volatility);
      data.push({
        day: `D${i}`,
        consumo: baseConsumption + noise,
      });
    }
    return data;
  }, [days]);

  const avgConsumption = simulationData.reduce((acc, curr) => acc + curr.consumo, 0) / simulationData.length;
  const simulatedMinStock = Math.ceil(avgConsumption * 15);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* HEADER EXECUTIVO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Cálculo de Estoque Mínimo
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Inteligência aplicada para redefinir o <strong>Ponto de Pedido (ROP)</strong> com base no consumo real.
          </p>
        </div>
        
        {/* Botão de Toggle Histórico */}
        {updateHistory.length > 0 && (
          <Button 
            variant="ghost" 
            className="gap-2 hidden md:flex text-primary hover:bg-primary/5" 
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="h-4 w-4" />
            {showHistory ? "Voltar para Simulação" : "Ver Relatório de Alterações"}
          </Button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        
        {/* ESQUERDA: CONTROLES */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border shadow-lg bg-card h-full flex flex-col">
            <CardHeader className="bg-muted/30 border-b border-border pb-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <Calculator className="h-5 w-5 text-primary" />
                    Configurar Período
                  </CardTitle>
                  <CardDescription>Janela de análise histórica (Lookback)</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-10 pt-8 flex-1">
              
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-muted-foreground" /> 
                    Histórico: <span className="text-primary text-xl ml-1">{days[0]} dias</span>
                  </Label>
                </div>
                
                <Slider
                  value={days}
                  onValueChange={setDays}
                  min={7}
                  max={120}
                  step={1}
                  className="py-4 cursor-pointer"
                />
                
                <div className="flex justify-between items-center">
                  <Badge variant="outline" className={`transition-colors ${days[0] < 20 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'text-muted-foreground'}`}>
                    Reativo (Curto)
                  </Badge>
                  <Badge variant="outline" className={`transition-colors ${days[0] > 60 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'text-muted-foreground'}`}>
                    Conservador (Longo)
                  </Badge>
                </div>
              </div>

              {/* Explicação da Fórmula */}
              <div className="bg-primary/5 rounded-xl p-5 border border-primary/10">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="h-3 w-3" /> Algoritmo
                </h3>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">Consumo</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{days[0]} dias</div>
                  </div>
                  <div className="text-muted-foreground text-xl">÷</div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{days[0]}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Dias</div>
                  </div>
                  <div className="text-muted-foreground text-xl">×</div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">15</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Segurança</div>
                  </div>
                  <ArrowRight className="text-muted-foreground h-4 w-4" />
                  <div className="text-center bg-card shadow-sm border border-border px-3 py-1 rounded-md">
                    <div className="text-lg font-bold text-primary">Mínimo</div>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="bg-muted/30 border-t border-border p-6">
              <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="lg" 
                    className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 px-8 text-base shadow-md transition-all active:scale-[0.98]"
                    disabled={calculateMutation.isPending}
                  >
                    {calculateMutation.isPending ? "Processando..." : "Calcular e Atualizar Estoque"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Atenção: Impacto Global
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3 pt-2">
                      <p>
                        Esta operação irá <strong>recalcular o Estoque Mínimo de TODOS os produtos</strong> ativos.
                      </p>
                      <div className="bg-muted p-3 rounded-md text-sm border border-border">
                        O sistema usará a média de consumo real dos últimos <span className="text-primary">{days[0]} dias</span> e atualizará automaticamente o cadastro.
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => calculateMutation.mutate()}
                      className="bg-primary hover:bg-primary/90"
                    >
                      Confirmar Atualização
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </div>

        {/* DIREITA: RELATÓRIO E SIMULAÇÃO */}
        <div className="lg:col-span-7 space-y-6">
          
          {showHistory && updateHistory.length > 0 ? (
            <Card className="shadow-lg border-border bg-card animate-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="pb-2 border-b border-border/50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <History className="h-5 w-5 text-blue-500" />
                    Relatório de Alterações
                  </CardTitle>
                  <CardDescription>
                    {updateHistory.length} produtos tiveram seus níveis de segurança atualizados com base no consumo real.
                  </CardDescription>
                </div>
                
                {/* --- MENU DE EXPORTAÇÃO --- */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
                      <Download className="h-4 w-4" />
                      Exportar
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Escolha o formato</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                      <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                      <span>Excel (.xlsx)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF} className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4 text-red-600" />
                      <span>PDF (.pdf)</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              </CardHeader>
              
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Média/Dia</TableHead>
                        <TableHead className="text-center">Antes</TableHead>
                        <TableHead className="text-center">Depois</TableHead>
                        <TableHead className="text-right">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {updateHistory.map((item) => {
                        const diff = item.newMin - item.oldMin;
                        const isPositive = diff > 0;
                        const isNeutral = diff === 0;

                        return (
                          <TableRow key={item.id} className="hover:bg-muted/20">
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="text-sm text-foreground font-semibold">{item.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{item.avgConsumption}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{item.oldMin}</TableCell>
                            <TableCell className="text-center font-bold text-foreground bg-muted/20">{item.newMin}</TableCell>
                            <TableCell className="text-right">
                              {isNeutral ? (
                                <Badge variant="outline" className="text-muted-foreground">-</Badge>
                              ) : (
                                <div className="flex justify-end">
                                  <Badge className={`gap-1 w-16 justify-center ${
                                    isPositive 
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' 
                                      : 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                  }`}>
                                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    {Math.abs(diff)}
                                  </Badge>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
              <CardFooter className="bg-muted/20 text-xs text-muted-foreground p-3 text-center block">
                Dados reais calculados em {new Date().toLocaleTimeString()}.
              </CardFooter>
            </Card>
          ) : (
            // VISUAL DA SIMULAÇÃO (QUANDO NÃO HÁ DADOS RECENTES)
            <div className="space-y-6">
              <Card className="shadow-lg border-border bg-card overflow-hidden">
                <CardHeader className="pb-2 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                      Simulação de Cobertura
                    </CardTitle>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">
                      Previsão (Dados Fictícios)
                    </Badge>
                  </div>
                  <CardDescription>
                    Projeção de como o novo cálculo cobriria a demanda. Clique em "Calcular" para ver dados reais.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" hide={true} />
                        <YAxis hide={true} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        />
                        <ReferenceLine y={avgConsumption} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Média', fill: '#ef4444', fontSize: 10 }} />
                        <Area 
                          type="monotone" 
                          dataKey="consumo" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorConsumo)" 
                          name="Consumo Simulado"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Cards de KPI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Média Diária (Ex)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-foreground">{avgConsumption.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">un</span></div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dias Segurança</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">15 <span className="text-sm font-normal text-muted-foreground">dias</span></div>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20 shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-bold text-primary uppercase tracking-wider">Novo Mínimo (Ex)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-extrabold text-primary">{simulatedMinStock} <span className="text-sm font-normal text-primary/70">un</span></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Dica Contextual */}
          <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900 shadow-none mt-4">
            <CardContent className="p-4 flex gap-4 items-start">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Dica de Gestão</p>
                <p className="text-xs text-amber-700 dark:text-amber-500/90 leading-relaxed">
                  Após calcular, os produtos com consumo real serão listados aqui. Utilize o botão de exportação para salvar um histórico dessas alterações.
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}