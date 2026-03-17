import { useState, useMemo } from 'react';
import { Plus, Sparkles, CheckCircle, RotateCcw } from 'lucide-react';
import { useCards } from '@/hooks/useCards';
import { InfoCard } from '@/components/cards/InfoCard';
import { CardModal } from '@/components/cards/CardModal';
// 1. CORREÇÃO: Adicionámos ChecklistGroup aqui nas importações
import { CardData, CategoryColor, Priority, ChecklistItem, ChecklistGroup } from '@/types/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

const TasksBoard = () => {
  const { profile } = useAuth(); 
  
  // --- VERIFICAÇÃO DE PERMISSÃO ---
  // Apenas 'gerente' pode editar. Todos os outros (incluindo admin, se quiser) só veem.
  // Se quiser que Admin também edite, use: profile?.role === 'gerente' || profile?.role === 'admin'
  const isManager = profile?.role === 'gerente'; 

  const { cards, addCard, updateCard, deleteCard, toggleChecklistItem, toggleCardCompleted } = useCards();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  const activeCards = useMemo(() => cards.filter(card => !card.completed), [cards]);
  const completedCards = useMemo(() => cards.filter(card => card.completed), [cards]);

  const handleOpenCreate = () => {
    if (!isManager) return;
    setEditingCard(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (card: CardData) => {
    // Abre o modal. Se não for gerente, o modal saberá (via prop readOnly) que não pode salvar.
    setEditingCard(card);
    setIsModalOpen(true);
  };

  // 2. CORREÇÃO: Atualizámos a função para receber `checklists: ChecklistGroup[]`
  const handleSave = (title: string, description: string, category: CategoryColor, priority: Priority, checklists: ChecklistGroup[]) => {
    if (!isManager) return;
    
    // Convertemos os grupos de volta para uma lista simples para manter o TasksBoard original a funcionar
    const simpleChecklist: ChecklistItem[] = checklists ? checklists.flatMap(group => group.items) : [];

    if (editingCard) {
      updateCard(editingCard.id, title, description, category, priority, simpleChecklist);
    } else {
      addCard(title, description, category, priority, simpleChecklist);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/20">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestão de Tarefas</h1>
            <p className="text-sm text-muted-foreground">
              {activeCards.length} {activeCards.length === 1 ? 'ativa' : 'ativas'} · {completedCards.length} {completedCards.length === 1 ? 'concluída' : 'concluídas'}
            </p>
          </div>
        </div>

        {/* BOTÃO SÓ APARECE PARA GERENTE */}
        {isManager && (
          <Button onClick={handleOpenCreate} size="lg" className="gap-2 shadow-md hover:shadow-lg transition-all">
            <Plus className="w-5 h-5" /> Nova Tarefa
          </Button>
        )}
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-md grid-cols-2 p-1 bg-muted/50 backdrop-blur-sm border border-border/50">
            <TabsTrigger value="active" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Ativas ({activeCards.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Concluídas ({completedCards.length})
            </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="active" className="space-y-4 focus-visible:outline-none">
            {activeCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activeCards.map((card, index) => (
                    <InfoCard
                    key={card.id}
                    card={card}
                    onEdit={handleOpenEdit}
                    onDelete={deleteCard}
                    onToggleChecklistItem={toggleChecklistItem}
                    onToggleCompleted={toggleCardCompleted}
                    index={index}
                    readOnly={!isManager}
                    />
                ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Tudo limpo por aqui!</h3>
                    <p className="text-muted-foreground">Nenhuma tarefa pendente no momento.</p>
                </div>
            )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 focus-visible:outline-none">
            {completedCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {completedCards.map((card, index) => (
                    <InfoCard
                    key={card.id}
                    card={card}
                    onEdit={handleOpenEdit}
                    onDelete={deleteCard}
                    onToggleChecklistItem={toggleChecklistItem}
                    onToggleCompleted={toggleCardCompleted}
                    index={index}
                    readOnly={!isManager}
                    />
                ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
                     <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <RotateCcw className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Histórico vazio</h3>
                    <p className="text-muted-foreground">As tarefas concluídas aparecerão aqui.</p>
                </div>
            )}
        </TabsContent>
      </Tabs>

      <CardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingCard={editingCard}
        readOnly={!isManager}
      />
    </div>
  );
};

export default TasksBoard;
