import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export default function SystemSettings() {
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await api.get("/admin/settings");
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      await api.put("/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Configuração salva!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Settings className="h-8 w-8 text-gray-700" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground">Ajuste parâmetros globais.</p>
      </div>

      <div className="grid gap-4">
        {settings?.map((setting: any) => (
          <Card key={setting.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{setting.key === 'min_stock_days' ? 'Dias de Estoque Mínimo' : setting.key}</CardTitle>
              <CardDescription>{setting.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-center">
                <Input 
                  defaultValue={setting.value} 
                  id={`input-${setting.key}`}
                  className="max-w-md"
                />
                <Button 
                  onClick={() => {
                    const input = document.getElementById(`input-${setting.key}`) as HTMLInputElement;
                    updateMutation.mutate({ key: setting.key, value: input.value });
                  }}
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}