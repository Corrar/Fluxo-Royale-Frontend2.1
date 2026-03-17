import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, AlertTriangle, Package, ShoppingCart, CheckCircle2, 
  Clock, Trash2, Siren, ArrowRight, ArrowLeft, Calendar, Inbox, Activity,
  Tag, ListTodo, X, CalendarDays, Hash
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- TIPAGEM ---
export interface ChecklistItem {
    id: string;
    text: string;
    quantity: number; // Nova propriedade
    done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  column: 'todo' | 'doing' | 'done';
  priority: 'normal' | 'high';
  createdAt: number;
  dueDate?: string;
  tags: string[];
  checklist: ChecklistItem[];
}

interface RemindersBoardProps {
  stats: {
    lowStock: number;
    openRequests: number;
  };
}

const PRESET_TAGS = [
    { label: "Compras", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    { label: "Estoque", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    { label: "Manutenção", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    { label: "Financeiro", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
];

// --- CARD KANBAN ---
const KanbanCard = ({ task, onClick, onDelete, onMove, actions }: { 
    task: Task, 
    onClick: (task: Task) => void,
    onDelete: (id: string) => void, 
    onMove: (id: string, target: Task['column']) => void,
    actions: 'right' | 'left' | 'both' | 'none'
}) => {
    const borderClass = task.priority === 'high' 
        ? 'border-l-red-500 dark:border-l-red-600' 
        : task.column === 'done' 
            ? 'border-l-emerald-500 dark:border-l-emerald-600'
            : 'border-l-blue-500 dark:border-l-blue-600';

    const completedChecks = task.checklist?.filter(i => i.done).length || 0;
    const totalChecks = task.checklist?.length || 0;
    const progress = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

    return (
      <div 
        onClick={() => onClick(task)}
        className={`group relative bg-card p-4 rounded-lg shadow-sm border border-border/50 border-l-[3px] ${borderClass} hover:shadow-md hover:border-primary/20 transition-all duration-300 mb-3 cursor-pointer animate-in fade-in`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-wrap gap-1">
            {task.priority === 'high' && <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase font-bold rounded-sm">Urgente</Badge>}
            {task.tags?.map(tag => (
                <Badge key={tag} variant="secondary" className="h-5 px-1.5 text-[10px] font-normal bg-muted border-border/50">{tag}</Badge>
            ))}
          </div>
          <Button 
            variant="ghost" size="icon" 
            className="h-6 w-6 -mr-2 -mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        <h4 className="text-sm font-bold text-foreground leading-snug mb-1.5 break-words">{task.title}</h4>
        
        {/* Checklist Preview Visual */}
        {totalChecks > 0 && (
            <div className="mb-3 mt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span className="flex items-center gap-1 font-medium"><ListTodo className="h-3 w-3" /> {completedChecks}/{totalChecks} itens</span>
                    <span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                </div>
            </div>
        )}
        
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-3">
                {task.dueDate && (
                    <div className={`flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${new Date(task.dueDate) < new Date() && task.column !== 'done' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-muted text-muted-foreground'}`}>
                        <CalendarDays className="h-3 w-3 mr-1.5" />
                        {format(new Date(task.dueDate), "dd/MM")}
                    </div>
                )}
                {!task.dueDate && (
                    <span className="text-[10px] text-muted-foreground flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDistanceToNow(task.createdAt, { addSuffix: true, locale: ptBR })}
                    </span>
                )}
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                {(actions === 'left' || actions === 'both') && (
                    <Button variant="secondary" size="icon" className="h-6 w-6 bg-muted/50 hover:bg-primary hover:text-primary-foreground" onClick={(e) => { e.stopPropagation(); onMove(task.id, task.column === 'done' ? 'doing' : 'todo'); }}>
                        <ArrowLeft className="h-3 w-3" />
                    </Button>
                )}
                 {(actions === 'right' || actions === 'both') && (
                    <Button variant="secondary" size="icon" className="h-6 w-6 bg-muted/50 hover:bg-primary hover:text-primary-foreground" onClick={(e) => { e.stopPropagation(); onMove(task.id, task.column === 'todo' ? 'doing' : 'done'); }}>
                        <ArrowRight className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
      </div>
    );
};

// --- ALERTA DO SISTEMA ---
const SystemAlertCard = ({ icon: Icon, title, description, actionLabel, actionLink, variant }: any) => (
    <div className={`p-4 rounded-lg shadow-sm border mb-3 transition-all relative overflow-hidden ${variant === 'destructive' ? 'bg-red-50/80 dark:bg-red-950/20 border-red-100 dark:border-red-900' : 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900'}`}>
      <div className={`absolute top-4 right-4 h-2 w-2 rounded-full animate-pulse ${variant === 'destructive' ? 'bg-red-500' : 'bg-amber-500'}`} />
      <div className="flex gap-3 mb-2">
        <div className={`p-2 rounded-full shrink-0 ${variant === 'destructive' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
            <Icon className="h-4 w-4" />
        </div>
        <div>
            <h4 className={`text-sm font-bold ${variant === 'destructive' ? 'text-red-900 dark:text-red-200' : 'text-amber-900 dark:text-amber-200'}`}>{title}</h4>
            <p className={`text-xs mt-1 leading-snug ${variant === 'destructive' ? 'text-red-700/80 dark:text-red-300/70' : 'text-amber-700/80 dark:text-amber-300/70'}`}>{description}</p>
        </div>
      </div>
      <Button size="sm" className={`w-full mt-2 h-8 text-xs font-semibold shadow-none border bg-background/50 hover:bg-background transition-colors ${variant === 'destructive' ? 'text-red-700 border-red-200' : 'text-amber-700 border-amber-200'}`} onClick={() => window.location.href=actionLink}>
        {actionLabel}
      </Button>
    </div>
);

// --- COMPONENTE PRINCIPAL ---
export function RemindersBoard({ stats }: RemindersBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Estado de Edição/Criação
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  
  // Campos do Formulário
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [dueDate, setDueDate] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItemText, setNewCheckItemText] = useState("");
  const [newCheckItemQty, setNewCheckItemQty] = useState(1);

  // Load Tasks
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kanban-tasks');
      if (saved) setTasks(JSON.parse(saved));
    } catch (e) { console.error("Erro storage:", e); }
  }, []);

  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    localStorage.setItem('kanban-tasks', JSON.stringify(newTasks));
  };

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  // --- ACTIONS ---

  const handleOpenDialog = (task?: Task) => {
    if (task) {
        // Modo Edição
        setEditingTaskId(task.id);
        setTitle(task.title);
        setDesc(task.description || "");
        setPriority(task.priority);
        setDueDate(task.dueDate || "");
        setSelectedTags(task.tags || []);
        setChecklist(task.checklist || []);
    } else {
        // Modo Criação
        setEditingTaskId(null);
        resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSaveTask = () => {
    if (!title.trim()) { toast.error("O título é obrigatório."); return; }
    
    if (editingTaskId) {
        // Atualizar Existente
        const updatedTasks = tasks.map(t => t.id === editingTaskId ? {
            ...t,
            title, description: desc, priority, dueDate: dueDate || undefined, tags: selectedTags, checklist
        } : t);
        saveTasks(updatedTasks);
        toast.success("Tarefa atualizada!");
    } else {
        // Criar Nova
        const newTask: Task = {
            id: generateId(),
            title, description: desc, column: 'todo', priority,
            dueDate: dueDate || undefined, tags: selectedTags, checklist, createdAt: Date.now()
        };
        saveTasks([...tasks, newTask]);
        toast.success("Tarefa criada!");
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle(""); setDesc(""); setPriority("normal"); setDueDate(""); setSelectedTags([]); setChecklist([]); setNewCheckItemText(""); setNewCheckItemQty(1);
  };

  const moveTask = (taskId: string, targetColumn: Task['column']) => {
    saveTasks(tasks.map(t => t.id === taskId ? { ...t, column: targetColumn } : t));
  };

  const deleteTask = (taskId: string) => {
    saveTasks(tasks.filter(t => t.id !== taskId));
    toast.success("Cartão arquivado.");
  };

  // Helper de Checklist
  const addCheckItem = () => {
    if (!newCheckItemText.trim()) return;
    setChecklist([...checklist, { id: generateId(), text: newCheckItemText, quantity: newCheckItemQty, done: false }]);
    setNewCheckItemText("");
    setNewCheckItemQty(1);
  };

  const toggleCheckItem = (itemId: string) => {
    setChecklist(checklist.map(i => i.id === itemId ? { ...i, done: !i.done } : i));
  };

  const removeCheckItem = (id: string) => {
    setChecklist(checklist.filter(i => i.id !== id));
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) setSelectedTags(selectedTags.filter(t => t !== tag));
    else setSelectedTags([...selectedTags, tag]);
  };

  // --- RENDER ---

  const renderColumnHeader = (title: string, icon: React.ReactNode, count: number, accentColor: string, onAdd?: () => void) => (
    <div className="p-4 pb-3 flex items-center justify-between border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur-md z-20 rounded-t-xl">
        <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center h-6 w-6 rounded-md bg-muted ${accentColor}`}>{icon}</div>
            <h3 className="font-bold text-sm tracking-tight text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
            <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5 min-w-[20px] justify-center bg-muted/80 text-muted-foreground">{count}</Badge>
            {onAdd && (
                <Button size="icon" variant="ghost" className="h-6 w-6 ml-1 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
            )}
        </div>
    </div>
  );

  const renderTaskColumn = (column: Task['column'], title: string, icon: React.ReactNode, accentClass: string, bgClass: string, actions: 'right' | 'left' | 'both') => {
    const colTasks = tasks.filter(t => t.column === column);
    return (
      <div className={`flex-1 min-w-[320px] max-w-[320px] flex flex-col h-full rounded-xl border border-border/60 shadow-sm snap-start ${bgClass}`}>
        {renderColumnHeader(title, icon, colTasks.length, accentClass, column === 'todo' ? () => handleOpenDialog() : undefined)}
        <div className="p-3 flex-1 overflow-y-auto content-start custom-scrollbar">
            {colTasks.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/30 border-2 border-dashed border-border/30 rounded-lg m-1"><Inbox className="h-10 w-10 mb-2" /><span className="text-xs font-medium uppercase tracking-wider">Vazio</span></div>
            ) : (
                colTasks.map(task => (
                    <KanbanCard key={task.id} task={task} onClick={() => handleOpenDialog(task)} onDelete={deleteTask} onMove={moveTask} actions={actions} />
                ))
            )}
            {column === 'done' && colTasks.length > 0 && (
                 <Button variant="ghost" size="sm" className="w-full mt-4 text-xs text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" onClick={() => saveTasks(tasks.filter(t => t.column !== 'done'))}><Trash2 className="h-3 w-3 mr-2" /> Arquivar Concluídos</Button>
            )}
        </div>
      </div>
    );
  };

  const renderSystemColumn = () => {
    const totalAlerts = stats.lowStock + stats.openRequests;
    return (
      <div className="flex-1 min-w-[320px] max-w-[320px] flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-border/60 shadow-sm snap-start">
        {renderColumnHeader("Alertas", <Siren className="h-3.5 w-3.5 text-red-500" />, totalAlerts, "text-red-500")}
        <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
            {stats.lowStock > 0 && <SystemAlertCard icon={AlertTriangle} title="Estoque Crítico" description={`${stats.lowStock} itens precisam de reposição.`} actionLabel="Ver Estoque" actionLink="/low-stock" variant="destructive" />}
            {stats.openRequests > 0 && <SystemAlertCard icon={ShoppingCart} title="Novos Pedidos" description={`${stats.openRequests} solicitações pendentes.`} actionLabel="Analisar Pedidos" actionLink="/requests" variant="warning" />}
            {totalAlerts === 0 && <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 min-h-[200px]"><div className="bg-muted/50 p-4 rounded-full mb-3"><CheckCircle2 className="h-8 w-8 text-emerald-500/50" /></div><p className="text-sm font-medium">Sistema Operacional</p></div>}
        </div>
      </div>
    );
  };

  return (
    <>
        <div className="h-full overflow-x-auto pb-2 snap-x snap-mandatory px-4 md:px-0">
            <div className="flex gap-5 h-full w-max">
                {renderSystemColumn()}
                {renderTaskColumn('todo', 'A Fazer', <Package className="h-3.5 w-3.5" />, 'text-slate-600', 'bg-slate-50/50 dark:bg-slate-900/20', 'right')}
                {renderTaskColumn('doing', 'Em Andamento', <Activity className="h-3.5 w-3.5" />, 'text-blue-600', 'bg-blue-50/30 dark:bg-blue-900/10', 'both')}
                {renderTaskColumn('done', 'Concluído', <CheckCircle2 className="h-3.5 w-3.5" />, 'text-emerald-600', 'bg-emerald-50/30 dark:bg-emerald-900/10', 'left')}
            </div>
        </div>

        {/* --- DIALOG DE EDIÇÃO/CRIAÇÃO --- */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogContent className="sm:max-w-[650px] gap-0 p-0 overflow-hidden bg-card">
                <DialogHeader className="px-6 py-4 border-b bg-muted/20">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        {editingTaskId ? <><ListTodo className="h-5 w-5 text-blue-500" /> Editar Tarefa</> : <><Plus className="h-5 w-5 text-primary" /> Nova Tarefa</>}
                    </DialogTitle>
                    <DialogDescription>Gerencie os detalhes e o checklist.</DialogDescription>
                </DialogHeader>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
                    {/* ESQUERDA: DADOS */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Título</label>
                            <Input placeholder="Resumo da tarefa..." className="font-medium" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Descrição</label>
                            <Textarea placeholder="Detalhes..." className="resize-none min-h-[100px]" value={desc} onChange={(e) => setDesc(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Prioridade</label>
                            <div className="flex gap-2">
                                <Button type="button" variant={priority === 'normal' ? 'default' : 'outline'} size="sm" onClick={() => setPriority('normal')} className="flex-1">Normal</Button>
                                <Button type="button" variant={priority === 'high' ? 'destructive' : 'outline'} size="sm" onClick={() => setPriority('high')} className="flex-1">Urgente</Button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Prazo</label>
                            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">Etiquetas</label>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_TAGS.map(tag => (
                                    <Badge key={tag.label} variant="outline" className={`cursor-pointer ${selectedTags.includes(tag.label) ? `border-transparent ${tag.color} ring-1 ring-primary` : 'opacity-50'}`} onClick={() => toggleTag(tag.label)}>{tag.label}</Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* DIREITA: CHECKLIST INTERATIVO */}
                    <div className="space-y-4 border-l pl-0 md:pl-6 border-border/50">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase flex justify-between">
                                Checklist
                                <span className="text-[10px] opacity-70 font-normal">{checklist.filter(i => i.done).length}/{checklist.length} concluídos</span>
                            </label>
                            
                            {/* Input de Novo Item */}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Input placeholder="Item..." value={newCheckItemText} onChange={(e) => setNewCheckItemText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCheckItem()} className="h-8 text-xs" />
                                </div>
                                <div className="w-20">
                                    <div className="relative">
                                        <Hash className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                                        <Input type="number" min="1" placeholder="Qtd" value={newCheckItemQty} onChange={(e) => setNewCheckItemQty(parseInt(e.target.value))} className="h-8 text-xs pl-6" />
                                    </div>
                                </div>
                                <Button size="sm" variant="secondary" onClick={addCheckItem} className="h-8 px-2"><Plus className="h-4 w-4" /></Button>
                            </div>
                            
                            {/* Lista de Itens */}
                            <ScrollArea className="h-[250px] w-full rounded-md border p-2 bg-muted/20">
                                <div className="space-y-2">
                                    {checklist.length === 0 && <div className="text-center text-xs text-muted-foreground py-10">Nenhum item no checklist</div>}
                                    {checklist.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between text-sm group bg-background p-2 rounded-md border border-transparent hover:border-border transition-all">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Checkbox checked={item.done} onCheckedChange={() => toggleCheckItem(item.id)} />
                                                <div className={`flex flex-col ${item.done ? 'line-through text-muted-foreground opacity-50' : ''}`}>
                                                    <span className="font-medium truncate">{item.text}</span>
                                                    <span className="text-[10px] text-muted-foreground">Qtd: {item.quantity}</span>
                                                </div>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10" onClick={() => removeCheckItem(item.id)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 bg-muted/20 border-t flex items-center justify-between">
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSaveTask} className="w-32 shadow-md">{editingTaskId ? "Salvar" : "Criar"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}