import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, Package, Truck, Percent } from "lucide-react";

export default function CalculatorPage() {
  // Estados dos Inputs (Strings para facilitar a digitação)
  const [quantity, setQuantity] = useState<string>("");
  const [totalValue, setTotalValue] = useState<string>("");
  const [ipiValue, setIpiValue] = useState<string>("");
  const [freightValue, setFreightValue] = useState<string>("");

  // Estados dos Resultados
  const [unitBase, setUnitBase] = useState<number>(0);
  const [unitFinal, setUnitFinal] = useState<number>(0);
  const [totalFinal, setTotalFinal] = useState<number>(0);

  // Variáveis numéricas auxiliares para uso no JSX
  const quantityNum = parseFloat(quantity) || 0;
  const ipiNum = parseFloat(ipiValue) || 0;
  const freightNum = parseFloat(freightValue) || 0;

  // Cálculo Automático (Effect)
  useEffect(() => {
    const qtd = parseFloat(quantity) || 0;
    const total = parseFloat(totalValue) || 0;
    const ipi = parseFloat(ipiValue) || 0;
    const frete = parseFloat(freightValue) || 0;

    if (qtd > 0) {
      const base = total / qtd;
      const finalTotal = total + ipi + frete;
      const finalUnit = finalTotal / qtd;

      setUnitBase(base);
      setTotalFinal(finalTotal);
      setUnitFinal(finalUnit);
    } else {
      setUnitBase(0);
      setTotalFinal(0);
      setUnitFinal(0);
    }
  }, [quantity, totalValue, ipiValue, freightValue]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
          <Calculator className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Calculadora de Custos</h1>
          <p className="text-muted-foreground">Ferramenta para composição de custo unitário</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUNA 1: ENTRADAS */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Nota Fiscal</CardTitle>
            <CardDescription>Insira os valores totais do item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Quantidade de Itens</Label>
              <div className="relative">
                <Package className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  placeholder="0" 
                  className="pl-9"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor Total dos Produtos (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  className="pl-9"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor IPI (R$)</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-9"
                    value={ipiValue}
                    onChange={(e) => setIpiValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor Frete (R$)</Label>
                <div className="relative">
                  <Truck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="pl-9"
                    value={freightValue}
                    onChange={(e) => setFreightValue(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COLUNA 2: RESULTADOS */}
        <Card className="bg-slate-50 dark:bg-slate-900 border-l-4 border-l-emerald-500">
          <CardHeader>
            <CardTitle>Resultados Calculados</CardTitle>
            <CardDescription>Valores automáticos por unidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-950 rounded border">
              <span className="text-sm text-muted-foreground">Valor Unitário Base</span>
              <span className="font-mono font-semibold">R$ {unitBase.toFixed(2)}</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>+ Rateio IPI</span>
                {/* CORREÇÃO AQUI: Usando quantityNum em vez de quantity */}
                <span>R$ {quantityNum > 0 ? (ipiNum / quantityNum).toFixed(2) : "0.00"}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>+ Rateio Frete</span>
                {/* CORREÇÃO AQUI: Usando quantityNum em vez de quantity */}
                <span>R$ {quantityNum > 0 ? (freightNum / quantityNum).toFixed(2) : "0.00"}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-600 uppercase tracking-wide">Custo Unitário Final</p>
              <div className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">
                R$ {unitFinal.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Este é o valor que deve ser cadastrado no estoque.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-dashed">
               <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Custo Total da Nota</span>
                  <span className="text-lg font-bold">R$ {totalFinal.toFixed(2)}</span>
               </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}