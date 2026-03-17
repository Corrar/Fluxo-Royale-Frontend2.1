import { useState } from "react";
import * as XLSX from 'xlsx';
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, AlertTriangle, ArrowLeft, Upload, FileSpreadsheet, Plus, Trash2,
  ArrowRightLeft, FileText, Download, Scale, MapPin, Users 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToExcel } from "@/utils/exportUtils"; // Removi exportToPDF pois faremos manual
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Definição do tipo de item
interface TravelItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
}

interface ComparisonResult extends TravelItem {
  returnedQuantity: number;
  status: 'ok' | 'missing' | 'extra';
  difference: number;
}

export default function TravelReconciliation() {
  const navigate = useNavigate();

  // Estados de Dados
  const [outboundList, setOutboundList] = useState<TravelItem[]>([]);
  const [inboundList, setInboundList] = useState<TravelItem[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult[]>([]);
  
  // Estados para o Cabeçalho
  const [technicians, setTechnicians] = useState("");
  const [city, setCity] = useState("");

  // Estados para Itens Manuais
  const [manualOutbound, setManualOutbound] = useState({ sku: "", name: "", quantity: "", unit: "" });
  const [manualInbound, setManualInbound] = useState({ sku: "", name: "", quantity: "", unit: "" });

  // 1. BUSCAR PRODUTOS (Para Auto-Complete)
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 1000 * 60 * 10,
  });

  const findProduct = (sku: string) => products.find((p: any) => p.sku === sku);

  // HANDLER INTELIGENTE DE SKU
  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'outbound' | 'inbound') => {
    const newSku = e.target.value;
    const setInput = type === 'outbound' ? setManualOutbound : setManualInbound;
    const currentInput = type === 'outbound' ? manualOutbound : manualInbound;

    const updatedInput = { ...currentInput, sku: newSku };
    const found = findProduct(newSku);
    if (found) {
      updatedInput.name = found.name;
      updatedInput.unit = found.unit || "un";
    }
    setInput(updatedInput);
  };

  // LEITURA DE EXCEL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'outbound' | 'inbound') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const formattedData: TravelItem[] = data.map((row: any) => ({
        sku: String(row['sku'] || row['SKU'] || row['Codigo'] || row['Código'] || row['id'] || "Unknown"),
        name: String(row['name'] || row['Nome'] || row['Produto'] || row['Descricao'] || "Item sem nome"),
        quantity: Number(row['quantity'] || row['qtd'] || row['Qtd'] || row['Quantidade'] || 0),
        unit: String(row['unit'] || row['unidade'] || row['un'] || row['medida'] || "un")
      })).filter(item => item.quantity > 0);

      if (type === 'outbound') {
        setOutboundList(formattedData);
        toast.success(`${formattedData.length} itens carregados na Saída.`);
      } else {
        setInboundList(formattedData);
        toast.success(`${formattedData.length} itens carregados no Retorno.`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // ADICIONAR ITEM MANUAL
  const addManualItem = (type: 'outbound' | 'inbound') => {
    const itemData = type === 'outbound' ? manualOutbound : manualInbound;
    const setList = type === 'outbound' ? setOutboundList : setInboundList;
    const setInput = type === 'outbound' ? setManualOutbound : setManualInbound;

    const qtd = parseFloat(itemData.quantity);

    if (!itemData.sku || !itemData.quantity) {
      toast.warning("Preencha SKU e Quantidade");
      return;
    }

    if (qtd <= 0) {
      toast.warning("A quantidade deve ser maior que zero.");
      return;
    }

    const newItem: TravelItem = {
      sku: itemData.sku,
      name: itemData.name || "Item Manual",
      quantity: qtd,
      unit: itemData.unit || "un"
    };

    setList(prev => {
      const existing = prev.find(i => i.sku === newItem.sku);
      if (existing) {
        return prev.map(i => i.sku === newItem.sku ? { ...i, quantity: i.quantity + newItem.quantity } : i);
      }
      return [...prev, newItem];
    });

    setInput({ sku: "", name: "", quantity: "", unit: "" });
  };

  const removeItem = (sku: string, type: 'outbound' | 'inbound') => {
    const setList = type === 'outbound' ? setOutboundList : setInboundList;
    setList(prev => prev.filter(i => i.sku !== sku));
  };

  // LÓGICA DE CONFRONTO
  const handleCompare = () => {
    if (outboundList.length === 0) {
      toast.error("A lista de SAÍDA está vazia.");
      return;
    }

    if (!technicians || !city) {
      toast.warning("Por favor, preencha o nome dos Técnicos e a Cidade antes de confrontar.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const results: ComparisonResult[] = [];
    const inboundMap = new Map(inboundList.map(i => [i.sku, i.quantity]));

    // 1. Verifica itens que saíram
    outboundList.forEach(outItem => {
      const returnedQty = inboundMap.get(outItem.sku) || 0;
      const diff = returnedQty - outItem.quantity;
      
      let status: 'ok' | 'missing' | 'extra' = 'ok';
      if (diff < 0) status = 'missing';
      if (diff > 0) status = 'extra';

      results.push({
        ...outItem,
        returnedQuantity: returnedQty,
        difference: diff,
        status
      });

      inboundMap.delete(outItem.sku);
    });

    // 2. Verifica itens que voltaram mas não saíram (Inesperados)
    inboundList.forEach(inItem => {
      if (inboundMap.has(inItem.sku)) {
        results.push({
          sku: inItem.sku,
          name: inItem.name,
          quantity: 0,
          unit: inItem.unit,
          returnedQuantity: inItem.quantity,
          difference: inItem.quantity,
          status: 'extra'
        });
      }
    });

    setComparisonResult(results);
    toast.success("Confronto realizado com sucesso!");
    
    // Rola para o resultado
    setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  // --- EXPORTAÇÃO PERSONALIZADA DO PDF ---
  const handleExportPDF = () => {
    if (comparisonResult.length === 0) {
        toast.error("Realize o confronto primeiro.");
        return;
    }

    const doc = new jsPDF();

    // 1. Título Principal (Letra Grande e Negrito)
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Confronto de Viagem", 14, 20);

    // 2. Subtítulos (Letra Menor)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100); // Cinza para o subtítulo

    const dateStr = new Date().toLocaleDateString();
    
    // Linha 1 de informações
    doc.text(`Cidade: ${city}  |  Técnicos: ${technicians}`, 14, 28);
    // Linha 2 de informações
    doc.text(`Data: ${dateStr}  |  Sistema: Fluxo Royale`, 14, 34);

    // 3. Tabela
    const tableColumn = ["SKU", "Produto", "Saída", "Retorno", "Dif.", "Status"];
    const tableRows: any[] = [];

    comparisonResult.forEach(item => {
        const rowData = [
            item.sku,
            item.name,
            item.quantity,
            item.returnedQuantity,
            item.difference,
            item.status === 'ok' ? "OK" : item.status === 'missing' ? "FALTA" : "SOBRA"
        ];
        tableRows.push(rowData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40, // Começa logo abaixo do cabeçalho
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] }, // Cor do cabeçalho da tabela (Slate-600)
    });

    doc.save(`Confronto_${city.replace(/\s/g, '_')}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  const handleExportExcel = () => {
    if (comparisonResult.length === 0) return;
    const exportData = comparisonResult.map(item => ({
        SKU: item.sku,
        Produto: item.name,
        "Qtd. Saída": item.quantity,
        "Qtd. Retorno": item.returnedQuantity,
        "Diferença": item.difference,
        "Status": item.status === 'ok' ? "OK" : item.status === 'missing' ? "FALTA" : "SOBRA"
    }));
    exportToExcel(exportData, `Confronto_${city.replace(/\s/g, '_')}`);
    toast.success("Excel baixado!");
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <Scale className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    Confronto de Viagem
                </h1>
                <p className="text-muted-foreground">Auditoria de materiais: Saída vs. Retorno físico.</p>
            </div>
        </div>

        {/* Botão de Exportar só aparece se tiver resultado */}
        {comparisonResult.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-dashed border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700 dark:hover:bg-blue-900/40">
                  <Download className="h-4 w-4" /> Exportar Resultado
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="dark:bg-slate-900 dark:border-slate-800">
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer dark:focus:bg-slate-800">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer dark:focus:bg-slate-800">
                  <FileText className="h-4 w-4 text-red-600" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        )}
      </div>

      {/* --- DADOS DA VIAGEM --- */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" /> Dados da Viagem
            </CardTitle>
            <CardDescription>Informe os detalhes para identificar este confronto no relatório.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="tecnicos">Nome dos Técnicos</Label>
                    <div className="relative">
                        <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="tecnicos" 
                            placeholder="Ex: João Silva, Maria Oliveira..." 
                            className="pl-9 bg-slate-50 dark:bg-slate-900/50"
                            value={technicians}
                            onChange={(e) => setTechnicians(e.target.value)}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cidade">Cidade / Destino</Label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id="cidade" 
                            placeholder="Ex: São Paulo - SP" 
                            className="pl-9 bg-slate-50 dark:bg-slate-900/50" 
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* ÁREA DE INPUTS (GRIDS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* --- COLUNA 1: SAÍDA (Ida) --- */}
        <Card className="border-t-4 border-t-blue-500 shadow-md dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-3 dark:border-slate-800">
            <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2 dark:text-slate-200">
                    <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" /> 
                    Lista de Saída (Ida)
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300">{outboundList.length} itens</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="upload" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">Upload Excel</TabsTrigger>
                <TabsTrigger value="manual" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">Manual</TabsTrigger>
              </TabsList>

              <TabsContent value="upload">
                <div className="bg-muted/30 hover:bg-muted/50 transition-colors p-6 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800/50 text-center">
                  <Label htmlFor="outbound-file" className="cursor-pointer block h-full">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="h-10 w-10 text-blue-400 dark:text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Clique para carregar planilha</span>
                      <span className="text-xs text-muted-foreground">Colunas: SKU, Nome, Qtd</span>
                    </div>
                  </Label>
                  <Input id="outbound-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, 'outbound')} />
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="grid gap-1 w-20">
                    <Label className="text-xs">SKU</Label>
                    <Input className="h-8 dark:bg-slate-800" placeholder="Cód." value={manualOutbound.sku} onChange={(e) => handleSkuChange(e, 'outbound')} />
                  </div>
                  <div className="grid gap-1 flex-1">
                    <Label className="text-xs">Produto</Label>
                    <Input className="h-8 dark:bg-slate-800" placeholder="Nome" value={manualOutbound.name} onChange={e => setManualOutbound({...manualOutbound, name: e.target.value})} />
                  </div>
                  <div className="grid gap-1 w-16">
                    <Label className="text-xs">Qtd.</Label>
                    {/* INPUT COM PROTEÇÃO CONTRA NEGATIVOS */}
                    <Input 
                      className="h-8 dark:bg-slate-800" 
                      type="number" 
                      min="0"
                      placeholder="0" 
                      value={manualOutbound.quantity} 
                      onKeyDown={(e) => ["-", "e", "+"].includes(e.key) && e.preventDefault()}
                      onChange={e => setManualOutbound({...manualOutbound, quantity: e.target.value})} 
                    />
                  </div>
                  <Button size="sm" onClick={() => addManualItem('outbound')} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"><Plus className="h-4 w-4" /></Button>
                </div>
              </TabsContent>

              {outboundList.length > 0 && (
                <div className="rounded-md border dark:border-slate-800 h-64 overflow-hidden mt-4 bg-white dark:bg-slate-950">
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10 dark:bg-slate-900">
                        <TableRow className="h-8 border-b dark:border-slate-800">
                          <TableHead className="text-xs font-bold">Produto</TableHead>
                          <TableHead className="text-right text-xs font-bold w-16">Qtd</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outboundList.map((item, idx) => (
                          <TableRow key={`${item.sku}-${idx}`} className="h-10 border-b dark:border-slate-800">
                            <TableCell className="py-1">
                              <div className="font-medium text-xs truncate max-w-[200px] dark:text-slate-200">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400 py-1 text-sm">{item.quantity}</TableCell>
                            <TableCell className="py-1">
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.sku, 'outbound')} className="h-6 w-6 text-muted-foreground hover:text-red-500">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* --- COLUNA 2: RETORNO (Volta) --- */}
        <Card className="border-t-4 border-t-orange-500 shadow-md dark:bg-slate-900 dark:border-slate-800">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-3 dark:border-slate-800">
            <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2 dark:text-slate-200">
                    <ArrowRightLeft className="h-5 w-5 text-orange-600 dark:text-orange-400" /> 
                    Lista de Retorno (Volta)
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300">{inboundList.length} itens</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="upload" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">Upload Excel</TabsTrigger>
                <TabsTrigger value="manual" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950">Manual</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload">
                <div className="bg-muted/30 hover:bg-muted/50 transition-colors p-6 rounded-lg border-2 border-dashed border-orange-200 dark:border-orange-800/50 text-center">
                  <Label htmlFor="inbound-file" className="cursor-pointer block h-full">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="h-10 w-10 text-orange-400 dark:text-orange-600" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Clique para carregar planilha</span>
                      <span className="text-xs text-muted-foreground">Colunas: SKU, Nome, Qtd</span>
                    </div>
                  </Label>
                  <Input id="inbound-file" type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, 'inbound')} />
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3">
                <div className="flex gap-2 items-end">
                  <div className="grid gap-1 w-20">
                    <Label className="text-xs">SKU</Label>
                    <Input className="h-8 dark:bg-slate-800" placeholder="Cód." value={manualInbound.sku} onChange={(e) => handleSkuChange(e, 'inbound')} />
                  </div>
                  <div className="grid gap-1 flex-1">
                    <Label className="text-xs">Produto</Label>
                    <Input className="h-8 dark:bg-slate-800" placeholder="Nome" value={manualInbound.name} onChange={e => setManualInbound({...manualInbound, name: e.target.value})} />
                  </div>
                  <div className="grid gap-1 w-16">
                    <Label className="text-xs">Qtd.</Label>
                    {/* INPUT COM PROTEÇÃO CONTRA NEGATIVOS */}
                    <Input 
                      className="h-8 dark:bg-slate-800" 
                      type="number" 
                      min="0"
                      placeholder="0" 
                      value={manualInbound.quantity} 
                      onKeyDown={(e) => ["-", "e", "+"].includes(e.key) && e.preventDefault()}
                      onChange={e => setManualInbound({...manualInbound, quantity: e.target.value})} 
                    />
                  </div>
                  <Button size="sm" onClick={() => addManualItem('inbound')} className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-600"><Plus className="h-4 w-4" /></Button>
                </div>
              </TabsContent>

              {inboundList.length > 0 && (
                <div className="rounded-md border dark:border-slate-800 h-64 overflow-hidden mt-4 bg-white dark:bg-slate-950">
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10 dark:bg-slate-900">
                        <TableRow className="h-8 border-b dark:border-slate-800">
                          <TableHead className="text-xs font-bold">Produto</TableHead>
                          <TableHead className="text-right text-xs font-bold w-16">Qtd</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboundList.map((item, idx) => (
                          <TableRow key={`${item.sku}-${idx}`} className="h-10 border-b dark:border-slate-800">
                            <TableCell className="py-1">
                              <div className="font-medium text-xs truncate max-w-[200px] dark:text-slate-200">{item.name}</div>
                              <div className="text-[10px] text-muted-foreground">{item.sku}</div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-orange-600 dark:text-orange-400 py-1 text-sm">{item.quantity}</TableCell>
                            <TableCell className="py-1">
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.sku, 'inbound')} className="h-6 w-6 text-muted-foreground hover:text-red-500">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* BOTÃO DE AÇÃO PRINCIPAL */}
      <div className="flex justify-center py-4">
        <Button 
            size="lg" 
            onClick={handleCompare} 
            disabled={outboundList.length === 0}
            className="w-full md:w-1/2 h-14 text-lg font-bold bg-slate-900 hover:bg-slate-800 shadow-xl border-2 border-slate-700 dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-500 dark:text-white"
        >
          <Scale className="mr-3 h-6 w-6" /> REALIZAR CONFRONTO
        </Button>
      </div>

      {/* --- RESULTADO DO CONFRONTO --- */}
      {comparisonResult.length > 0 && (
        <Card className="animate-in slide-in-from-bottom-10 fade-in duration-500 border-t-4 border-t-green-600 shadow-2xl dark:bg-slate-950 dark:border-slate-800">
          <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800 flex flex-row justify-between items-center">
            <div>
                <CardTitle className="dark:text-slate-100">Resultado da Auditoria</CardTitle>
                <CardDescription className="dark:text-slate-400">Itens que não fecharam a conta estão destacados.</CardDescription>
            </div>
            {/* Botão de salvar histórico removido conforme solicitação */}
          </CardHeader>
          <CardContent className="p-0">
            {/* CARDS DE RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b dark:border-slate-800 divide-y md:divide-y-0 md:divide-x dark:divide-slate-800">
               <div className="p-6 flex flex-col items-center justify-center bg-green-50/50 dark:bg-green-900/10">
                 <div className="flex items-center gap-2 mb-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" /> <span className="font-bold">Corretos</span>
                 </div>
                 <span className="text-3xl font-bold text-green-800 dark:text-green-300">{comparisonResult.filter(r => r.status === 'ok').length}</span>
               </div>
               <div className="p-6 flex flex-col items-center justify-center bg-red-50/50 dark:bg-red-900/10">
                 <div className="flex items-center gap-2 mb-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" /> <span className="font-bold">Faltantes</span>
                 </div>
                 <span className="text-3xl font-bold text-red-800 dark:text-red-300">{comparisonResult.filter(r => r.status === 'missing').length}</span>
               </div>
               <div className="p-6 flex flex-col items-center justify-center bg-blue-50/50 dark:bg-blue-900/10">
                 <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400">
                    <Plus className="h-5 w-5" /> <span className="font-bold">Sobrantes</span>
                 </div>
                 <span className="text-3xl font-bold text-blue-800 dark:text-blue-300">{comparisonResult.filter(r => r.status === 'extra').length}</span>
               </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="dark:border-slate-800">
                  <TableHead className="w-[100px] dark:text-slate-300">SKU</TableHead>
                  <TableHead className="dark:text-slate-300">Produto</TableHead>
                  <TableHead className="text-center bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">Saída</TableHead>
                  <TableHead className="text-center bg-orange-50/50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">Retorno</TableHead>
                  <TableHead className="text-center border-l dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 dark:text-slate-300">Diferença</TableHead>
                  <TableHead className="text-center dark:text-slate-300">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonResult.map((res) => (
                  <TableRow key={res.sku} className={`${res.status === 'missing' ? 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40' : 'hover:bg-muted/50'} border-b dark:border-slate-800`}>
                    <TableCell className="font-mono text-xs dark:text-slate-400">{res.sku}</TableCell>
                    <TableCell>
                      <div className="font-medium dark:text-slate-200">{res.name}</div>
                      <div className="text-[10px] text-muted-foreground">{res.unit}</div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground bg-blue-50/30 dark:bg-blue-900/10 dark:text-blue-200">{res.quantity}</TableCell>
                    <TableCell className="text-center font-bold bg-orange-50/30 dark:bg-orange-900/10 dark:text-orange-200">{res.returnedQuantity}</TableCell>
                    <TableCell className="text-center border-l dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20">
                      <span className={`text-lg font-bold ${res.difference < 0 ? "text-red-600 dark:text-red-400" : res.difference > 0 ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"}`}>
                        {res.difference > 0 ? `+${res.difference}` : res.difference}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {res.status === 'ok' && <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">OK</Badge>}
                      {res.status === 'missing' && <Badge variant="destructive">FALTA</Badge>}
                      {res.status === 'extra' && <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">EXTRA</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
