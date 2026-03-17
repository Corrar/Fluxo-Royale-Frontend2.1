import { CardData, CategoryColor, Priority } from '@/types/card';
import { Pencil, Trash2, CheckCircle2, Circle, Flag, AlertTriangle, AlertCircle, Minus, Check, RotateCcw, User, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InfoCardProps {
  card: CardData;
  onEdit?: (card: CardData) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onClickCard?: (card: CardData) => void;
  onToggleChecklistItem?: (cardId: string, itemId: string, groupId?: string) => void; 
  onToggleCompleted?: (cardId: string) => void;
  index: number;
  readOnly?: boolean;
  isChefe?: boolean; 
  currentUserId?: string; 
}

const categoryColorClasses: Record<CategoryColor, string> = {
  blue: 'bg-category-blue', green: 'bg-category-green', orange: 'bg-category-orange',
  pink: 'bg-category-pink', purple: 'bg-category-purple', teal: 'bg-category-teal',
};

const categoryBgClasses: Record<CategoryColor, string> = {
  blue: 'bg-category-blue/10', green: 'bg-category-green/10', orange: 'bg-category-orange/10',
  pink: 'bg-category-pink/10', purple: 'bg-category-purple/10', teal: 'bg-category-teal/10',
};

const priorityConfig: Record<Priority, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof Flag }> = {
  low: { label: 'Baixa', color: 'text-priority-low', bgColor: 'bg-priority-low/10', borderColor: 'border-priority-low/30', icon: Minus },
  medium: { label: 'Média', color: 'text-priority-medium', bgColor: 'bg-priority-medium/10', borderColor: 'border-priority-medium/30', icon: Flag },
  high: { label: 'Alta', color: 'text-priority-high', bgColor: 'bg-priority-high/10', borderColor: 'border-priority-high/30', icon: AlertTriangle },
  urgent: { label: 'Urgente', color: 'text-priority-urgent', bgColor: 'bg-priority-urgent/10', borderColor: 'border-priority-urgent/30', icon: AlertCircle },
};

export const InfoCard = ({ card, onEdit, onDelete, onDuplicate, onToggleChecklistItem, onToggleCompleted, onClickCard, index, readOnly, isChefe, currentUserId }: InfoCardProps) => {
  const priority = priorityConfig[card.priority];
  const PriorityIcon = priority.icon;
  
  // Cálculo de Progresso Geral da Tarefa
  let completedCount = 0;
  let totalCount = 0;

  if (card.checklists && card.checklists.length > 0) {
    card.checklists.forEach(group => {
      group.items.forEach(item => {
        totalCount++;
        if (item.completed) completedCount++;
      });
    });
  } else if (card.checklist) {
    totalCount = card.checklist.length;
    completedCount = card.checklist.filter(i => i.completed).length;
  }

  const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Renderiza a caixinha de checklist interativa
  const renderChecklistItem = (item: any, groupId?: string, disabled: boolean = false) => (
    <li key={item.id}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled && onToggleChecklistItem) onToggleChecklistItem(card.id, item.id, groupId);
        }}
        disabled={disabled}
        className={cn(
          'w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-all duration-200',
          !disabled && 'hover:bg-secondary/60 cursor-pointer',
          disabled && 'cursor-default opacity-60',
          item.completed && 'opacity-60'
        )}
      >
        {item.completed ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
        <span className={cn('text-sm leading-tight', item.completed && 'line-through text-muted-foreground')}>{item.text}</span>
      </button>
    </li>
  );

  return (
    <article
      onClick={() => onClickCard && onClickCard(card)}
      className={cn(
        'group relative rounded-2xl p-5 card-shadow transition-all duration-300',
        !readOnly && 'hover:card-shadow-hover hover:-translate-y-1 cursor-pointer',
        'animate-slide-up overflow-hidden border-2 bg-card',
        priority.borderColor,
        priority.bgColor,
        card.completed && 'opacity-75'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={cn('category-indicator', categoryColorClasses[card.category])} />

      <div className="pl-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold', priority.bgColor, priority.color)}>
                <PriorityIcon className="w-3 h-3" />
                {priority.label}
              </span>
            </div>
            <h3 className="font-semibold text-card-foreground text-lg leading-tight line-clamp-2">{card.title}</h3>
          </div>

          {/* BOTÕES DE AÇÃO DO CHEFE */}
          {isChefe && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/50 backdrop-blur-sm p-1 rounded-lg">
              {onToggleCompleted && (
                <button onClick={(e) => { e.stopPropagation(); onToggleCompleted(card.id); }} className={cn('p-2 rounded-lg transition-colors', card.completed ? 'hover:bg-secondary bg-secondary/50' : 'hover:bg-primary/10')}>
                  {card.completed ? <RotateCcw className="w-4 h-4 text-muted-foreground" /> : <Check className="w-4 h-4 text-primary" />}
                </button>
              )}
              {onEdit && (
                <button onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <Pencil className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {onDuplicate && (
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(card.id); }} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(card.id); }} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
            </div>
          )}
        </div>

        {card.description && <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">{card.description}</p>}

        {totalCount > 0 && (
          <div className="mb-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* Progresso Geral Ocultado se for Técnico para focar na tarefa, ou exibido para o Chefe */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }} />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{completedCount}/{totalCount} Geral</span>
            </div>

            {card.checklists && card.checklists.length > 0 ? (
              isChefe ? (
                // 1. VISÃO DO CHEFE: Dashboard de Progresso dos Técnicos
                <div className="space-y-2 mt-3 border-t pt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Progresso da Equipa</h4>
                  {card.checklists.map(group => {
                    const groupTotal = group.items.length;
                    const groupCompleted = group.items.filter(i => i.completed).length;
                    const groupProgress = groupTotal > 0 ? (groupCompleted / groupTotal) * 100 : 0;
                    
                    return (
                      <div key={group.id} className="flex flex-col gap-1.5 p-2 rounded-lg bg-secondary/30 border border-border/50">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="flex items-center gap-1.5 text-card-foreground">
                            <User className="w-3.5 h-3.5 text-primary" /> 
                            {group.assignedToName}
                          </span>
                          <span className="text-muted-foreground">{groupCompleted}/{groupTotal}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/80 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-500", groupCompleted === groupTotal ? "bg-green-500" : "bg-primary")} style={{ width: `${groupProgress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // 2. VISÃO DO TÉCNICO: Apenas a lista que ele tem de fazer
                <div className="space-y-1.5 mt-3 border-t pt-3">
                  <h4 className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">As Suas Tarefas</h4>
                  {card.checklists
                    .filter(group => group.assignedToId === currentUserId)
                    .map(group => (
                      <ul key={group.id} className="space-y-1.5">
                        {group.items.map(item => renderChecklistItem(item, group.id, false))}
                      </ul>
                    ))}
                  {/* Mensagem caso o técnico abra um card que não tem tarefas para ele */}
                  {card.checklists.filter(group => group.assignedToId === currentUserId).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhuma tarefa atribuída a si neste card.</p>
                  )}
                </div>
              )
            ) : (
              // 3. MODELO ANTIGO (Retrocompatibilidade com tarefas criadas antes desta atualização)
              <ul className="space-y-1.5 mt-3 border-t pt-3">
                {card.checklist?.map((item) => renderChecklistItem(item, undefined, readOnly))}
              </ul>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize', categoryBgClasses[card.category], 'text-card-foreground')}>
            <span className={cn('w-2 h-2 rounded-full mr-1.5', categoryColorClasses[card.category])} />
            {card.category}
          </span>
        </div>
      </div>
    </article>
  );
};
