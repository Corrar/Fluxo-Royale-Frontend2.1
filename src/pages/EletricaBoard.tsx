import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Zap, CheckSquare, Clock, Edit2, MoreHorizontal, MessageSquare, AlignLeft, X } from 'lucide-react';
import { useEletricaCards } from '@/hooks/useEletricaCards';
import { CardModal } from '@/components/cards/CardModal';
import { CardData, Priority, ChecklistGroup, Tag } from '@/types/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LABEL_COLORS: Record<string, { bg: string, text: string }> = {
  blue: { bg: "#3b82f6", text: "#ffffff" },
  green: { bg: "#22c55e", text: "#ffffff" },
  orange: { bg: "#f97316", text: "#ffffff" },
  pink: { bg: "#ec4899", text: "#ffffff" },
  purple: { bg: "#a855f7", text: "#ffffff" },
  teal: { bg: "#14b8a6", text: "#ffffff" },
};

// ============================================================================
// COMPONENTE: CARTÃO TRELLO
// ============================================================================
const TrelloCardItem = React.memo(({ card, index, onEdit, isChefe, profileId }: any) => {
  let checklistTotal = 0;
  let checklistCompleted = 0;
  
  card.checklists?.forEach((g: any) => {
    g.items.forEach((i: any) => {
      checklistTotal++;
      if (i.completed) checklistCompleted++;
    });
  });

  const commentCount = card.comments?.filter((c: any) => !c.isLog)?.length || 0;
  
  // Calcula as mensagens que NÃO foram lidas pelo utilizador logado
  const unreadCount = card.comments?.filter((c: any) => !c.isLog && !(c.readBy || []).includes(profileId))?.length || 0;

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !card.completed;
  const isDueSoon = card.dueDate && new Date(card.dueDate) <= new Date(Date.now() + 2 * 86400000) && !card.completed;
  const coverIsUrl = card.imageUrl && (card.imageUrl.startsWith("http") || card.imageUrl.startsWith("/"));

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={!isChefe}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(card)}
          className={`group bg-card rounded-2xl shadow-sm border cursor-pointer mb-4 transition-colors duration-200 overflow-hidden ${
            snapshot.isDragging
              ? "shadow-2xl rotate-3 border-primary ring-2 ring-primary/30 z-50 scale-105"
              : "border-border hover:border-primary/60 hover:shadow-md"
          }`}
          style={{
             ...provided.draggableProps.style,
          }}
        >
          {/* Capa */}
          {card.imageUrl && (
            coverIsUrl ? (
              <div className="w-full h-36 bg-cover bg-center" style={{ backgroundImage: `url(${card.imageUrl})` }} />
            ) : (
              <div className="w-full h-10" style={{ backgroundColor: card.imageUrl }} />
            )
          )}

          {/* Etiquetas */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-4 pb-0">
              {card.tags.map((tag: any) => {
                 const colorInfo = LABEL_COLORS[tag.color] || { bg: tag.color, text: '#fff' };
                 return (
                   <span
                     key={tag.id}
                     className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide shadow-sm truncate max-w-full"
                     style={{ backgroundColor: colorInfo.bg, color: colorInfo.text }}
                     title={tag.name}
                   >
                     {tag.name || tag.color}
                   </span>
                 )
              })}
            </div>
          )}

          {/* Título */}
          <div className="px-4 py-3 relative">
            <p className="text-[15px] font-bold text-foreground leading-snug pr-8">{card.title}</p>
            {isChefe && (
               <button
                 className="absolute top-2 right-3 p-2 rounded-lg bg-muted hover:bg-accent transition-colors md:opacity-0 md:group-hover:opacity-100"
                 onClick={(e) => { e.stopPropagation(); onEdit(card); }}
               >
                 <Edit2 className="w-4 h-4 text-muted-foreground" />
               </button>
            )}
          </div>

          {/* Badges Info */}
          {(card.dueDate || card.description || checklistTotal > 0 || commentCount > 0 || (card.checklists && card.checklists.length > 0)) && (
            <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
              {/* Prazo */}
              {card.dueDate && (
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${isOverdue ? "bg-destructive/10 text-destructive" : isDueSoon ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground"}`}>
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(card.dueDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                </span>
              )}
              
              {/* Checklists */}
              {checklistTotal > 0 && (
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${checklistCompleted === checklistTotal ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>
                  <CheckSquare className="w-4 h-4" />
                  {checklistCompleted}/{checklistTotal}
                </span>
              )}

              {card.description && (
                <span className="text-muted-foreground" title="Este cartão possui descrição detalhada">
                  <AlignLeft className="w-4 h-4" />
                </span>
              )}

              {commentCount > 0 && (
                <span 
                  className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md relative shadow-sm transition-colors ${unreadCount > 0 ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-muted text-muted-foreground"}`} 
                  title={`${commentCount} mensagens (${unreadCount} não lidas)`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {commentCount}
                  
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                    </span>
                  )}
                </span>
              )}
              
              {card.checklists && card.checklists.length > 0 && (
                <div className="flex -space-x-2 ml-auto">
                  {Array.from(new Map(card.checklists.map((c: any) => [c.assignedToId, c])).values()).filter((g: any) => g.assignedToId).map((g: any) => (
                    <div key={g.id} title={g.assignedToName} className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground ring-2 ring-card shadow-sm">
                      {g.assignedToName.substring(0, 2).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
});

// ============================================================================
// COMPONENTE: COLUNA (MOBILE RESPONSIVA)
// ============================================================================
const TrelloListColumn = React.memo(({ list, isChefe, isAddingCardId, setIsAddingCardId, onAddCard, onEditCard, onDeleteList, profileId }: any) => {
  const [newCardTitle, setNewCardTitle] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const isAddingCard = isAddingCardId === list.id;
  const menuRef = useRef<HTMLDivElement>(null);

  // Deteta se é a coluna especial de tarefas perdidas
  const isOrphanList = list.id === 'list-orphans';

  const handleAdd = () => {
    if (newCardTitle.trim()) {
      onAddCard(newCardTitle.trim(), list.id);
      setNewCardTitle("");
      setIsAddingCardId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`w-[85vw] max-w-[320px] shrink-0 border rounded-2xl flex flex-col max-h-full shadow-sm snap-center md:snap-align-none ${isOrphanList ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/40 dark:bg-muted/20 border-border'}`}>
      <div className="flex items-center justify-between px-5 py-4 gap-2 group/header relative">
        <h3 className={`flex-1 text-base font-bold ${isOrphanList ? 'text-destructive' : 'text-foreground'}`}>
          {list.title}
        </h3>
        
        {isChefe && !isOrphanList && (
          <div ref={menuRef}>
            <div 
              onClick={() => setMenuOpen(!menuOpen)}
              className={`p-2 rounded-lg hover:bg-accent cursor-pointer transition-opacity ${menuOpen ? 'opacity-100 bg-accent' : 'md:opacity-0 md:group-hover/header:opacity-100 opacity-100'}`}
            >
              <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
            </div>
            {menuOpen && (
              <div className="absolute right-4 top-12 bg-popover border border-border shadow-xl rounded-xl z-20 w-48 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="px-4 py-3 border-b border-border text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider">Opções da Lista</div>
                <button onClick={() => { onDeleteList(list.id); setMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors">
                  Excluir lista inteira
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Droppable droppableId={list.id} type="CARD" isDropDisabled={!isChefe}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto px-3 pb-2 custom-scrollbar min-h-[50px] transition-colors mx-1 rounded-xl ${snapshot.isDraggingOver ? "bg-accent/50" : ""}`}
          >
            {list.cards.map((card: any, index: number) => (
              <TrelloCardItem key={card.id} card={card} index={index} onEdit={onEditCard} isChefe={isChefe} profileId={profileId} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="px-3 pb-3 pt-2">
        {!isOrphanList && (
          isAddingCard ? (
            <div className="p-1">
              <textarea
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); }
                  if (e.key === "Escape") { setIsAddingCardId(null); setNewCardTitle(""); }
                }}
                placeholder="Insira um título para a ordem..."
                className="w-full p-3 rounded-xl border border-input shadow-sm text-[15px] resize-none outline-none focus:ring-2 focus:ring-primary bg-card text-foreground min-h-[80px]"
                rows={2}
              />
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={handleAdd} className="h-10 px-5 text-sm font-bold rounded-lg shadow-sm">Adicionar</Button>
                <Button variant="ghost" size="icon" onClick={() => { setIsAddingCardId(null); setNewCardTitle(""); }} className="h-10 w-10 text-muted-foreground hover:text-foreground rounded-lg">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ) : (
            isChefe && (
              <button onClick={() => setIsAddingCardId(list.id)} className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-[15px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Plus className="w-5 h-5" /> Nova Ordem
              </button>
            )
          )
        )}
      </div>
    </div>
  );
});


// ============================================================================
// TELA PRINCIPAL
// ============================================================================
export default function EletricaBoard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const isEletrica = profile?.sector?.toLowerCase() === 'elétrica' || profile?.sector?.toLowerCase() === 'eletrica';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'gerente';
  const isChefe = isAdmin || (isEletrica && profile?.role === 'chefe');
  const isTecnico = isEletrica && profile?.role === 'assistente_tecnico';
  const isAuthorized = isEletrica || isAdmin;

  useEffect(() => {
    if (!isAuthorized) navigate('/inicio');
  }, [isAuthorized, navigate]);

  const { cards, rawLists, addCard, updateCard, deleteCard, moveCard, addList, deleteList } = useEletricaCards();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  
  const [isAddingCardId, setIsAddingCardId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  const [localCards, setLocalCards] = useState<CardData[]>([]);

  useEffect(() => {
    setLocalCards(cards);
  }, [cards]);

  // ==========================================================================
  // LÓGICA DE MAPEAMENTO (INCLUINDO RADAR DE TAREFAS PERDIDAS)
  // ==========================================================================
  const boardLists = useMemo(() => {
    // 1. Filtra as tarefas consoante o perfil do utilizador
    const filteredCards = localCards.filter((card: CardData) => {
      if (isTecnico) return card.checklists?.some(group => group.assignedToId === profile?.id);
      return true;
    });

    // 2. Mapeia as listas existentes
    const mappedLists = rawLists.map((list: any) => ({
      id: list.id,
      title: list.title,
      cards: filteredCards.filter((c: any) => (c.listId || 'list-todo') === list.id)
    }));

    // 3. RADAR: Encontra tarefas cujo listId já não existe
    const activeListIds = rawLists.map((l: any) => l.id);
    const orphanedCards = filteredCards.filter((c: any) => {
      const targetId = c.listId || 'list-todo';
      return !activeListIds.includes(targetId);
    });

    // 4. Cria a coluna de emergência se houver tarefas perdidas
    if (orphanedCards.length > 0) {
      mappedLists.push({
        id: 'list-orphans',
        title: '🚨 TAREFAS PERDIDAS (Arraste para salvar)',
        cards: orphanedCards
      });
    }

    return mappedLists;
  }, [localCards, rawLists, isTecnico, profile?.id]);


  const onDragEnd = useCallback((result: DropResult) => {
    if (!isChefe) return;
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setLocalCards(prevCards => 
      prevCards.map(card => 
        card.id === draggableId ? { ...card, listId: destination.droppableId } : card
      )
    );

    if (source.droppableId !== destination.droppableId) {
      moveCard(draggableId, destination.droppableId);
    }
  }, [isChefe, moveCard]);


  const handleAddCardQuick = useCallback((title: string, listId: string) => {
    addCard(title, "", "medium", [], [], undefined, undefined, listId); 
  }, [addCard]);

  const handleCreateList = () => {
    if(newListTitle.trim()) {
      addList(newListTitle.trim());
      setNewListTitle("");
      setIsAddingList(false);
    }
  };

  const handleOpenEdit = useCallback((card: CardData) => {
    setEditingCard(card);
    setIsModalOpen(true);
  }, []);

  const handleSaveModal = (
    title: string, description: string, category: any, priority: Priority, checklists: ChecklistGroup[], tags: Tag[] = [], imageUrl?: string, dueDate?: Date, listId?: string
  ) => {
    if (!isChefe && !isTecnico) return;
    
    if (editingCard) {
      updateCard(editingCard.id, title, description, priority, checklists, tags || [], imageUrl, dueDate, listId || (editingCard as any).listId);
    } else if (isChefe) {
      addCard(title, description, priority, checklists, tags || [], imageUrl, dueDate);
    }
  };

  const handleArchive = (id: string) => {
    if(!isChefe) return; 
    moveCard(id, 'list-done');
  };

  const handleDeleteList = useCallback((listId: string) => {
    if(confirm("ATENÇÃO: Deseja mesmo apagar esta lista? TODOS os cartões que estão dentro dela serão excluídos permanentemente!")) {
      deleteList(listId);
    }
  }, [deleteList]);

  if (!isAuthorized) return null;

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] flex flex-col bg-background animate-in fade-in duration-500 rounded-xl overflow-hidden shadow-2xl relative">
      
      <header className="px-5 py-4 border-b border-border flex justify-between items-center z-10 bg-card/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-sm">
            <Zap className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">Painel da Elétrica</h1>
            <p className="text-[10px] md:text-xs text-muted-foreground font-bold tracking-widest uppercase mt-0.5 md:mt-1">
              {isChefe ? 'Gestão de Ordem de Serviço' : 'Minhas Tarefas'}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6 custom-scrollbar flex snap-x snap-mandatory scroll-smooth touch-pan-x">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex items-start gap-4 md:gap-6 h-full pb-6">
            
            {boardLists.map((list: any) => (
              <TrelloListColumn
                key={list.id} list={list} isChefe={isChefe} isTecnico={isTecnico} profileId={profile?.id}
                isAddingCardId={isAddingCardId} setIsAddingCardId={setIsAddingCardId}
                onAddCard={handleAddCardQuick} onEditCard={handleOpenEdit} onDeleteList={handleDeleteList}
              />
            ))}

            {isChefe && (
              isAddingList ? (
                <div className="w-[85vw] max-w-[320px] bg-muted/40 border border-border rounded-2xl p-4 h-fit shadow-sm shrink-0 snap-center md:snap-align-none">
                  <input 
                    autoFocus 
                    value={newListTitle} 
                    onChange={e => setNewListTitle(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleCreateList()} 
                    placeholder="Insira o título da lista..." 
                    className="w-full px-4 py-3 rounded-xl border border-input shadow-sm text-sm font-medium outline-none focus:ring-2 focus:ring-primary bg-card text-foreground mb-4" 
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCreateList} className="h-10 px-5 text-sm font-bold rounded-lg shadow-sm">Adicionar lista</Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsAddingList(false)} className="h-10 w-10 text-muted-foreground hover:text-foreground rounded-lg">
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsAddingList(true)} className="w-[85vw] max-w-[320px] bg-muted/20 hover:bg-muted/50 border-2 border-dashed border-border text-muted-foreground rounded-2xl h-fit px-5 py-4 flex items-center justify-center text-[15px] font-bold transition-all shadow-sm shrink-0 snap-center md:snap-align-none">
                  <Plus className="w-5 h-5 mr-2" /> Adicionar Lista
                </button>
              )
            )}

          </div>
        </DragDropContext>
      </div>

      <CardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        onDelete={deleteCard}
        onArchive={handleArchive}
        editingCard={editingCard}
        readOnly={!isChefe}
        isTecnico={isTecnico}
        profileId={profile?.id}
      />
    </div>
  );
}
