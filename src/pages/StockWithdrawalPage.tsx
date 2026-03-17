import { StockWithdrawalPanel } from "@/components/withdrawal/StockWithdrawalPanel";

export default function StockWithdrawalPage() {
  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Painel de Retirada</h1>
        <p className="text-muted-foreground">Registro rápido de saída de materiais para setores.</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <StockWithdrawalPanel />
      </div>
    </div>
  );
}