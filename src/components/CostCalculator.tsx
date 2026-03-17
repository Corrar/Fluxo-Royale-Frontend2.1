import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calculator } from "lucide-react";

interface CostCalculatorProps {
  currentPrice: number;
  onSave: (newPrice: number) => void;
}

export function CostCalculator({ currentPrice, onSave }: CostCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  const [ipi, setIpi] = useState("");
  const [freight, setFreight] = useState("");
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    // Cálculo automático
    const vBase = parseFloat(basePrice) || 0;
    const vIpi = parseFloat(ipi) || 0;
    const vFreight = parseFloat(freight) || 0;
    setTotal(vBase + vIpi + vFreight);
  }, [basePrice, ipi, freight]);

  const handleSave = () => {
    onSave(total);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calculator className="h-4 w-4" /> Calc. Custo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Composição de Custo Unitário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label>Valor Unitário Base (Nota Fiscal)</Label>
            <Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>IPI Unitário</Label>
              <Input type="number" value={ipi} onChange={e => setIpi(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label>Frete Unitário</Label>
              <Input type="number" value={freight} onChange={e => setFreight(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          
          <div className="bg-muted p-4 rounded-lg flex justify-between items-center">
            <span className="font-semibold">Custo Final:</span>
            <span className="text-xl font-bold text-emerald-600">
              R$ {total.toFixed(2)}
            </span>
          </div>

          <Button onClick={handleSave} className="w-full">Aplicar Preço ao Produto</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}