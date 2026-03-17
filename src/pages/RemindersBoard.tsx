import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, AlertTriangle, Package, ShoppingCart, CheckCircle2, 
  Clock, ArrowRight, Trash2, GripVertical, Siren
} from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description?: string;
  column: 'todo' | 'doing' | 'done';
  type: 'manual';
  priority: 'normal' | 'high';
  createdAt: number;
}

interface RemindersBoardProps {
  stats: {
    lowStock: number;
    openRequests: number;
    // Adicione outros stats se necessário
  };
}

export function RemindersBoard({ stats }: RemindersBoardProps) {
  // Estado para tarefas manuais
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Estados para nova tarefa
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<'normal' | 'high'>('normal');

  // Carregar tarefas salvas no LocalStorage ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem('kanban-tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao ler tarefas locais");
      }
    }
  }, []);

  // Salvar tarefas sempre que mudarem
  useEffect(() => {
    localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Criar nova tarefa
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle,
      description: newTaskDesc,
      column: 'todo',
      type: 'manual',
      priority: newTaskPriority,
      createdAt: Date.now()
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle("");
    setNewTaskDesc("");
    setIsDialogOpen(false);
    toast.success("Tarefa adicionada!");
  };

  // Mover tarefa
  const moveTask = (taskId: string, targetColumn: Task['column']) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, column: targetColumn } : t));
  };

  // Excluir tarefa
  const deleteTask = (taskId: string) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    toast("Tarefa removida.");
  };

  // --- RENDERIZAÇÃO DE CARDS ---

  const renderSystemAlerts = () => {
    const alerts = [];

    if (stats.lowStock > 0) {
      alerts.push(
        <div key="alert-stock" className="p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg shadow-sm animate-in slide-in-from-left-2">
          <div className="flex justify-between items-start">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-700 dark:text-red-300 text-sm">Estoque Crítico</h4>
                <p className="text-xs text-red-600/80 dark:text-red-300/70 mt-1">
                  {stats.lowStock} produtos abaixo do mínimo.
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="text-[10px]">Sistema</Badge>
          </div>
          <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs border-red-200 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700" onClick={() => window.location.href='/low-stock'}>
            Resolver Agora
          </Button>
        </div>
      );
    }

    if (stats.openRequests > 0) {
      alerts.push(
        <div key="alert-req" className="p-3 mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 rounded-lg shadow-sm animate-in slide-in-from-left-2">
          <div className="flex justify-between items-start">
            <div className="flex gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-700 dark:text-amber-300 text-sm">Novas Solicitações</h4>
                <p className="text-xs text-amber-600/80 dark:text-amber-300/70 mt-1">
                  {stats.openRequests} pedidos aguardando aprovação.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Sistema</Badge>
          </div>
          <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs border-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700" onClick={() => window.location.href='/requests'}>
            Ver Pedidos
          </Button>
        </div>
      );
    }

    if (alerts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <CheckCircle2 className="h-8 w-8 mb-2 text-green-500 opacity-50" />
                <p className="text-sm">Tudo em ordem!</p>
            </div>
        )
    }

    return alerts;
  };

  const renderManualTasks = (column: Task['column']) => {
    const colTasks = tasks.filter(t => t.column === column);
    
    if (colTasks.length === 0) {
        return <div className="h-24 flex items-center justify-center text-xs text-muted-foreground italic border border-dashed rounded-lg">Vazio</div>
    }

    return colTasks.map(task => (
      <div key={task.id} className="group p-3 mb-3 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all">
        <div className="flex justify-between items-start mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            task.priority === 'high' 
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
            {task.priority === 'high' ? 'Urgente' : 'Normal'}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
            onClick={() => deleteTask(task.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        <h4 className="text-sm font-semibold text-foreground mb-1">{task.title}</h4>
        {task.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
        
        <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border/50">
          {column !== 'todo' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => moveTask(task.id, 'todo')}>
              A Fazer
            </Button>
          )}
          {column !== 'doing' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => moveTask(task.id, 'doing')}>
              Fazendo
            </Button>
          )}
          {column !== 'done' && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => moveTask(task.id, 'done')}>
              Concluir
            </Button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="h-full overflow-x-auto pb-4">
      <div className="flex flex-col md:flex-row gap-6 min-w-[800px] h-full">
        
        {/* COLUNA 1: AVISOS DO SISTEMA (Automático) */}
        <div className="flex-1 min-w-[280px] flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <Siren className="h-4 w-4 text-red-500" />
              Alertas do Sistema
            </h3>
            <Badge variant="secondary">{stats.lowStock + stats.openRequests}</Badge>
          </div>
          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border overflow-y-auto">
            {renderSystemAlerts()}
          </div>
        </div>

        {/* COLUNA 2: A FAZER (Manual) */}
        <div className="flex-1 min-w-[280px] flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <Package className="h-4 w-4 text-slate-500" />
              A Fazer
            </h3>
            <div className="flex gap-2">
                <Badge variant="secondary">{tasks.filter(t => t.column === 'todo').length}</Badge>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nova Tarefa</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Título</label>
                                <Input placeholder="Ex: Ligar para fornecedor..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Detalhes</label>
                                <Textarea placeholder="Detalhes adicionais..." value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Prioridade</label>
                                <div className="flex gap-2">
                                    <Button 
                                        variant={newTaskPriority === 'normal' ? 'default' : 'outline'} 
                                        size="sm" onClick={() => setNewTaskPriority('normal')}
                                        className="flex-1"
                                    >Normal</Button>
                                    <Button 
                                        variant={newTaskPriority === 'high' ? 'destructive' : 'outline'} 
                                        size="sm" onClick={() => setNewTaskPriority('high')}
                                        className="flex-1"
                                    >Urgente</Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleAddTask}>Criar Tarefa</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
          </div>
          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border overflow-y-auto">
            {renderManualTasks('todo')}
          </div>
        </div>

        {/* COLUNA 3: EM PROGRESSO */}
        <div className="flex-1 min-w-[280px] flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-blue-500" />
              Em Andamento
            </h3>
            <Badge variant="secondary">{tasks.filter(t => t.column === 'doing').length}</Badge>
          </div>
          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border overflow-y-auto">
            {renderManualTasks('doing')}
          </div>
        </div>

        {/* COLUNA 4: CONCLUÍDO */}
        <div className="flex-1 min-w-[280px] flex flex-col h-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Concluído
            </h3>
            <Badge variant="secondary">{tasks.filter(t => t.column === 'done').length}</Badge>
          </div>
          <div className="flex-1 bg-muted/30 rounded-xl p-3 border border-border overflow-y-auto">
            {renderManualTasks('done')}
            {tasks.filter(t => t.column === 'done').length > 0 && (
                <Button variant="ghost" className="w-full mt-4 text-xs text-muted-foreground" onClick={() => setTasks(tasks.filter(t => t.column !== 'done'))}>
                    Limpar Concluídos
                </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}