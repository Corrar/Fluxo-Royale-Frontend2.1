import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  FileSpreadsheet, FileText, 
  TrendingDown, TrendingUp, RefreshCw, Activity,
  Package, ClipboardCheck, ArrowUpRight, ArrowDownRight, Archive, Calendar as CalendarIcon, AlertTriangle, PackageMinus, Clock
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas"; 
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LabelList
} from "recharts";
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

// --- CONFIGURAÇÕES VISUAIS PREMIUM ---
const C_AZUL_ROYALE: [number, number, number] = [28, 69, 135];
const C_AMARELO_OURO: [number, number, number] = [255, 217, 19];
const C_TEXTO_ESCURO: [number, number, number] = [40, 44, 52];
const C_CINZA_CLARO: [number, number, number] = [241, 245, 249];

const COLORS = ['#1C4587', '#FFD913', '#10b981', '#ef4444', '#8b5cf6', '#f97316'];

// --- FUNÇÃO DE CARREGAMENTO SEGURA DA LOGO ---
const getBase64FromUrl = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status da imagem: ${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) resolve(reader.result as string);
        else resolve("");
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Aviso: Logo não carregada. O PDF será gerado sem ela.", error);
    return ""; 
  }
};

// --- COMPONENTE TOOLTIP PERSONALIZADO PARA BARRA ---
const CustomBarTooltip = ({ active, payload, label, totalValue }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const percent = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
    
    return (
      <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-sm z-50 backdrop-blur-sm">
        <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
        <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex justify-between gap-4">
                <span>Quantidade:</span>
                <span className="font-bold text-slate-900 dark:text-white">{value}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span>Representatividade:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{percent}%</span>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

// --- COMPONENTE DE GRÁFICO DE BARRAS POR SETOR ---
const SectorBarChart = ({ data, totalValue, title, icon: Icon, color }: any) => {
    const processedData = useMemo(() => {
        if(!data) return [];
        return data.map((item: any) => ({
            ...item,
            labelContent: `${item.value}  (${((item.value / totalValue) * 100).toFixed(1)}%)`
        }));
    }, [data, totalValue]);

    return (
        <Card className="shadow-md border-none bg-white dark:bg-slate-950 h-full flex flex-col rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                    {Icon && <Icon className={`h-5 w-5 ${color || "text-indigo-500"}`} />} {title}
                </CardTitle>
                <CardDescription>
                    Total: <span className="font-bold text-slate-900 dark:text-white">{totalValue}</span> registros
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[350px]">
                {processedData && processedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={processedData} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b'}} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomBarTooltip totalValue={totalValue} />} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" fill={color === 'text-indigo-500' ? '#6366f1' : '#f59e0b'} radius={[0, 4, 4, 0]} barSize={24} isAnimationActive={false}>
                                <LabelList dataKey="labelContent" position="right" style={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3 min-h-[250px]">
                        <Archive className="h-8 w-8 opacity-50" />
                        <span className="text-sm">Sem dados registrados.</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// --- KPICard ---
const KPICard = ({ title, value, subtext, icon: Icon, colorClass, bgClass, trend }: any) => (
    <Card className="relative overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-950 group">
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-slate-200 to-transparent dark:via-slate-800 opacity-50"></div>
        <div className={`absolute right-0 top-0 p-8 rounded-bl-full opacity-[0.08] dark:opacity-[0.15] transition-transform group-hover:scale-110 duration-500 ${bgClass.replace('bg-', 'bg-current text-')}`}>
            <Icon className="w-24 h-24" />
        </div>
        <CardContent className="p-6 relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 ${bgClass} ${colorClass}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <Badge variant="secondary" className={`font-medium px-2.5 py-1 rounded-full border ${trend === 'up' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900' : trend === 'down' ? 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900' : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900'}`}>
                        {trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5 mr-1" /> : trend === 'down' ? <ArrowDownRight className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                        {trend === 'up' ? 'Entrada' : trend === 'down' ? 'Saída' : 'Atenção'}
                    </Badge>
                )}
            </div>
            <div>
                <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{title}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block"></span> {subtext}
                </p>
            </div>
        </CardContent>
    </Card>
);

// --- COMPONENTE PRINCIPAL ---
export default function Reports() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(startOfMonth(new Date()).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(endOfMonth(new Date()).toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("insights"); 

  // Busca Relatório de Movimentações
  const { data: reportData, isLoading: isLoadingReports, refetch: refetchReports } = useQuery({
    queryKey: ["reports-general", startDate, endDate],
    queryFn: async () => {
      const response = await api.get("/reports/general", { params: { startDate, endDate } });
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  // Busca Dados de Saúde de Estoque (Low Stock)
  const { data: lowStockData, isLoading: isLoadingStock, refetch: refetchStock } = useQuery({
    queryKey: ["reports-low-stock"],
    queryFn: async () => {
      const response = await api.get("/products/low-stock");
      return response.data;
    },
    refetchOnWindowFocus: false
  });

  const isLoading = isLoadingReports || isLoadingStock;

  // Animação de transição de abas (GSAP)
  useGSAP(() => {
    gsap.fromTo(".tab-animate", 
      { y: 15, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out", clearProps: "all" }
    );
  }, { scope: containerRef, dependencies: [activeTab, isLoading] });

  // Processamento de Dados Movimentações
  const analytics = useMemo(() => {
    if (!reportData) return null;
    const entradas = reportData.entradas || [];
    const saidasManual = (reportData.saidas_separacoes || []).map((i: any) => ({ ...i, origem_tipo: 'MANUAL' }));
    const saidasSolicitacao = (reportData.saidas_solicitacoes || []).map((i: any) => ({ ...i, origem_tipo: 'SISTEMA' })); 
    const todasSaidas = [...saidasManual, ...saidasSolicitacao].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const todasEntradas = [...entradas].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const timelineMap = new Map();
    const processDate = (dateStr: string, type: string) => {
      const dateKey = format(new Date(dateStr), 'dd/MM');
      if (!timelineMap.has(dateKey)) timelineMap.set(dateKey, { name: dateKey, entradas: 0, saidas_sistema: 0, saidas_manual: 0 });
      const entry = timelineMap.get(dateKey);
      if (type === 'in') entry.entradas += 1;
      else if (type === 'out_sis') entry.saidas_sistema += 1;
      else entry.saidas_manual += 1;
    };

    entradas.forEach((i: any) => processDate(i.data, 'in'));
    saidasSolicitacao.forEach((i: any) => processDate(i.data, 'out_sis'));
    saidasManual.forEach((i: any) => processDate(i.data, 'out_man'));

    const chartData = Array.from(timelineMap.values()).sort((a, b) => {
       const [d1, m1] = a.name.split('/').map(Number);
       const [d2, m2] = b.name.split('/').map(Number);
       return m1 - m2 || d1 - d2;
    });

    const processSectors = (list: any[], group: boolean) => {
        const map = new Map();
        list.forEach(i => {
            let s = i.destino_setor || "Não Informado";
            if (s === '-' || s === '') s = "Avulso / Balcão";
            map.set(s, (map.get(s) || 0) + 1);
        });
        const raw = Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        if (!group || raw.length <= 10) return raw; 
        const final = raw.slice(0, 10);
        final.push({ name: "Outros", value: raw.slice(10).reduce((acc, c) => acc + c.value, 0) });
        return final;
    };

    const getTopProducts = (list: any[]) => {
        const pMap = new Map();
        list.forEach(i => pMap.set(i.produto, (pMap.get(i.produto) || 0) + Number(i.quantidade)));
        return Array.from(pMap.entries()).map(([name, qtd]) => ({ name, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 5);
    };

    return {
      opsEntrada: entradas.length,
      opsSaidaTotal: todasSaidas.length,
      opsSaidaSistema: saidasSolicitacao.length,
      opsSaidaManual: saidasManual.length,
      volItensEntrada: entradas.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0),
      volItensSaida: todasSaidas.reduce((acc: number, i: any) => acc + Number(i.quantidade), 0),
      chartData,
      sectorDataSolicitacao: processSectors(saidasSolicitacao, true),
      sectorDataManual: processSectors(saidasManual, false),
      topProductsSaida: getTopProducts(todasSaidas),
      topProductsEntrada: getTopProducts(entradas),
      raw: { todasEntradas, todasSaidas },
      totalSolicitacao: saidasSolicitacao.length,
      totalManual: saidasManual.length
    };
  }, [reportData]);

  // Processamento de Dados Saúde do Estoque
  const stockHealth = useMemo(() => {
    if (!lowStockData) return { total: 0, deficit: 0, urgent: 0, items: [] };
    let total = 0;
    let deficit = 0;
    let urgent = 0;
    const itemsEmRuptura: any[] = [];

    lowStockData.forEach((item: any) => {
      const min = Number(item.min_stock || 0);
      const disp = Number(item.quantity || 0) - Number(item.quantity_reserved || 0);
      
      if (disp < min) {
          total++;
          deficit += (min - disp);
          itemsEmRuptura.push(item);
      }

      const days = differenceInDays(new Date(), item.critical_since ? new Date(item.critical_since) : new Date());
      if (days >= 30 && disp < min) urgent++;
    });

    return { total, deficit, urgent, items: itemsEmRuptura };
  }, [lowStockData]);

  const handleExportExcel = () => {
    if (!analytics) return;
    const wb = XLSX.utils.book_new();
    const summaryData = [
        { Metrica: "Total Saídas", Valor: analytics.opsSaidaTotal },
        { Metrica: "Total Entradas", Valor: analytics.opsEntrada },
        { Metrica: "Volume Saída", Valor: analytics.volItensSaida },
        { Metrica: "Volume Entrada", Valor: analytics.volItensEntrada },
        { Metrica: "Itens em Ruptura (Stock)", Valor: stockHealth.total },
        { Metrica: "Déficit Total (Peças)", Valor: stockHealth.deficit }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasEntradas.map(i => ({
        Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'),
        Produto: i.produto, Qtd: i.quantidade, Origem: i.origem || 'Fornecedor'
    }))), "Entradas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analytics.raw.todasSaidas.map(i => ({
        Data: format(new Date(i.data), 'dd/MM/yyyy HH:mm'),
        Tipo: i.origem_tipo === 'SISTEMA' ? 'Solicitação' : 'Manual',
        Produto: i.produto, Qtd: i.quantidade, Destino: i.destino_setor
    }))), "Saidas");
    
    // Adicionar aba de Saúde do Estoque no Excel
    if (stockHealth.items.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockHealth.items.map(i => ({
            SKU: i.sku,
            Produto: i.name,
            Minimo: i.min_stock,
            Disponivel: Number(i.quantity) - Number(i.quantity_reserved),
            Falta: Number(i.min_stock) - (Number(i.quantity) - Number(i.quantity_reserved))
        }))), "Saude Estoque");
    }

    XLSX.writeFile(wb, `Relatorio_${startDate}.xlsx`);
    toast.success("Excel gerado!");
  };

  // =========================================================
  // GERAÇÃO DO PDF (COM SAÚDE DO ESTOQUE)
  // =========================================================
  const handleExportPDF = async () => {
    if (!analytics) return;
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    
    toast.loading("Gerando relatório Royale Completo...");

    const logoUrl = '/logo-royale.png'; 
    const logoBase64 = await getBase64FromUrl(logoUrl);

    const drawHeader = (title: string) => {
        doc.setFillColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setFillColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
        doc.rect(0, 40, pageWidth, 1.5, 'F');

        if (logoBase64 && logoBase64.length > 50) {
            try {
                const imgProps = doc.getImageProperties(logoBase64);
                const imgWidth = 45; 
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                const yPos = (40 - imgHeight) / 2;
                doc.addImage(logoBase64, 'PNG', margin, yPos, imgWidth, imgHeight);
            } catch (err) {
                doc.setFontSize(22);
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.text("ROYALE", margin, 26);
            }
        } else {
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text("ROYALE", margin, 26);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), pageWidth - margin, 20, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(`Período Mov: ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`, pageWidth - margin, 28, { align: "right" });
    };

    const drawFooter = (pageNumber: number) => {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, pageHeight - 10);
        doc.text(`Página ${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    };

    const drawKpiCard = (x: number, y: number, w: number, h: number, title: string, value: string | number, type: 'primary' | 'secondary' | 'alert') => {
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(x + 1, y + 1, w, h, 2, 2, 'F');
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(220, 220, 220); 
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');
        if (type === 'primary') doc.setFillColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]); 
        else if (type === 'secondary') doc.setFillColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]); 
        else doc.setFillColor(220, 38, 38); // Alert color (Red)

        doc.rect(x, y, 2, h, 'F');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), x + 5, y + 8);
        doc.setFontSize(14);
        doc.setTextColor(C_TEXTO_ESCURO[0], C_TEXTO_ESCURO[1], C_TEXTO_ESCURO[2]);
        doc.text(String(value), x + 5, y + 18);
    };

    try {
        // --- PÁGINA 1: MOVIMENTAÇÕES ---
        drawHeader("Relatório Geral de Logística");
        doc.setTextColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo de Movimentações", margin, 55);

        const kpiW = 42;
        const kpiH = 24;
        const kpiGap = 5;

        drawKpiCard(margin, 60, kpiW, kpiH, "Total Saídas", analytics.opsSaidaTotal, 'primary');
        drawKpiCard(margin + kpiW + kpiGap, 60, kpiW, kpiH, "Solicitações", analytics.opsSaidaSistema, 'secondary');
        drawKpiCard(margin + (kpiW + kpiGap) * 2, 60, kpiW, kpiH, "Saída Manual", analytics.opsSaidaManual, 'secondary');
        drawKpiCard(margin + (kpiW + kpiGap) * 3, 60, kpiW, kpiH, "Total Entradas", analytics.opsEntrada, 'primary');

        // GRÁFICO (COM PROTEÇÃO)
        const chartY = 100;
        doc.setFontSize(11);
        doc.setTextColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
        doc.text("Fluxo de Movimentação (Diário)", margin, chartY - 3);

        const flowChart = document.getElementById('chart-flow');
        if (flowChart) {
            try {
                const canvas = await html2canvas(flowChart, { scale: 3, backgroundColor: null });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pageWidth - (margin * 2);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                doc.setFillColor(C_CINZA_CLARO[0], C_CINZA_CLARO[1], C_CINZA_CLARO[2]);
                doc.roundedRect(margin, chartY, imgWidth, imgHeight, 2, 2, 'F');
                doc.addImage(imgData, 'PNG', margin, chartY, imgWidth, imgHeight);
            } catch (err) {
                doc.setFontSize(9);
                doc.text("Erro ao renderizar gráfico.", margin, chartY + 10);
            }
        } else {
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text("(Aceda à aba 'Visão Geral' para capturar o gráfico)", margin, chartY + 10);
        }

        drawFooter((doc.internal as any).getNumberOfPages());

        // --- PÁGINA 2: SAÚDE DO ESTOQUE (NOVO) ---
        doc.addPage();
        drawHeader("Saúde do Estoque");
        doc.setTextColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo de Ruturas Atuais", margin, 55);

        drawKpiCard(margin, 60, kpiW, kpiH, "Produtos em Fila", stockHealth.total, 'alert');
        drawKpiCard(margin + kpiW + kpiGap, 60, kpiW, kpiH, "Défice de Peças", stockHealth.deficit, 'secondary');
        drawKpiCard(margin + (kpiW + kpiGap) * 2, 60, kpiW, kpiH, "Urgentes (+30d)", stockHealth.urgent, 'alert');

        if (stockHealth.items.length > 0) {
            autoTable(doc, {
                startY: 95,
                head: [['SKU', 'Produto', 'Disp.', 'Mín.', 'Faltam']],
                body: stockHealth.items.map((i: any) => {
                    const disp = Number(i.quantity) - Number(i.quantity_reserved);
                    const min = Number(i.min_stock);
                    return [i.sku, i.name, disp, min, min - disp];
                }),
                theme: 'striped',
                headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 3, textColor: C_TEXTO_ESCURO },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 'auto' },
                    2: { cellWidth: 20, halign: 'center' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [200, 0, 0] }
                },
                margin: { top: 50, left: margin, right: margin }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text("Não existem produtos em rutura crítica no momento.", margin, 95);
        }
        drawFooter((doc.internal as any).getNumberOfPages());

        // --- PÁGINA 3: SETORES ---
        doc.addPage();
        drawHeader("Detalhamento de Saídas por Setor");

        const saidas = analytics.raw.todasSaidas;
        const setoresUnicos = Array.from(new Set(saidas.map((i: any) => i.destino_setor || "NÃO INFORMADO"))) as string[];
        
        setoresUnicos.sort((a, b) => {
            const na = a.toLowerCase(), nb = b.toLowerCase();
            if (na.includes('esteira') && !nb.includes('esteira')) return -1;
            if (!na.includes('esteira') && nb.includes('esteira')) return 1;
            return na.localeCompare(nb);
        });

        let currentY = 50;

        setoresUnicos.forEach((setor) => {
            const dadosSetor = saidas.filter((i: any) => (i.destino_setor || "NÃO INFORMADO") === setor);
            dadosSetor.sort((a: any, b: any) => (a.origem_tipo === 'SISTEMA' ? -1 : 1));

            if (currentY > pageHeight - 40) {
                drawFooter((doc.internal as any).getNumberOfPages());
                doc.addPage();
                drawHeader("Detalhamento de Saídas por Setor");
                currentY = 50;
            }

            doc.setFillColor(C_AMARELO_OURO[0], C_AMARELO_OURO[1], C_AMARELO_OURO[2]);
            doc.rect(margin, currentY - 4, 3, 3, 'F');

            doc.setFontSize(11);
            doc.setTextColor(C_AZUL_ROYALE[0], C_AZUL_ROYALE[1], C_AZUL_ROYALE[2]);
            doc.setFont("helvetica", "bold");
            doc.text(`SETOR: ${setor.toUpperCase()}`, margin + 5, currentY - 1);

            autoTable(doc, {
                startY: currentY + 2,
                head: [['Data', 'Tipo', 'Produto', 'Qtd']],
                body: dadosSetor.map((i: any) => [
                    format(new Date(i.data), "dd/MM HH:mm"),
                    i.origem_tipo === 'SISTEMA' ? 'SOLICITAÇÃO' : 'MANUAL',
                    i.produto,
                    i.quantidade
                ]),
                theme: 'striped',
                headStyles: { fillColor: C_AZUL_ROYALE, textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 8, cellPadding: 3, textColor: C_TEXTO_ESCURO },
                columnStyles: {
                    0: { cellWidth: 30 },
                    1: { cellWidth: 35, fontStyle: 'bold' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
                },
                didDrawPage: (data) => { currentY = data.cursor.y + 15; },
                margin: { left: margin, right: margin }
            });
        });

        // --- PÁGINA 4: GRÁFICOS SETORES ---
        doc.addPage();
        drawHeader("Análise Visual de Setores");
        let pdfY = 50; 
        const chartIds = ['chart-sector-solicitacao', 'chart-sector-manual'];
        
        for (const id of chartIds) {
            const element = document.getElementById(id);
            if (element) {
                try {
                    const canvas = await html2canvas(element, { scale: 2, backgroundColor: null });
                    const imgData = canvas.toDataURL('image/png');
                    const imgWidth = pageWidth - (margin * 2);
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    if (pdfY + imgHeight > pageHeight - 40) { 
                        doc.addPage();
                        drawHeader("Análise Visual de Setores");
                        pdfY = 50;
                    }

                    doc.addImage(imgData, 'PNG', margin, pdfY, imgWidth, imgHeight);
                    pdfY += imgHeight + 10; 
                } catch (e) {}
            }
        }

        // --- ASSINATURA ---
        const signatureHeight = 30;
        let sigY = pdfY + 10;
        if (sigY + signatureHeight < pageHeight - 30) {
             sigY = pageHeight - 45; 
        } else if (sigY + signatureHeight > pageHeight - 15) {
             doc.addPage();
             drawHeader("Validação");
             sigY = pageHeight - 45;
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(40, 44, 52); 
        doc.text("Ass: _______________________________________________", margin, sigY);
        doc.setFont("helvetica", "bold");
        doc.text("Evandro Luiz Campos", margin, sigY + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100); 
        doc.text("Responsável pelo Almoxarifado", margin, sigY + 11);

        const totalPages = (doc.internal as any).getNumberOfPages();
        for(let i=1; i <= totalPages; i++) {
            doc.setPage(i);
            drawFooter(i);
        }

        doc.save(`Royale_Report_Completo_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        toast.dismiss();
        toast.success("PDF Royale exportado com sucesso!");

    } catch (error) {
        console.error("ERRO CRÍTICO AO GERAR PDF:", error);
        toast.dismiss();
        toast.error("Erro ao gerar PDF. Verifique o console.");
    }
  };

  const setQuickDate = (type: 'month' | 'last30' | 'today' | 'week') => {
    const now = new Date();
    if (type === 'month') {
      setStartDate(startOfMonth(now).toISOString().split('T')[0]);
      setEndDate(endOfMonth(now).toISOString().split('T')[0]);
    } else if (type === 'last30') {
      setStartDate(subDays(now, 30).toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'today') {
        setStartDate(now.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    } else if (type === 'week') {
        setStartDate(subDays(now, 7).toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }
  };

  return (
    <div ref={containerRef} className="space-y-8 p-6 bg-slate-50/50 dark:bg-slate-900/50 min-h-screen">
      
      {/* HEADER E FILTROS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
        <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/20">
                    <Activity className="h-8 w-8 text-white" />
                </div>
                Relatórios e Painel Gerencial
            </h1>
            <p className="text-slate-500 mt-2 ml-[4.5rem] font-medium">
                Controlo total de movimentações e alertas de stock.
            </p>
        </div>

        <div className="flex flex-col gap-4 w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 w-full sm:w-auto">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <Input type="date" className="h-9 w-32 border-none bg-transparent focus-visible:ring-0 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="text-slate-300 mx-1">→</span>
                    <Input type="date" className="h-9 w-32 border-none bg-transparent focus-visible:ring-0 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                
                <div className="flex gap-1 p-1 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Button onClick={() => setQuickDate('today')} variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium rounded-lg text-slate-600">Hoje</Button>
                    <Button onClick={() => setQuickDate('week')} variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium rounded-lg text-slate-600">7 Dias</Button>
                    <Button onClick={() => setQuickDate('month')} variant="ghost" size="sm" className="h-9 px-3 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700">Mês</Button>
                </div>

                <Button onClick={() => { refetchReports(); refetchStock(); }} size="icon" className="h-11 w-11 rounded-xl bg-white border border-slate-200 shadow-sm hover:scale-105 active:scale-95 text-slate-600">
                    <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>
        </div>
      </div>

      {/* TABS E CONTEÚDO PRINCIPAL */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <TabsList className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl gap-1 h-auto flex flex-wrap sm:flex-nowrap">
            <TabsTrigger value="insights" className="rounded-lg px-4 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-indigo-600 font-medium">Movimentações</TabsTrigger>
            <TabsTrigger value="saude" className="rounded-lg px-4 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-rose-600 font-medium flex gap-2">Saúde do Estoque {stockHealth.total > 0 && <span className="bg-rose-100 text-rose-700 px-1.5 rounded-md text-xs">{stockHealth.total}</span>}</TabsTrigger>
            <TabsTrigger value="entradas" className="rounded-lg px-4 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 font-medium">Entradas</TabsTrigger>
            <TabsTrigger value="saidas" className="rounded-lg px-4 sm:px-6 py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 font-medium">Saídas</TabsTrigger>
          </TabsList>
          
          <div className="flex gap-3 px-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="rounded-xl border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors">
                <FileText className="w-4 h-4 mr-2" /> PDF Royale
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="rounded-xl border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>

        {/* ABA: MOVIMENTAÇÕES (Antigo Insights) */}
        <TabsContent value="insights" className="space-y-6">
          <div className="tab-animate grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard title="Total Saídas" value={analytics?.opsSaidaTotal || 0} subtext="Volume total no período" icon={TrendingDown} colorClass="text-blue-600 dark:text-blue-400" bgClass="bg-blue-100 dark:bg-blue-900/20" trend="down" />
            <KPICard title="Total Entradas" value={analytics?.opsEntrada || 0} subtext="Recebimentos confirmados" icon={TrendingUp} colorClass="text-emerald-600 dark:text-emerald-400" bgClass="bg-emerald-100 dark:bg-emerald-900/20" trend="up" />
            <KPICard title="Solicitações" value={analytics?.opsSaidaSistema || 0} subtext="Pedidos via sistema" icon={ClipboardCheck} colorClass="text-violet-600 dark:text-violet-400" bgClass="bg-violet-100 dark:bg-violet-900/20" />
            <KPICard title="Saída Manual" value={analytics?.opsSaidaManual || 0} subtext="Retiradas avulsas" icon={Package} colorClass="text-amber-600 dark:text-amber-400" bgClass="bg-amber-100 dark:bg-amber-900/20" />
          </div>

          <Card id="chart-flow" className="tab-animate shadow-md border-none bg-white dark:bg-slate-950 rounded-2xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">Fluxo de Movimentação</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 mt-1">Análise comparativa diária de entradas vs. saídas</CardDescription>
            </CardHeader>
            <CardContent className="h-[450px] w-full pt-6 px-6">
                {analytics && (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={12} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} dy={10} />
                        <YAxis fontSize={12} axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                        <Tooltip cursor={{fill: '#f8fafc', opacity: 0.1}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Bar dataKey="entradas" name="Entradas" fill={COLORS[2]} radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="saidas_sistema" name="Solicitações" fill={COLORS[0]} radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="saidas_manual" name="Saída Manual" fill={COLORS[1]} radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
                )}
            </CardContent>
          </Card>

          <div className="tab-animate grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div id="chart-sector-solicitacao" className="w-full">
                 <SectorBarChart data={analytics?.sectorDataSolicitacao} totalValue={analytics?.totalSolicitacao} title="Solicitações por Setor" icon={ClipboardCheck} color="text-indigo-500" />
             </div>
             <div id="chart-sector-manual" className="w-full">
                 <SectorBarChart data={analytics?.sectorDataManual} totalValue={analytics?.totalManual} title="Saídas Manuais por Destino" icon={Package} color="text-amber-500" />
             </div>
          </div>
        </TabsContent>

        {/* ABA NOVA: SAÚDE DO ESTOQUE */}
        <TabsContent value="saude" className="space-y-6">
           <div className="tab-animate grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="Itens em Rutura" value={stockHealth.total} subtext="Requerem ação imediata" icon={AlertTriangle} colorClass="text-rose-600" bgClass="bg-rose-100" trend="alert" />
                <KPICard title="Déficit Total" value={stockHealth.deficit} subtext="Peças a comprar (Mínimo)" icon={PackageMinus} colorClass="text-amber-600" bgClass="bg-amber-100" />
                <KPICard title="Parados Há +30 Dias" value={stockHealth.urgent} subtext="Risco elevado de paragem" icon={Clock} colorClass="text-red-600" bgClass="bg-red-100" />
           </div>

           <Card className="tab-animate shadow-sm border-none rounded-2xl bg-white dark:bg-slate-950">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-rose-500" /> Produtos Críticos
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="w-[120px]">SKU</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead className="text-center">Disponível</TableHead>
                                <TableHead className="text-center">Mínimo Exigido</TableHead>
                                <TableHead className="text-right">Peças em Falta</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockHealth.items.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-500">Nenhum alerta de rutura detetado.</TableCell></TableRow>
                            ) : (
                                stockHealth.items.map((item: any, idx: number) => {
                                    const disp = Number(item.quantity) - Number(item.quantity_reserved);
                                    const deficit = Number(item.min_stock) - disp;
                                    return (
                                        <TableRow key={idx} className="hover:bg-rose-50/30">
                                            <TableCell className="font-mono text-xs text-slate-500">{item.sku}</TableCell>
                                            <TableCell className="font-medium text-slate-800">{item.name}</TableCell>
                                            <TableCell className="text-center font-semibold text-slate-600">{disp}</TableCell>
                                            <TableCell className="text-center font-bold text-slate-800">{item.min_stock}</TableCell>
                                            <TableCell className="text-right font-black text-rose-600">-{deficit}</TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
           </Card>
        </TabsContent>

        {/* ABA: ENTRADAS */}
        <TabsContent value="entradas" className="space-y-6">
            <div className="tab-animate grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 shadow-sm border-none rounded-2xl bg-white dark:bg-slate-950">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-100"><TrendingUp className="h-4 w-4 text-emerald-600" /> Top Produtos</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                        {analytics?.topProductsEntrada.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-md flex items-center justify-center font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs">{idx + 1}</div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                                </div>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{item.qtd}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2 shadow-sm border-none rounded-2xl bg-white dark:bg-slate-950">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800"><CardTitle className="text-slate-800 dark:text-slate-100">Histórico de Entradas</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                                    <TableHead className="w-[150px] text-slate-500 dark:text-slate-400">Data</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400">Produto</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400">Origem</TableHead>
                                    <TableHead className="text-right text-slate-500 dark:text-slate-400">Qtd</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics?.raw.todasEntradas.map((i: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                                        <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-medium">{format(new Date(i.data), "dd/MM HH:mm")}</TableCell>
                                        <TableCell className="font-medium text-sm text-slate-700 dark:text-slate-200">{i.produto}</TableCell>
                                        <TableCell className="text-xs text-slate-500 dark:text-slate-400">{i.origem || '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-l-md">+{i.quantidade}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        {/* ABA: SAÍDAS */}
        <TabsContent value="saidas" className="space-y-6">
            <div className="tab-animate grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 shadow-sm border-none rounded-2xl bg-white dark:bg-slate-950">
                    <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <CardTitle className="text-base flex items-center gap-2 text-slate-800 dark:text-slate-100"><TrendingDown className="h-4 w-4 text-red-600" /> Top Retirados</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                        {analytics?.topProductsSaida.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-md flex items-center justify-center font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs">{idx + 1}</div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                                </div>
                                <span className="text-sm font-bold text-red-600 dark:text-red-400">-{item.qtd}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2 shadow-sm border-none rounded-2xl bg-white dark:bg-slate-950">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800"><CardTitle className="text-slate-800 dark:text-slate-100">Histórico de Saídas</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                                    <TableHead className="w-[150px] text-slate-500 dark:text-slate-400">Data</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400">Tipo</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400">Produto</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400">Destino</TableHead>
                                    <TableHead className="text-right text-slate-500 dark:text-slate-400">Qtd</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {analytics?.raw.todasSaidas.map((i: any, idx: number) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-100 dark:border-slate-800">
                                        <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-medium">{format(new Date(i.data), "dd/MM HH:mm")}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] ${i.origem_tipo === 'SISTEMA' ? 'border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30' : 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30'}`}>
                                                {i.origem_tipo}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-sm text-slate-700 dark:text-slate-200">{i.produto}</TableCell>
                                        <TableCell className="text-sm text-slate-500 dark:text-slate-400">{i.destino_setor || '-'}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 rounded-l-md">-{i.quantidade}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
