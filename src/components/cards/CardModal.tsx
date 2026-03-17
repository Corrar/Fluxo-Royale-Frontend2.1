import { useState, useEffect, useRef } from 'react';
import {
  X, CreditCard, AlignLeft, Tag, CheckSquare, Clock, Paperclip,
  MessageSquare, Archive, Trash2, Check, Pencil, Image, GripVertical, AlertCircle, UserPlus, Info, ChevronDown, ChevronUp
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { CardData, CategoryColor, Priority, ChecklistGroup, Tag as TagType } from '@/types/card';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useEletricaCards } from '@/hooks/useEletricaCards';
import { Button } from '@/components/ui/button';
import { toast } from "sonner"; 

// ✨ IMPORTANTE: Importamos o nosso motor offline para gerir os comentários e leituras
import { apiWithOfflineFallback } from '@/utils/offlineSync';

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, description: string, category: CategoryColor, priority: Priority, checklists: ChecklistGroup[], tags: TagType[], imageUrl?: string, dueDate?: Date) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  editingCard?: CardData | null;
  readOnly?: boolean;
  isTecnico?: boolean;
  profileId?: string;
}

type PopoverType = "labels" | "assign" | "checklist" | "date" | "attachment" | "cover" | "priority" | null;

const COVER_COLORS = [
  "#61bd4f", "#f2d600", "#ff9f1a", "#eb5a46", "#c377e0",
  "#0079bf", "#00c2e0", "#51e898", "#ff78cb", "#344563",
  "#b3bac5", "#dfe1e6",
];

const LABEL_COLORS: Record<string, { bg: string, text: string }> = {
  blue: { bg: "#3b82f6", text: "#ffffff" },
  green: { bg: "#22c55e", text: "#ffffff" },
  orange: { bg: "#f97316", text: "#ffffff" },
  pink: { bg: "#ec4899", text: "#ffffff" },
  purple: { bg: "#a855f7", text: "#ffffff" },
  teal: { bg: "#14b8a6", text: "#ffffff" },
};

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa Prioridade', color: '#22c55e' },
  { value: 'medium', label: 'Prioridade Média', color: '#eab308' },
  { value: 'high', label: 'Alta Prioridade', color: '#f97316' },
  { value: 'urgent', label: 'Urgência Máxima', color: '#ef4444' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export function CardModal({ isOpen, onClose, onSave, onDelete, onArchive, editingCard, readOnly, isTecnico, profileId }: CardModalProps) {
  const { profile } = useAuth();
  const { updateMembers, toggleChecklistItem: toggleChecklistApi } = useEletricaCards();

  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [priority, setPriority] = useState<Priority>('medium');
  const [checklists, setChecklists] = useState<ChecklistGroup[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  const [attachments, setAttachments] = useState<{id: string, name: string, url: string, addedAt: string}[]>([]);
  const [comments, setComments] = useState<{id: string, author: string, text: string, createdAt: string, isLog?: boolean, readBy?: string[]}[]>([]);
  const [commentText, setCommentText] = useState("");
  
  const [showComments, setShowComments] = useState(false);
  
  const [activePopover, setActivePopover] = useState<PopoverType>(null);
  const [technicians, setTechnicians] = useState<any[]>([]);
  
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [assignTechId, setAssignTechId] = useState<string>('');

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [editingChecklistTitle, setEditingChecklistTitle] = useState<string | null>(null);
  const [editingChecklistTitleValue, setEditingChecklistTitleValue] = useState("");
  const [addingItemForChecklist, setAddingItemForChecklist] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState<{ groupId: string; itemId: string } | null>(null);
  const [editingItemValue, setEditingItemValue] = useState("");

  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [labelNames, setLabelNames] = useState<Record<string, string>>(() => {
    return { blue: 'Azul', green: 'Verde', orange: 'Laranja', pink: 'Rosa', purple: 'Roxo', teal: 'Turquesa' };
  });

  const descRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // --- AUTOSAVE MÁGICO ---
  const triggerAutoSave = (newValues: any = {}) => {
    if (readOnly || !editingCard || !title.trim()) return; 
    
    onSave(
      newValues.title ?? title.trim(), 
      newValues.description ?? description.trim(), 
      'blue', 
      newValues.priority ?? priority, 
      newValues.checklists ?? checklists, 
      newValues.tags ?? tags, 
      newValues.coverUrl !== undefined ? newValues.coverUrl : (coverUrl || undefined), 
      newValues.dueDate !== undefined ? (newValues.dueDate ? new Date(newValues.dueDate) : undefined) : (dueDate ? new Date(dueDate) : undefined)
    );
  };

  useEffect(() => {
    if (isOpen) {
      // ⚠️ NOTA: Este GET será guardado no Cache do Service Worker automaticamente se não houver net.
      api.get('/users').then((res) => {
        const eletricaTeam = res.data.filter((u: any) => 
          u.sector?.toLowerCase() === 'elétrica' || u.sector?.toLowerCase() === 'eletrica' || u.role?.toLowerCase().includes('eletrica') || u.role === 'admin'
        );
        setTechnicians(eletricaTeam);
        if (eletricaTeam.length > 0) setAssignTechId(eletricaTeam[0].id);
      }).catch(() => {});

      if (editingCard) {
        setTitle(editingCard.title || '');
        setDescription(editingCard.description || '');
        setPriority(editingCard.priority || 'medium');
        setChecklists(editingCard.checklists || []);
        setTags(editingCard.tags || []);
        setCoverUrl(editingCard.imageUrl || '');
        setDueDate(editingCard.dueDate ? new Date(editingCard.dueDate).toISOString().split('T')[0] : '');
        setAttachments((editingCard as any).attachments || []);
        setComments((editingCard as any).comments || []);
        setShowComments(false);

        const names = { blue: 'Azul', green: 'Verde', orange: 'Laranja', pink: 'Rosa', purple: 'Roxo', teal: 'Turquesa' };
        (editingCard.tags || []).forEach(t => { if (t.color) (names as any)[t.color] = t.name; });
        setLabelNames(names);

        const expandedState: Record<string, boolean> = {};
        (editingCard.checklists || []).forEach(g => { expandedState[g.id] = true });
        setExpandedGroups(expandedState);
      } else {
        setTitle('Nova Ordem de Serviço');
        setDescription('');
        setPriority('medium');
        setChecklists([]);
        setTags([]);
        setCoverUrl('');
        setDueDate('');
        setAttachments([]);
        setComments([]);
        setShowComments(false);
      }
    }
  }, [isOpen, editingCard]);

  useEffect(() => {
    if (isEditingDesc && descRef.current) descRef.current.focus();
  }, [isEditingDesc]);

  const handleCloseModal = () => {
     if(!editingCard && !readOnly) triggerAutoSave(); 
     onClose();
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (activePopover) setActivePopover(null); else handleCloseModal(); }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose, activePopover, editingCard, title]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (activePopover && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null);
        setEditingLabelKey(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePopover]);


  const handleDelete = () => {
    if (readOnly || !onDelete || !editingCard) return;
    if (confirm("Tem a certeza de que deseja excluir esta ordem permanentemente?")) {
      onDelete(editingCard.id);
      onClose();
    }
  };

  const handleArchive = () => {
    if (readOnly || !onArchive || !editingCard) return;
    onArchive(editingCard.id);
    onClose();
  };

  const updateChecklistTitle = (groupId: string, newTitle: string) => {
    if (readOnly) return;
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, title: newTitle } as any : c);
    setChecklists(newChecklists);
    triggerAutoSave({ checklists: newChecklists });
    setEditingChecklistTitle(null);
  };

  const saveEditingItem = (groupId: string, itemId: string) => {
    if (!editingItemValue.trim() || readOnly) { setEditingItem(null); return; }
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, text: editingItemValue.trim() } : i) } : c);
    setChecklists(newChecklists);
    triggerAutoSave({ checklists: newChecklists });
    setEditingItem(null);
  };

  const onChecklistItemDragEnd = (groupId: string, result: DropResult) => {
    if (!result.destination || readOnly) return;
    if (result.destination.index === result.source.index) return;
    
    const newChecklists = checklists.map(c => {
      if (c.id !== groupId) return c;
      const items = [...c.items];
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination!.index, 0, moved);
      return { ...c, items };
    });

    setChecklists(newChecklists);
    triggerAutoSave({ checklists: newChecklists });
  };

  const toggleLabel = (colorKey: string) => {
    if (readOnly) return;
    const customName = labelNames[colorKey] || '';
    const existing = tags.find((l) => l.color === colorKey);
    let newTags;
    if (existing) newTags = tags.filter((l) => l.color !== colorKey);
    else newTags = [...tags, { id: generateId(), color: colorKey, name: customName }];
    
    setTags(newTags);
    triggerAutoSave({ tags: newTags });
  };

  const saveLabelName = (colorKey: string) => {
    if (readOnly) return;
    const newName = labelNames[colorKey] || '';
    const newTags = tags.map((l) => l.color === colorKey ? { ...l, name: newName } : l);
    setTags(newTags);
    setEditingLabelKey(null);
    triggerAutoSave({ tags: newTags });
  };

  const handleAssignTechnician = () => {
    if (!assignTechId || readOnly || !editingCard) return;
    const tech = technicians.find(t => t.id === assignTechId);
    if (!tech) return;

    const isAlreadyAssigned = checklists.some(c => c.assignedToId === tech.id);
    if (isAlreadyAssigned) {
       alert(`${tech.name || tech.email} já está atribuído a este cartão.`);
       setActivePopover(null);
       return;
    }

    const newGroupId = generateId();
    const newChecklists = [...checklists, { id: newGroupId, title: `Tarefas de ${tech.name || tech.email}`, assignedToId: tech.id, assignedToName: tech.name || tech.email, items: [] } as any];
    setChecklists(newChecklists);
    setExpandedGroups(prev => ({ ...prev, [newGroupId]: true }));

    const newLog = {
      id: `log-${Date.now()}`,
      author: 'Sistema',
      text: `${profile?.name || 'Administrador'} delegou o serviço a ${tech.name || tech.email}.`,
      createdAt: new Date().toISOString(),
      isLog: true
    };
    
    const newComments = [...comments, newLog];
    setComments(newComments);

    updateMembers(editingCard.id, newChecklists, profile?.name || 'Usuário', 'added', tech.name || tech.email);
    triggerAutoSave({ checklists: newChecklists });
    setActivePopover(null);
  }

  const addChecklistGroup = () => {
    if (!newChecklistTitle.trim() || readOnly) return;
    
    const newGroupId = generateId();
    const newChecklists = [...checklists, { id: newGroupId, title: newChecklistTitle.trim(), assignedToId: null, assignedToName: '', items: [] } as any];
    setChecklists(newChecklists);
    setExpandedGroups(prev => ({ ...prev, [newGroupId]: true }));
    triggerAutoSave({ checklists: newChecklists });

    setNewChecklistTitle("");
    setActivePopover(null);
  };

  const deleteChecklist = (groupId: string) => {
    if (readOnly) return;
    const newChecklists = checklists.filter(c => c.id !== groupId);
    setChecklists(newChecklists);
    triggerAutoSave({ checklists: newChecklists });
  };

  const toggleChecklistExpansion = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const addChecklistItem = (groupId: string) => {
    if (!newItemText.trim() || readOnly) return;
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: [...c.items, { id: generateId(), text: newItemText.trim(), completed: false }] } : c);
    setChecklists(newChecklists);
    triggerAutoSave({ checklists: newChecklists });
    setNewItemText("");
  };

  const handleToggleChecklistItem = (groupId: string, itemId: string) => {
    const isMyList = checklists.find(c => c.id === groupId)?.assignedToId === profileId;
    
    if (readOnly && !(isTecnico && isMyList)) return;

    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i) } : c);
    setChecklists(newChecklists);

    if (readOnly && isTecnico && editingCard) {
      toggleChecklistApi(editingCard.id, itemId, groupId);
    } else {
      triggerAutoSave({ checklists: newChecklists });
    }
  };

  const deleteChecklistItem = (groupId: string, itemId: string) => {
    if (readOnly) return;
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c);
    setChecklists(newChecklists);
    triggerAutoSave({ checklists: newChecklists });
  };

  const addAttachment = () => {
    if (!newAttachmentName.trim() || readOnly) return;
    setAttachments([...attachments, { id: generateId(), name: newAttachmentName.trim(), url: newAttachmentUrl || "#", addedAt: new Date().toISOString() }]);
    setNewAttachmentName(""); setNewAttachmentUrl(""); setActivePopover(null);
  };

  const deleteAttachment = (attId: string) => {
    if (readOnly) return;
    setAttachments(attachments.filter(a => a.id !== attId));
  };

  // --------------------------------------------------------------------------
  // ✨ LÓGICA DE COMENTÁRIOS E LEITURA CORRIGIDA PARA MODO OFFLINE
  // --------------------------------------------------------------------------
  const handleShowComments = async () => {
    setShowComments(true);

    const userId = profile?.id || profileId;
    let hasChanges = false;

    const updatedComments = comments.map(c => {
      if (c.isLog) return c; 
      
      const readBy = c.readBy || [];
      if (userId && !readBy.includes(userId)) {
        hasChanges = true;
        return { ...c, readBy: [...readBy, userId] };
      }
      return c;
    });

    if (hasChanges) {
      setComments(updatedComments);
      if (editingCard) {
        try {
          // Substituição por Fallback Offline
          await apiWithOfflineFallback(
            'PUT',
            `/eletrica-tasks/${editingCard.id}`,
            { comments: updatedComments },
            'tarefa_comentario_lido',
            editingCard.id
          );
        } catch (e) {
          console.error("Erro ao marcar comentários como lidos", e);
        }
      }
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !editingCard) return;
    
    const userId = profile?.id || profileId || "";
    const newComment = { 
      id: generateId(), 
      author: profile?.name || "Usuário", 
      text: commentText.trim(), 
      createdAt: new Date().toISOString(),
      readBy: [userId]
    };
    
    const newComments = [...comments, newComment];
    setComments(newComments);
    setCommentText("");

    try {
      // Substituição por Fallback Offline
      const result = await apiWithOfflineFallback(
        'PUT',
        `/eletrica-tasks/${editingCard.id}`,
        { comments: newComments },
        'tarefa_adicionar_comentario',
        editingCard.id
      );
      
      if (result && result.offline) {
        toast.warning("Sem internet. O seu comentário foi guardado e será enviado mais tarde.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Ocorreu um erro ao guardar o comentário.");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (readOnly) return;
    const newComments = comments.filter(c => c.id !== commentId);
    setComments(newComments);
    if (editingCard) {
      try { 
        // Substituição por Fallback Offline
        await apiWithOfflineFallback(
          'PUT',
          `/eletrica-tasks/${editingCard.id}`,
          { comments: newComments },
          'tarefa_excluir_comentario',
          editingCard.id
        ); 
      } catch (e) {
        toast.error("Ocorreu um erro ao tentar apagar o comentário.");
      }
    }
  };

  if (!isOpen) return null;

  const coverIsUrl = coverUrl && (coverUrl.startsWith("http") || coverUrl.startsWith("/"));
  const cardMembers = Array.from(new Map(checklists.filter(c => c.assignedToId).map(c => [c.assignedToId, { id: c.assignedToId, name: c.assignedToName }])).values());

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-start justify-center p-3 pt-6 md:pt-10 overflow-y-auto animate-in fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) handleCloseModal(); }}
    >
      <div className="bg-card border border-border/50 rounded-3xl w-full max-w-[900px] shadow-2xl relative overflow-hidden flex flex-col min-h-[70vh] mb-6">

        {/* COVER BANNER */}
        {coverUrl && (
          coverIsUrl ? (
            <div className="w-full h-32 md:h-40 bg-cover bg-center" style={{ backgroundImage: `url(${coverUrl})` }} />
          ) : (
            <div className="w-full h-10 md:h-12" style={{ backgroundColor: coverUrl }} />
          )
        )}

        <button onClick={handleCloseModal} className="absolute top-3 right-3 md:top-4 md:right-4 p-2 rounded-full hover:bg-muted transition-all z-10 bg-background/60 backdrop-blur-lg border border-border/50 shadow-sm text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        {/* HEADER COM TIPOGRAFIA PREMIUM */}
        <div className="px-6 pt-6 pb-4 md:px-8 md:pt-8 md:pb-6 flex items-start gap-4 border-b border-border/50 bg-card/50">
          <div className="hidden md:flex w-12 h-12 rounded-xl bg-primary/10 items-center justify-center shrink-0 border border-primary/20">
             <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 pt-0.5">
            {isEditingTitle && !readOnly ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { setIsEditingTitle(false); triggerAutoSave(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setIsEditingTitle(false); triggerAutoSave(); } }}
                className="text-xl md:text-2xl font-extrabold text-foreground bg-transparent border-b-2 border-primary outline-none w-full pb-1"
                autoFocus
              />
            ) : (
              <h2
                className={`text-xl md:text-2xl font-extrabold text-foreground ${readOnly ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'}`}
                onClick={() => !readOnly && setIsEditingTitle(true)}
              >
                {title}
              </h2>
            )}
            <p className="text-xs md:text-sm text-muted-foreground font-medium mt-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary/50" />
              Detalhes da Ordem de Serviço
            </p>
          </div>
        </div>

        {/* CORPO ESPAÇOSO (Flexível Mobile/Desktop) */}
        <div className="flex flex-col md:flex-row px-6 py-6 md:px-8 md:py-8 gap-8">

          {/* ── LADO ESQUERDO (CONTEÚDO) ── */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Badges */}
            {(cardMembers.length > 0 || tags.length > 0 || dueDate || priority) && (
              <div className="flex flex-wrap gap-6">
                {cardMembers.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Equipa</h4>
                    <div className="flex -space-x-2">
                      {cardMembers.map((m) => (
                        <div key={m.id} title={m.name} className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm ring-2 md:ring-4 ring-card transition-transform hover:scale-110 cursor-pointer">
                          {m.name.substring(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Etiquetas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((label) => {
                        const colorInfo = LABEL_COLORS[label.color || 'blue'];
                        return (
                          <span key={label.id} className="px-2.5 py-1 rounded-md text-[11px] md:text-xs font-bold shadow-sm" style={{ backgroundColor: colorInfo?.bg, color: colorInfo?.text }}>
                            {label.name || label.color}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {priority && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prioridade</h4>
                    <span className="inline-flex px-2.5 py-1 rounded-md text-[11px] md:text-xs font-bold text-white shadow-sm" style={{ backgroundColor: PRIORITIES.find(p => p.value === priority)?.color }}>
                      {PRIORITIES.find(p => p.value === priority)?.label}
                    </span>
                  </div>
                )}
                {dueDate && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prazo</h4>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] md:text-xs font-bold shadow-sm ${new Date(dueDate) < new Date() ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground border border-border"}`}>
                      <Clock className="w-3 h-3" />
                      {new Date(dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Descrição Premium */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <AlignLeft className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                <h4 className="text-base md:text-lg font-bold text-foreground">Descrição do Serviço</h4>
              </div>
              {isEditingDesc && !readOnly ? (
                <div className="md:pl-7">
                  <textarea
                    ref={descRef}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 rounded-xl border border-input bg-muted/30 shadow-inner text-sm resize-none outline-none focus:ring-2 focus:ring-primary min-h-[140px] leading-relaxed"
                    placeholder="Detalhe o que precisa ser feito..."
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={() => { setIsEditingDesc(false); triggerAutoSave(); }} className="px-4 rounded-lg font-bold">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescription(editingCard?.description || ""); setIsEditingDesc(false); }} className="rounded-lg">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`md:pl-7 py-1 transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer group'}`}
                  onClick={() => !readOnly && setIsEditingDesc(true)}
                >
                  {description ? (
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap transition-colors ${readOnly ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                      {description}
                    </p>
                  ) : (
                    !readOnly ? (
                      <div className="p-5 rounded-xl bg-muted/40 border border-dashed border-border/60 text-center text-sm font-medium text-muted-foreground group-hover:bg-muted/60 transition-colors">
                        Adicionar uma descrição detalhada...
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Nenhuma descrição providenciada.</p>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Checklists (Recolhíveis e com permissões corretas) */}
            {checklists.map((checklist) => {
              if (isTecnico && checklist.assignedToId && checklist.assignedToId !== profileId) return null;

              const total = checklist.items.length;
              const completed = checklist.items.filter((i) => i.completed).length;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const cTitle = (checklist as any).title || "Lista de Tarefas";
              const isExpanded = expandedGroups[checklist.id];

              return (
                <div key={checklist.id} className="pt-3 border-t border-border/40">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckSquare className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0" />
                    
                    {/* Título Editável APENAS POR CHEFES */}
                    {editingChecklistTitle === checklist.id && !readOnly ? (
                      <input
                        value={editingChecklistTitleValue}
                        onChange={(e) => setEditingChecklistTitleValue(e.target.value)}
                        onBlur={() => updateChecklistTitle(checklist.id, editingChecklistTitleValue || cTitle)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") updateChecklistTitle(checklist.id, editingChecklistTitleValue || cTitle);
                          if (e.key === "Escape") setEditingChecklistTitle(null);
                        }}
                        className="flex-1 text-base md:text-lg font-bold text-foreground bg-transparent border-b-2 border-primary outline-none"
                        autoFocus
                      />
                    ) : (
                      <div className={`flex-1 flex flex-wrap items-center gap-2 ${readOnly ? '' : 'cursor-pointer group/title'}`} onClick={() => { if(!readOnly) { setEditingChecklistTitle(checklist.id); setEditingChecklistTitleValue(cTitle); } }}>
                        <h4 className={`text-base md:text-lg font-bold text-foreground ${readOnly ? '' : 'group-hover:opacity-80 transition-opacity'}`}>{cTitle}</h4>
                        {checklist.assignedToName && (
                          <span className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase text-muted-foreground px-2 py-0.5 md:px-3 md:py-1 bg-muted rounded-md">
                            TEC: {checklist.assignedToName.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="sm" onClick={() => toggleChecklistExpansion(checklist.id)} className="text-muted-foreground hover:bg-muted rounded-lg px-2">
                         {isExpanded ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />}
                       </Button>
                       {/* BOTÃO EXCLUIR MODIFICADO PARA ÍCONE */}
                       {!readOnly && (
                         <Button variant="ghost" size="sm" onClick={() => deleteChecklist(checklist.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg px-2" title="Excluir lista">
                           <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                         </Button>
                       )}
                    </div>
                  </div>
                  
                  <div className="md:pl-9 mb-4 flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-8">{percent}%</span>
                    <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden border border-border/50">
                      <div className={`h-full transition-all duration-500 shadow-sm ${percent === 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  {isExpanded && (
                     <DragDropContext onDragEnd={(r) => onChecklistItemDragEnd(checklist.id, r)}>
                       <Droppable droppableId={`checklist-items-${checklist.id}`} isDropDisabled={readOnly}>
                         {(provided) => (
                           <div className="md:pl-9 space-y-1.5" ref={provided.innerRef} {...provided.droppableProps}>
                             {checklist.items.map((item, idx) => {
                               const isMyItem = isTecnico && checklist.assignedToId === profileId;
                               const canToggle = !readOnly || isMyItem;

                               return (
                               <Draggable key={item.id} draggableId={`item-${item.id}`} index={idx} isDragDisabled={readOnly}>
                                 {(dragProvided, dragSnapshot) => (
                                   <div
                                     ref={dragProvided.innerRef}
                                     {...dragProvided.draggableProps}
                                     className={`flex items-center gap-3 group/item py-2 px-3 rounded-xl transition-all border ${dragSnapshot.isDragging ? "bg-accent border-border shadow-md scale-[1.02]" : "bg-muted/10 border-transparent hover:bg-muted/40 hover:border-border/50"}`}
                                   >
                                     <span {...dragProvided.dragHandleProps} className={`opacity-0 ${!readOnly && 'group-hover/item:opacity-100'} cursor-grab active:cursor-grabbing text-muted-foreground shrink-0`}>
                                       <GripVertical className="w-4 h-4 md:w-5 md:h-5" />
                                     </span>
                                     
                                     {/* TÉCNICO PODE MARCAR E DESMARCAR SE FOR SUA TAREFA */}
                                     <button 
                                        onClick={() => canToggle && handleToggleChecklistItem(checklist.id, item.id)} 
                                        className={`shrink-0 transition-transform active:scale-90 ${canToggle ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
                                     >
                                       {item.completed ? (
                                         <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center shadow-sm">
                                           <Check className="w-3.5 h-3.5 text-white" />
                                         </div>
                                       ) : (
                                         <div className="w-5 h-5 rounded-md border-2 border-muted-foreground bg-background transition-colors hover:border-primary shadow-sm" />
                                       )}
                                     </button>
                                     
                                     {editingItem?.groupId === checklist.id && editingItem?.itemId === item.id && !readOnly ? (
                                       <input
                                         value={editingItemValue}
                                         onChange={(e) => setEditingItemValue(e.target.value)}
                                         onBlur={() => saveEditingItem(checklist.id, item.id)}
                                         onKeyDown={(e) => {
                                           if (e.key === "Enter") saveEditingItem(checklist.id, item.id);
                                           if (e.key === "Escape") setEditingItem(null);
                                         }}
                                         className="flex-1 px-3 py-1.5 rounded-lg border border-primary bg-background text-sm font-medium outline-none shadow-sm"
                                         autoFocus
                                       />
                                     ) : (
                                       <span
                                         className={`flex-1 text-sm font-medium select-none transition-colors ${item.completed ? "line-through text-muted-foreground/60" : "text-foreground"} ${readOnly ? '' : 'cursor-text'}`}
                                         onDoubleClick={() => { if(!readOnly){ setEditingItem({ groupId: checklist.id, itemId: item.id }); setEditingItemValue(item.text); } }}
                                       >
                                         {item.text}
                                       </span>
                                     )}
                                     
                                     {!readOnly && (
                                       <button onClick={() => deleteChecklistItem(checklist.id, item.id)} className="opacity-0 group-hover/item:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 transition-all shrink-0">
                                         <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                       </button>
                                     )}
                                   </div>
                                 )}
                               </Draggable>
                               );
                             })}
                             {provided.placeholder}
                           </div>
                         )}
                       </Droppable>
                     </DragDropContext>
                  )}
                  
                  {isExpanded && !readOnly && (
                    addingItemForChecklist === checklist.id ? (
                      <div className="md:pl-9 mt-3">
                        <input
                          value={newItemText}
                          onChange={(e) => setNewItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addChecklistItem(checklist.id);
                            if (e.key === "Escape") { setAddingItemForChecklist(null); setNewItemText(""); }
                          }}
                          placeholder="Adicionar tarefa..."
                          className="w-full px-4 py-2 rounded-lg border border-input bg-background shadow-sm text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => addChecklistItem(checklist.id)} className="rounded-lg font-bold px-4">Salvar</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAddingItemForChecklist(null); setNewItemText(""); }} className="rounded-lg">Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingItemForChecklist(checklist.id)}
                        className="md:ml-9 mt-3 px-4 py-2 rounded-lg bg-muted/30 border border-dashed border-border/80 hover:border-primary hover:bg-muted text-[13px] font-bold text-muted-foreground hover:text-foreground transition-all shadow-sm"
                      >
                        + Adicionar nova tarefa
                      </button>
                    )
                  )}
                </div>
              );
            })}

            {/* Anexos */}
            {attachments && attachments.length > 0 && (
              <div className="pt-4 border-t border-border/40">
                <div className="flex items-center gap-3 mb-3">
                  <Paperclip className="w-5 h-5 text-muted-foreground" />
                  <h4 className="text-base md:text-lg font-bold text-foreground">Documentos Anexos</h4>
                </div>
                <div className="md:pl-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 group/att transition-all cursor-pointer shadow-sm">
                      <div className="w-12 h-10 bg-background rounded-lg flex items-center justify-center text-[10px] font-black text-primary uppercase border border-border shadow-sm">
                        {att.name.split(".").pop() || 'ARQ'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{att.name}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">{new Date(att.addedAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      {!readOnly && (
                        <button onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }} className="opacity-0 group-hover/att:opacity-100 p-2 rounded-lg hover:bg-destructive/10 transition-all">
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── LADO DIREITO (AÇÕES / SIDEBAR PREMIUM) ── */}
          {/* APENAS MOSTRA ESTA BARRA PARA CHEFES E ADMINS */}
          {!readOnly && (
            <div className="w-full md:w-56 space-y-2 flex-shrink-0 mt-6 md:mt-0 relative md:sticky md:top-6 self-start">
                <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 pl-1 hidden md:block">Adicionar</h4>

                {/* BOTÕES DA SIDEBAR */}
                {[
                  { id: "assign", icon: UserPlus, label: "Atribuir Técnico" },
                  { id: "priority", icon: AlertCircle, label: "Prioridade" },
                  { id: "labels", icon: Tag, label: "Etiquetas" },
                  { id: "checklist", icon: CheckSquare, label: "Criar Checklist" },
                  { id: "date", icon: Clock, label: "Definir Prazo" },
                  { id: "attachment", icon: Paperclip, label: "Anexar Arquivo" },
                  { id: "cover", icon: Image, label: "Capa do Cartão" }
                ].map((btn) => (
                  <div key={btn.id} className="relative">
                    <button
                      onClick={() => setActivePopover(activePopover === btn.id ? null : btn.id as PopoverType)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-muted/40 border border-transparent hover:border-border hover:bg-muted text-[13px] font-bold text-foreground transition-all shadow-sm"
                    >
                      <btn.icon className="w-4 h-4 text-muted-foreground" /> {btn.label}
                    </button>
                    
                    {/* POPOVER RENDERIZADO */}
                    {activePopover === btn.id && (
                      <div ref={popoverRef} className="absolute right-0 md:right-full md:mr-3 top-0 md:top-auto w-[280px] bg-popover border border-border/80 rounded-2xl shadow-xl z-[100] p-5 animate-in slide-in-from-right-4 md:fade-in">
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="text-sm font-extrabold text-foreground">
                            {btn.label}
                          </h5>
                          <button onClick={() => setActivePopover(null)} className="p-1.5 rounded-md hover:bg-muted transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
                        </div>

                        {/* ATRIBUIR TÉCNICO */}
                        {btn.id === "assign" && (
                          <div className="space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Escolha um técnico. Será criado um bloco de tarefas em seu nome.
                            </p>
                            <select value={assignTechId} onChange={(e) => setAssignTechId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm cursor-pointer">
                              {technicians.length === 0 && <option value="">Sem equipa disponível...</option>}
                              {technicians.map(t => <option key={t.id} value={t.id}>{t.name || t.email}</option>)}
                            </select>
                            <Button onClick={handleAssignTechnician} disabled={!assignTechId} className="w-full rounded-lg h-10 font-bold shadow-md">
                              Atribuir Técnico
                            </Button>
                          </div>
                        )}

                        {/* PRIORIDADE */}
                        {btn.id === "priority" && (
                          <div className="space-y-2">
                            {PRIORITIES.map(p => (
                              <button key={p.value} onClick={() => { setPriority(p.value); triggerAutoSave({ priority: p.value }); setActivePopover(null); }} className="flex items-center w-full p-2.5 rounded-lg hover:bg-muted text-sm font-bold transition-all border border-transparent hover:border-border">
                                <span className="w-3.5 h-3.5 rounded-full mr-3 shadow-sm" style={{ backgroundColor: p.color }} />
                                <span className="flex-1 text-left text-foreground">{p.label}</span>
                                {priority === p.value && <Check className="w-4 h-4 text-primary" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ETIQUETAS */}
                        {btn.id === "labels" && (
                          <div className="space-y-2.5">
                            {Object.entries(LABEL_COLORS).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-2">
                                <button onClick={() => toggleLabel(key)} className="flex-1 flex items-center h-9 rounded-lg px-3 shadow-sm border border-transparent hover:opacity-85 transition-opacity" style={{ backgroundColor: val.bg }}>
                                  {editingLabelKey === key ? (
                                    <input
                                      value={labelNames[key]} onChange={(e) => setLabelNames((prev) => ({ ...prev, [key]: e.target.value }))}
                                      onBlur={() => saveLabelName(key)} onKeyDown={(e) => { if (e.key === "Enter") saveLabelName(key); e.stopPropagation(); }}
                                      onClick={(e) => e.stopPropagation()} className="flex-1 bg-transparent outline-none text-xs font-extrabold w-full" style={{ color: val.text }} autoFocus
                                    />
                                  ) : (
                                    <span className="text-xs font-extrabold" style={{ color: val.text }}>{labelNames[key] || "Nova"}</span>
                                  )}
                                  {tags.some((l) => l.color === key) && <Check className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: val.text }} />}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingLabelKey(editingLabelKey === key ? null : key); }} className="p-2 rounded-lg bg-muted hover:bg-accent border border-border transition-colors shadow-sm">
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* CHECKLIST (Apenas Nome) */}
                        {btn.id === "checklist" && (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nome da Lista</label>
                              <input
                                value={newChecklistTitle} onChange={(e) => setNewChecklistTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChecklistGroup()} placeholder="Ex: Materiais..."
                                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm" autoFocus
                              />
                            </div>
                            <Button onClick={addChecklistGroup} disabled={!newChecklistTitle.trim()} className="w-full rounded-lg h-10 font-bold shadow-md">
                              Criar Lista
                            </Button>
                          </div>
                        )}

                        {/* DATA */}
                        {btn.id === "date" && (
                          <div className="space-y-3">
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm" />
                            <div className="flex gap-2">
                              <Button onClick={() => { triggerAutoSave({ dueDate }); setActivePopover(null); }} className="flex-1 rounded-lg h-9 font-bold">Salvar</Button>
                              {dueDate && <Button variant="destructive" onClick={() => { setDueDate(""); triggerAutoSave({ dueDate: "" }); setActivePopover(null); }} className="rounded-lg h-9 font-bold">Limpar</Button>}
                            </div>
                          </div>
                        )}

                        {/* ANEXO */}
                        {btn.id === "attachment" && (
                          <div className="space-y-2.5">
                            <input value={newAttachmentName} onChange={(e) => setNewAttachmentName(e.target.value)} placeholder="Nome do documento" className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm" autoFocus />
                            <input value={newAttachmentUrl} onChange={(e) => setNewAttachmentUrl(e.target.value)} placeholder="Link URL" className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm" />
                            <Button onClick={addAttachment} className="w-full rounded-lg h-10 font-bold shadow-md mt-1">
                              Adicionar Anexo
                            </Button>
                          </div>
                        )}

                        {/* CAPA */}
                        {btn.id === "cover" && (
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Cores</p>
                              <div className="grid grid-cols-4 gap-2">
                                {COVER_COLORS.map((color) => (
                                  <button key={color} onClick={() => { setCoverUrl(color); triggerAutoSave({ coverUrl: color }); setActivePopover(null); }} className={`h-10 rounded-lg transition-transform hover:scale-105 shadow-sm border border-transparent ${coverUrl === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} style={{ backgroundColor: color }} />
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">URL de Imagem</p>
                              <input value={coverUrl.startsWith('#') ? '' : coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-primary shadow-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={() => { triggerAutoSave({ coverUrl }); setActivePopover(null); }} className="flex-1 rounded-lg h-10 font-bold">Aplicar</Button>
                              {coverUrl && <Button variant="destructive" onClick={() => { setCoverUrl(''); triggerAutoSave({ coverUrl: '' }); setActivePopover(null); }} className="rounded-lg h-10 font-bold">Remover</Button>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* BOTÕES DE EXCLUIR E ARQUIVAR */}
                {editingCard && (
                  <div className="pt-4 mt-4 border-t border-border/50">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 pl-1 hidden md:block">Gestão</h4>
                    <div className="flex md:flex-col gap-2">
                      <button onClick={handleArchive} className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-muted/40 border border-transparent hover:border-border hover:bg-muted text-[13px] font-bold text-foreground transition-all shadow-sm">
                        <Archive className="w-4 h-4 text-muted-foreground" /> Concluir
                      </button>
                      
                      <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-destructive/10 border border-transparent hover:border-destructive/30 hover:bg-destructive/20 text-[13px] font-bold text-destructive transition-all shadow-sm">
                        <Trash2 className="w-4 h-4" /> Excluir
                      </button>
                    </div>
                  </div>
                )}
            </div>
          )}

        </div>
        
        {/* ============================================================== */}
        {/* LOGS E COMENTÁRIOS (RODAPÉ DO MODAL)                           */}
        {/* ============================================================== */}
        <div className="px-6 py-6 md:px-10 md:py-8 bg-muted/10 border-t border-border/50 mt-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              <h4 className="text-base md:text-lg font-bold text-foreground">Histórico da Ordem</h4>
            </div>
            
            {/* NOVO BOTÃO QUE EXIBE AS CONVERSAS */}
            {!showComments && (
              <Button onClick={handleShowComments} size="sm" className="rounded-lg font-bold shadow-md">
                Mostrar Conversa
              </Button>
            )}
          </div>
          
          {/* APENAS RENDERIZA SE showComments FOR TRUE */}
          {showComments && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-start gap-3 md:gap-4 mb-8">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center text-xs md:text-sm font-bold text-primary-foreground shrink-0 shadow-md">
                  {profile?.name?.substring(0,2).toUpperCase() || 'U'}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder="Escreva uma mensagem para a equipa..."
                    className="w-full px-4 py-3 rounded-2xl border border-input bg-background shadow-inner text-sm outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
                  />
                  {commentText.trim() && (
                    <Button onClick={handleAddComment} size="sm" className="mt-2 px-6 rounded-lg font-bold shadow-md">Enviar Mensagem</Button>
                  )}
                </div>
              </div>

              {comments.length > 0 ? (
                <div className="space-y-4">
                  {[...comments].reverse().map((comment) => (
                    <div key={comment.id} className={`flex items-start gap-3 md:gap-4 group/comment relative ${comment.isLog ? 'opacity-90 md:pl-14' : ''}`}>
                      
                      {comment.isLog ? (
                        <div className="flex-1 flex items-center gap-3 py-2.5 px-4 rounded-xl bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] bg-muted/40 border border-border shadow-sm">
                           <Info className="w-4 h-4 text-primary shrink-0" />
                           <div className="flex-1">
                              <p className="text-xs md:text-sm font-medium text-foreground">{comment.text}</p>
                              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                 Log de Sistema • {new Date(comment.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                           </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center text-xs md:text-sm font-bold text-primary-foreground shrink-0 shadow-md">
                            {comment.author.substring(0,2).toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0 p-4 rounded-2xl rounded-tl-none shadow-sm border border-border bg-card">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="text-xs md:text-sm font-extrabold text-foreground">{comment.author}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded-md">
                                {new Date(comment.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{comment.text}</p>
                          </div>

                          {!readOnly && !comment.isLog && (
                            <button onClick={() => handleDeleteComment(comment.id)} className="absolute -right-2 -top-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/comment:opacity-100 transition-all shadow-md scale-90 hover:scale-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border">
                   <MessageSquare className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                   <p className="text-xs text-muted-foreground font-medium">Nenhum histórico registado nesta ordem.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
