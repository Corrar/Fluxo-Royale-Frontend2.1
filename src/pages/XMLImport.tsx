import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function XMLImport() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: xmlLogs, isLoading } = useQuery({
    queryKey: ["xml-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xml_logs")
        .select("*")
        .order("processed_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("xml-import", {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["xml-logs"] });
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`XML importado com sucesso! ${data.processed_items}/${data.total_items} itens processados`);
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao importar XML");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".xml")) {
        toast.error("Por favor, selecione um arquivo XML");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = () => {
    if (selectedFile) {
      importMutation.mutate(selectedFile);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Importar XML de NF-e</h1>
        <p className="text-muted-foreground">
          Faça upload de arquivos XML de notas fiscais para atualizar o estoque automaticamente
        </p>
      </div>

      <div className="border rounded-lg p-6 bg-card">
        <div className="space-y-4">
          <div>
            <Label htmlFor="xml-file">Arquivo XML da NF-e</Label>
            <Input
              id="xml-file"
              type="file"
              accept=".xml"
              onChange={handleFileChange}
              className="mt-2"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{selectedFile.name}</span>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!selectedFile || importMutation.isPending}
            className="w-full sm:w-auto"
          >
            <Upload className="h-4 w-4 mr-2" />
            {importMutation.isPending ? "Importando..." : "Importar XML"}
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Histórico de Importações</h2>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Total de Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : xmlLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma importação realizada ainda
                  </TableCell>
                </TableRow>
              ) : (
                xmlLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {log.file_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.processed_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{log.total_items}</TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge variant="outline" className="bg-accent/10 text-accent border-accent">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Erro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}