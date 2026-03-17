import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Plane, CheckSquare, Clock, Edit2, MessageSquare, AlignLeft, X, ChevronDown, Search, Filter, Users, AlertCircle, CalendarDays, Tag, Cloud, CloudOff, CloudUpload, MoreHorizontal, CheckCircle2, UserPlus, Archive, ExternalLink } from 'lucide-react';
import { useTravels } from '@/hooks/useTravels';
import { TravelModal } from '@/components/cards/TravelModal';
import { CardData, Priority, ChecklistGroup, Tag as TagType } from '@/types/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { getOfflineActions } from '@/utils/offlineSync';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LABEL_COLORS: Record<string, { bg: string, text: string }> = {
  blue: { bg: "#3b82f6", text: "#ffffff" },
  green: { bg: "#00A868", text: "#ffffff" },
  orange: { bg: "#f97316", text: "#ffffff" },
  pink: { bg: "#ec4899", text: "#ffffff" },
  purple: { bg: "#820AD1", text: "#ffffff" },
  teal: { bg: "#14b8a6", text: "#ffffff" },
};

const DEFAULT_LISTS = [
  { id: 'list-todo', title: 'Planeamento' },
  { id: 'list-doing', title: 'Em Viagem' },
  { id: 'list-done', title: 'Concluídas' }
];

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: '#22c55e' },
  { value: 'medium', label: 'Média', color: '#eab308' },
  { value: 'high', label: 'Alta', color: '#f97316' },
  { value: 'urgent', label: 'Urgente', color: '#ef4444' }
];

// ============================================================================
// COMPONENTE SKELETON CARD (FANTASMA DE CARREGAMENTO)
// ============================================================================
const SkeletonCard = () => (
  <div className="bg-background rounded-[1.5rem] mb-4 overflow-hidden border border-border/40 shadow-[0_4px_12px_rgba(0,0,0,0.02)] animate-pulse">
    <div className="w-full h-10 bg-muted/40" />
    <div className="p-5 pt-4">
      <div className="flex gap-2 mb-4">
        <div className="w-12 h-4 bg-muted/60 rounded-full" />
        <div className="w-16 h-4 bg-muted/40 rounded-full" />
      </div>
      <div className="w-3/4 h-4 bg-muted/60 rounded-full mb-3" />
      <div className="w-1/2 h-4 bg-muted/40 rounded-full mb-5" />
      <div className="flex gap-3 pt-3 border-t border-border/30">
        <div className="w-14 h-5 bg-muted/40 rounded-full" />
        <div className="w-10 h-5 bg-muted/40 rounded-full" />
      </div>
    </div>
  </div>
);

// ============================================================================
// COMPONENTE: CARTÃO TRELLO COM QUICK ACTIONS E AVATARES SOBREPOSTOS
// ============================================================================
const TrelloCardItem = React.memo(({ card, index, onEdit, isLeader, profileId, isPending, onMoveToDone, onAssignToMe, onArchive, allUsers }: any) => {
  let checklistTotal = 0;
  let checklistCompleted = 0;
  
  card.checklists?.forEach((g: any) => {
    g.items?.forEach((i: any) => {
      checklistTotal++;
      if (i.completed) checklistCompleted++;
    });
  });

  const commentCount = card.comments?.filter((c: any) => !c.isLog)?.length || 0;
  const unreadCount = card.comments?.filter((c: any) => !c.isLog && !(c.readBy || []).includes(profileId))?.length || 0;

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date() && !card.completed && (card.status || card.listId) !== 'list-done';
  const isDueSoon = card.dueDate && new Date(card.dueDate) <= new Date(Date.now() + 2 * 86400000) && !card.completed;
  const coverIsUrl = card.imageUrl && (card.imageUrl.startsWith("http") || card.imageUrl.startsWith("/"));
  
  const isAssignedToMe = card.technicians?.some((t: any) => String(t.user_id) === String(profileId));

  // ✨ CORREÇÃO CRÍTICA: Busca robusta para garantir que a bolinha verde acende
  const assignedTechs = card.technicians || [];
  const displayUsers = assignedTechs.map((t: any) => {
    // Garante que o ID existe, caso o backend mande t.id em vez de t.user_id
    const targetUserId = t.user_id || t.id; 
    
    // Força a conversão para String para evitar falhas entre "Int" e "String"
    const fullUser = allUsers?.find((u: any) => String(u.id) === String(targetUserId));
    
    // Varredura completa para o estado do técnico (abrangendo várias nomenclaturas possíveis da API)
    const isWorkingStatus = 
      fullUser?.is_working === true || 
      fullUser?.is_working === "true" ||
      fullUser?.isWorking === true ||
      fullUser?.status === 'online' || 
      fullUser?.status === 'em_campo' ||
      fullUser?.status === 'em_viagem' ||
      fullUser?.status === 'working' ||
      fullUser?.profile?.is_working === true ||
      t?.is_working === true ||
      t?.user?.is_working === true;

    return {
      id: targetUserId,
      name: fullUser?.name || t?.user?.name || 'Técnico',
      avatar: fullUser?.avatar_url || fullUser?.avatar || t?.user?.avatar_url,
      isWorking: isWorkingStatus 
    };
  });
  
  const uniqueUsers = Array.from(new Map(displayUsers.map((u: any) => [u.id, u])).values());

  return (
    <Draggable draggableId={card.id} index={index} isDragDisabled={!isLeader}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onEdit(card)}
          className={`group relative mb-4 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] active:scale-[0.98] ${
            snapshot.isDragging
              ? "shadow-[0_20px_40px_rgba(0,0,0,0.15)] rotate-2 z-50 scale-105"
              : "hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1"
          }`}
          style={{ ...provided.draggableProps.style }}
        >
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20" onClick={(e) => e.stopPropagation()}>
            {isLeader && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                className="p-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border/50 text-muted-foreground hover:text-primary hover:bg-background shadow-sm transition-all hidden md:flex"
                title="Editar Viagem"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-full bg-background/90 backdrop-blur-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-background shadow-sm transition-all focus:outline-none">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-[1.25rem] p-1.5 shadow-xl z-[100] border-border/50 bg-background/95 backdrop-blur-xl">
                
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="gap-2.5 cursor-pointer font-bold py-2.5 px-3 text-[13px] rounded-lg">
                  <ExternalLink className="w-4 h-4 text-muted-foreground" /> Ver Detalhes
                </DropdownMenuItem>

                {!isAssignedToMe && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAssignToMe(card.id); }} className="gap-2.5 cursor-pointer font-bold py-2.5 px-3 text-[13px] rounded-lg">
                    <UserPlus className="w-4 h-4 text-primary" /> Atribuir a Mim
                  </DropdownMenuItem>
                )}

                {card.listId !== 'list-done' && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToDone(card.id); }} className="gap-2.5 cursor-pointer font-bold py-2.5 px-3 text-[13px] rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-[#00A868]" /> Mover para Concluído
                  </DropdownMenuItem>
                )}

                {isLeader && (
                  <>
                    <DropdownMenuSeparator className="bg-border/40 my-1" />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(card.id); }} className="gap-2.5 cursor-pointer font-bold py-2.5 px-3 text-[13px] rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Archive className="w-4 h-4" /> Arquivar Viagem
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className={`bg-background rounded-[1.5rem] overflow-hidden border border-border/40 w-full h-full transition-colors ${snapshot.isDragging ? 'ring-2 ring-primary/30' : 'group-hover:border-primary/20'}`}>
            {card.imageUrl && (
              coverIsUrl ? (
                <div className="w-full h-32 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${card.imageUrl})` }} />
              ) : (
                <div className="w-full h-10" style={{ backgroundColor: card.imageUrl }} />
              )
            )}

            <div className="p-5 pt-4">
              {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {card.tags.map((tag: any) => {
                     const colorInfo = LABEL_COLORS[tag.color] || { bg: tag.color, text: '#fff' };
                     return (
                       <span key={tag.id} className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm truncate max-w-full" style={{ backgroundColor: colorInfo.bg, color: colorInfo.text }} title={tag.name}>
                         {tag.name || tag.color}
                       </span>
                     )
                  })}
                </div>
              )}

              <div className="relative mb-4">
                <p className="text-[16px] font-extrabold text-foreground leading-snug pr-8 tracking-tight">{card.title}</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border/30">
                {isPending && (
                  <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 transition-colors" title="Esta viagem contém alterações a aguardar envio">
                    <CloudUpload className="w-3.5 h-3.5 animate-pulse" />
                    Pendente
                  </span>
                )}

                {card.dueDate && (
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${isOverdue ? "bg-destructive/10 text-destructive" : isDueSoon ? "bg-yellow-500/10 text-yellow-600" : "bg-muted text-muted-foreground"}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(card.dueDate).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                  </span>
                )}
                
                {checklistTotal > 0 && (
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${checklistCompleted === checklistTotal ? "bg-[#00A868]/10 text-[#00A868]" : "bg-muted text-muted-foreground"}`}>
                    <CheckSquare className="w-3.5 h-3.5" />
                    {checklistCompleted}/{checklistTotal}
                  </span>
                )}

                {card.description && (
                  <span className="text-muted-foreground/60" title="Possui descrição">
                    <AlignLeft className="w-4 h-4" />
                  </span>
                )}

                {commentCount > 0 && (
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full relative transition-colors ${unreadCount > 0 ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"}`} title={`${commentCount} mensagens`}>
                    <MessageSquare className="w-3.5 h-3.5" />
                    {commentCount}
                  </span>
                )}
                
                {uniqueUsers.length > 0 && (
                  <div className="flex -space-x-2 ml-auto">
                    {uniqueUsers.slice(0, 3).map((u: any, i: number) => {
                      const initials = u.name ? u.name.substring(0, 2).toUpperCase() : 'TE';
                      return (
                        <div key={u.id || i} title={`${u.name} ${u.isWorking ? '(Em Campo)' : ''}`} className="relative group/avatar hover:z-10 transition-transform hover:scale-110">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-black text-primary-foreground ring-2 ring-background shadow-sm overflow-hidden">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          
                          {/* A bolinha indicadora do ponto batido */}
                          {u.isWorking && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#00A868] border-2 border-background rounded-full shadow-[0_0_4px_rgba(0,168,104,0.5)]"></span>
                          )}
                        </div>
                      )
                    })}
                    
                    {uniqueUsers.length > 3 && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground ring-2 ring-background shadow-sm z-0" title={`+${uniqueUsers.length - 3} técnicos`}>
                        +{uniqueUsers.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});

// ============================================================================
// COMPONENTE: COLUNA
// ============================================================================
const TrelloListColumn = React.memo(({ list, isLeader, isAddingCardId, setIsAddingCardId, onAddCard, onEditCard, profileId, pendingOfflineIds, onMoveToDone, onAssignToMe, onArchive, isLoading, allUsers }: any) => {
  const [newCardTitle, setNewCardTitle] = useState("");

  const handleAdd = () => {
    if (newCardTitle.trim()) {
      onAddCard(newCardTitle.trim(), list.id);
      setNewCardTitle("");
      setIsAddingCardId(null);
    }
  };

  return (
    <div className="w-full md:w-[340px] shrink-0 bg-muted/10 md:bg-muted/20 border border-border/40 rounded-[2rem] flex flex-col h-full shadow-sm transition-all duration-500 overflow-hidden">
      
      <div className="flex items-center justify-between px-6 py-5 gap-2 select-none border-b border-border/20 bg-background/40 shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <span className="bg-foreground text-background w-auto min-w-[1.75rem] px-1.5 h-7 rounded-full flex items-center justify-center text-[11px] font-black shadow-md">
            {isLoading ? <span className="animate-pulse">...</span> : (list.totalCards ?? (list.cards?.length || 0))}
          </span>
          <h3 className="text-lg font-black text-foreground tracking-tight">{list.title}</h3>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
        <Droppable droppableId={list.id} type="CARD" isDropDisabled={!isLeader || isLoading}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 overflow-y-auto px-4 pt-4 pb-2 custom-scrollbar min-h-[80px] transition-colors rounded-b-[2rem] ${snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}
            >
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : (
                list.cards.map((card: any, index: number) => {
                  const isPending = pendingOfflineIds.has(card.id);
                  return (
                    <TrelloCardItem 
                      key={card.id} card={card} index={index} onEdit={onEditCard} 
                      isLeader={isLeader} profileId={profileId} isPending={isPending}
                      onMoveToDone={onMoveToDone} onAssignToMe={onAssignToMe} onArchive={onArchive}
                      allUsers={allUsers}
                    />
                  );
                })
              )}
              {provided.placeholder}

              {list.hasMore && !isLoading && (
                <div className="pt-2 pb-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => list.onLoadMore()} 
                    className="w-full rounded-full text-xs font-bold border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95"
                  >
                    Carregar mais antigas ({list.totalCards - list.cards.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </Droppable>

        <div className="px-4 pb-4 pt-2 shrink-0 bg-background/20 backdrop-blur-md border-t border-border/10">
          {isAddingCardId === list.id ? (
            <div className="p-1 animate-in zoom-in-95 duration-200">
              <textarea
                autoFocus
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdd(); }
                  if (e.key === "Escape") { setIsAddingCardId(null); setNewCardTitle(""); }
                }}
                placeholder="Onde será a próxima viagem?"
                className="w-full p-4 rounded-[1.5rem] border border-transparent shadow-inner text-[15px] font-medium resize-none outline-none focus:ring-2 focus:ring-primary bg-background text-foreground min-h-[90px] transition-all"
                rows={2}
              />
              <div className="flex items-center gap-2 mt-3">
                <Button onClick={handleAdd} className="h-11 px-6 text-[13px] font-bold rounded-full shadow-md active:scale-95 transition-transform">Adicionar</Button>
                <Button variant="ghost" size="icon" onClick={() => { setIsAddingCardId(null); setNewCardTitle(""); }} className="h-11 w-11 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-transform">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
          ) : (
            isLeader && !isLoading && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsAddingCardId(list.id); }} 
                className="flex items-center gap-3 w-full px-5 py-4 rounded-full text-[15px] font-bold text-muted-foreground hover:bg-foreground hover:text-background hover:shadow-md transition-all duration-300 active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" /> Adicionar Viagem
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
});


// ============================================================================
// TELA PRINCIPAL DO BOARD
// ============================================================================
export default function TravelBoard() {
  const { profile } = useAuth();
  const { travels, createTravel, updateTravel, deleteTravel, updateTravelStatus, assignTraveler, isAdminOrLeader, isLoading } = useTravels() as any;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [isAddingCardId, setIsAddingCardId] = useState<string | null>(null);
  const [localCards, setLocalCards] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterTech, setFilterTech] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  
  const [users, setUsers] = useState<any[]>([]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOfflineIds, setPendingOfflineIds] = useState<Set<string>>(new Set());
  const [totalPendingActions, setTotalPendingActions] = useState(0);

  const [visibleDoneCount, setVisibleDoneCount] = useState(20);

  const [activeMobileTab, setActiveMobileTab] = useState(DEFAULT_LISTS[0].id);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);

  // ✨ CORREÇÃO: Função Polling de Utilizadores para ver sempre quem entrou em turno (A cada 10s)
  useEffect(() => {
    const fetchTeamStatus = () => {
      api.get('/users')
         .then((res) => {
           if (res.data) setUsers(res.data);
         })
         .catch(() => {});
    };

    fetchTeamStatus();
    const teamInterval = setInterval(fetchTeamStatus, 10000);

    return () => clearInterval(teamInterval);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkOfflineActions = async () => {
      try {
        const actions = await getOfflineActions();
        setTotalPendingActions(actions.length);
        
        const ids = new Set<string>();
        actions.forEach(action => {
          if (action.travelId && action.travelId !== 'geral') {
            ids.add(action.travelId);
          }
        });
        setPendingOfflineIds(ids);
      } catch (error) {
        console.error('Erro ao aceder ao cofre offline no Board:', error);
      }
    };

    checkOfflineActions();
    const pollInterval = setInterval(checkOfflineActions, 3000);
    const handleSyncCompleted = () => checkOfflineActions();
    window.addEventListener('offline_sync_completed', handleSyncCompleted);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline_sync_completed', handleSyncCompleted);
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    if (isAdminOrLeader) {
      setLocalCards(travels);
    } else {
      const minhasViagens = travels.filter((t: any) => 
        t.technicians && t.technicians.some((tech: any) => String(tech.user_id) === String(profile?.id))
      );
      setLocalCards(minhasViagens);
    }
  }, [travels, isAdminOrLeader, profile?.id]);

  const filteredCards = useMemo(() => {
    return localCards.filter(card => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchTitle = card.title?.toLowerCase().includes(query);
        const matchDesc = card.description?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc) return false;
      }
      if (filterPriority !== 'all' && card.priority !== filterPriority) return false;
      if (filterTech !== 'all') {
        const hasTech = card.technicians?.some((tech: any) => String(tech.user_id) === String(filterTech));
        if (!hasTech) return false;
      }
      if (filterTags.length > 0) {
        const hasTag = card.tags?.some((tag: any) => filterTags.includes(tag.color));
        if (!hasTag) return false;
      }
      if (filterDate !== 'all') {
        if (!card.dueDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(card.dueDate);
        due.setHours(0, 0, 0, 0);

        if (filterDate === 'overdue' && due >= today) return false;
        if (filterDate === 'today' && due.getTime() !== today.getTime()) return false;
        if (filterDate === 'upcoming' && due <= today) return false;
      }
      return true;
    });
  }, [localCards, searchQuery, filterPriority, filterTech, filterTags, filterDate]);

  const activeFilterCount = (filterPriority !== 'all' ? 1 : 0) + (filterTech !== 'all' ? 1 : 0) + (filterDate !== 'all' ? 1 : 0) + (filterTags.length > 0 ? 1 : 0);
  const toggleFilterTag = (color: string) => setFilterTags(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  const clearFilters = () => { setSearchQuery(""); setFilterPriority("all"); setFilterTech("all"); setFilterDate("all"); setFilterTags([]); };

  useEffect(() => {
    if (isModalOpen && editingCard) {
      const liveCardInfo = filteredCards.find(c => c.id === editingCard.id);
      if (liveCardInfo && JSON.stringify(liveCardInfo) !== JSON.stringify(editingCard)) {
        setEditingCard(liveCardInfo);
      }
    }
  }, [filteredCards, isModalOpen]);

  const boardLists = useMemo(() => {
    return DEFAULT_LISTS.map((list) => {
      let cards = filteredCards.filter((c: any) => {
         const cardStatus = c.status || c.listId || 'list-todo';
         return cardStatus === list.id;
      });

      let hasMore = false;
      const totalCards = cards.length;

      if (list.id === 'list-done') {
        if (cards.length > visibleDoneCount) {
          hasMore = true;
          cards = cards.slice(0, visibleDoneCount);
        }
      }

      return {
        ...list,
        cards,
        hasMore,
        totalCards,
        onLoadMore: () => setVisibleDoneCount(prev => prev + 20)
      };
    });
  }, [filteredCards, visibleDoneCount]);

  const onDragEnd = useCallback((result: DropResult) => {
    if (!isAdminOrLeader) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setLocalCards(prevCards => 
      prevCards.map(card => 
        card.id === draggableId ? { ...card, status: destination.droppableId, listId: destination.droppableId } : card
      )
    );

    if (source.droppableId !== destination.droppableId) {
      updateTravelStatus(draggableId, destination.droppableId);
    }
  }, [isAdminOrLeader, updateTravelStatus]);

  const handleAddCardQuick = useCallback((title: string, listId: string) => {
    createTravel(title, "", "medium", [], [], undefined, undefined, listId); 
  }, [createTravel]);

  const handleOpenEdit = useCallback((card: any) => {
    setEditingCard(card);
    setIsModalOpen(true);
  }, []);

  const handleSaveModal = (
    title: string, description: string, category: any, priority: Priority, checklists: ChecklistGroup[], tags: TagType[] = [], imageUrl?: string, dueDate?: Date
  ) => {
    if (editingCard) {
      updateTravel(editingCard.id, { title, description, priority, checklists, tags, imageUrl, dueDate });
    } else if (isAdminOrLeader) {
      createTravel(title, description, priority, checklists, tags, imageUrl, dueDate, 'list-todo');
    }
  };

  const handleArchive = (id: string) => {
    if(!isAdminOrLeader) return; 
    updateTravelStatus(id, 'list-done');
  };

  const handleAssignToMe = useCallback((cardId: string) => {
    if (profile?.id) {
      assignTraveler(cardId, profile.id);
    }
  }, [assignTraveler, profile?.id]);

  const handleMoveToDone = useCallback((cardId: string) => {
    updateTravelStatus(cardId, 'list-done');
  }, [updateTravelStatus]);

  const changeMobileTab = (newTabId: string) => {
    const newIdx = DEFAULT_LISTS.findIndex(l => l.id === newTabId);
    const oldIdx = DEFAULT_LISTS.findIndex(l => l.id === activeMobileTab);
    setSlideDir(newIdx > oldIdx ? 'right' : 'left');
    setActiveMobileTab(newTabId);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const xDistance = touchStart.x - touchEnd.x;
    const yDistance = touchStart.y - touchEnd.y;
    const minSwipeDistance = 60; 
    if (Math.abs(xDistance) > Math.abs(yDistance) && Math.abs(xDistance) > minSwipeDistance) {
      const currentIndex = DEFAULT_LISTS.findIndex(l => l.id === activeMobileTab);
      if (xDistance > 0 && currentIndex < DEFAULT_LISTS.length - 1) {
        changeMobileTab(DEFAULT_LISTS[currentIndex + 1].id);
      } else if (xDistance < 0 && currentIndex > 0) {
        changeMobileTab(DEFAULT_LISTS[currentIndex - 1].id);
      }
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] flex flex-col bg-background overflow-hidden w-full relative">
      
      <header className="px-6 md:px-8 py-5 border-b border-border/40 flex flex-col md:flex-row justify-between md:items-center gap-4 z-10 bg-background/60 backdrop-blur-2xl shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-[1.25rem] bg-primary/10 flex items-center justify-center border border-primary/10 shadow-sm shrink-0">
              <Plane className="w-6 h-6 md:w-7 md:h-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-none mb-1">Painel de Viagens</h1>
                 
                 <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/40 border border-border/50">
                    {!isOnline ? (
                      <div className="flex items-center gap-1.5 text-destructive" title="Sem internet. Trabalhe normalmente, gravamos tudo!">
                        <CloudOff className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase hidden md:block">Offline</span>
                      </div>
                    ) : totalPendingActions > 0 ? (
                      <div className="flex items-center gap-1.5 text-yellow-600" title={`${totalPendingActions} alterações pendentes para envio`}>
                        <CloudUpload className="w-4 h-4 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase hidden md:block">A Sincronizar ({totalPendingActions})</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[#00A868]" title="Sistema em tempo real">
                        <Cloud className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase hidden md:block">Sincronizado</span>
                      </div>
                    )}
                 </div>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground font-black tracking-widest uppercase mt-1">
                {isAdminOrLeader ? 'Gestão de Logística' : 'Minhas Rotas'}
              </p>
            </div>
          </div>
          {isAdminOrLeader && (
            <Button onClick={() => { setEditingCard(null); setIsModalOpen(true); }} className="hidden md:flex rounded-full shadow-lg font-bold items-center gap-2 h-12 px-6 hover:scale-105 active:scale-95 transition-all shrink-0">
              <Plus className="w-5 h-5" /> Nova Viagem
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Pesquisar viagem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 h-11 bg-muted/30 border border-border/50 rounded-full text-[13px] font-medium outline-none focus:ring-2 focus:ring-primary shadow-inner transition-all"
            />
          </div>
          <Button 
            variant={showFilters || activeFilterCount > 0 ? "default" : "outline"} 
            onClick={() => setShowFilters(!showFilters)} 
            className="rounded-full h-11 px-5 flex items-center gap-2 font-bold transition-all shrink-0"
          >
            <Filter className="w-4 h-4" /> 
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="bg-background text-foreground text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black shadow-sm sm:ml-1">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {showFilters && (
        <div className="px-6 md:px-8 py-5 bg-background border-b border-border/40 shadow-sm animate-in slide-in-from-top-2 fade-in duration-200 z-0 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[12px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
               Opções de Filtragem
            </h3>
            {(searchQuery || activeFilterCount > 0) && (
              <button onClick={clearFilters} className="text-[12px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                <X className="w-3.5 h-3.5"/> Limpar Tudo
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-foreground uppercase flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Responsável</label>
              <select value={filterTech} onChange={(e) => setFilterTech(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-input bg-muted/20 text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer">
                <option value="all">Todos os Técnicos</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-foreground uppercase flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5"/> Prioridade</label>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-input bg-muted/20 text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer">
                <option value="all">Qualquer Prioridade</option>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-foreground uppercase flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5"/> Prazo Limite</label>
              <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full h-10 px-4 rounded-xl border border-input bg-muted/20 text-[13px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer">
                <option value="all">Qualquer Data</option>
                <option value="overdue">⚠️ Atrasados</option>
                <option value="today">📅 Para Hoje</option>
                <option value="upcoming">⏳ Futuros</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-foreground uppercase flex items-center gap-1.5"><Tag className="w-3.5 h-3.5"/> Etiquetas</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(LABEL_COLORS).map(color => (
                  <button 
                    key={color} 
                    onClick={() => toggleFilterTag(color)} 
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${filterTags.includes(color) ? 'border-foreground shadow-md' : 'border-transparent opacity-50 hover:opacity-100'}`}
                    style={{ backgroundColor: LABEL_COLORS[color].bg }}
                    title={`Filtrar por ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden flex items-center px-2 pt-2 bg-background border-b border-border/40 shrink-0 z-20 shadow-sm relative">
        {DEFAULT_LISTS.map(tab => {
          const isActive = activeMobileTab === tab.id;
          const listData = boardLists.find(l => l.id === tab.id);
          return (
             <button
                key={tab.id}
                onClick={() => changeMobileTab(tab.id)}
                className={`flex-1 pb-3 pt-2 text-[12px] font-black tracking-wide transition-all flex flex-col items-center justify-center gap-1.5 border-b-[3px] ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
             >
                <span>{tab.title}</span>
                {listData && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground'}`}>
                    {listData.totalCards}
                  </span>
                )}
             </button>
          )
        })}
      </div>

      <div 
        className="flex-1 overflow-hidden p-4 md:p-8 flex bg-muted/5 relative"
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove}   
        onTouchEnd={handleTouchEnd}     
      >
        {filteredCards.length === 0 && (searchQuery || activeFilterCount > 0) && !isLoading && (
           <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center pointer-events-none z-0">
             <Filter className="w-16 h-16 text-muted-foreground/20 mb-4" />
             <h3 className="text-xl font-black text-muted-foreground">Nenhuma viagem encontrada</h3>
             <p className="text-sm font-medium text-muted-foreground mt-1 max-w-sm">Tente ajustar a sua pesquisa ou os filtros ativos para ver mais resultados.</p>
           </div>
        )}

        <div className="w-full h-full relative z-10 overflow-x-hidden md:overflow-x-auto overflow-y-hidden">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex flex-row items-stretch md:items-start gap-5 md:gap-8 h-full pb-2 md:pb-8 w-full">
              
              {boardLists.map((list: any) => {
                const isActiveTab = activeMobileTab === list.id;
                
                return (
                  <div 
                    key={list.id} 
                    className={`
                      ${isActiveTab ? 'flex' : 'hidden'} 
                      md:flex h-full w-full md:w-auto shrink-0 
                      animate-in fade-in duration-300 
                      ${slideDir === 'right' ? 'slide-in-from-right-8' : 'slide-in-from-left-8'} 
                      md:animate-none
                    `}
                  >
                    <TrelloListColumn
                      list={list} isLeader={isAdminOrLeader} profileId={profile?.id}
                      isAddingCardId={isAddingCardId} setIsAddingCardId={setIsAddingCardId}
                      onAddCard={handleAddCardQuick} onEditCard={handleOpenEdit}
                      pendingOfflineIds={pendingOfflineIds}
                      onMoveToDone={handleMoveToDone}
                      onAssignToMe={handleAssignToMe}
                      onArchive={handleArchive}
                      isLoading={isLoading}
                      allUsers={users}
                    />
                  </div>
                )
              })}

            </div>
          </DragDropContext>
        </div>
      </div>

      {isAdminOrLeader && (
        <button 
          onClick={() => { setEditingCard(null); setIsModalOpen(true); }}
          className="md:hidden absolute bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-[0_10px_25px_rgba(var(--primary),0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-20"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <TravelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveModal}
        onDelete={deleteTravel}
        onArchive={handleArchive}
        editingCard={editingCard}
        readOnly={!isAdminOrLeader}
        isTecnico={!isAdminOrLeader}
        profileId={profile?.id}
      />
    </div>
  );
}
