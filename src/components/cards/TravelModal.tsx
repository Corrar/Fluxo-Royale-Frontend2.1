import React, { useState, useEffect, useRef, Fragment } from 'react';
import {
  X, CreditCard, AlignLeft, Tag, CheckSquare, Clock, Paperclip,
  MessageSquare, Archive, Trash2, Check, Pencil, Image, GripVertical, AlertCircle, Users, Info, ChevronDown, ChevronUp, Timer, MapPin, Search, Send, CalendarDays, Map, ExternalLink, ChevronLeft, FileText, Printer, Eye
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { CardData, CategoryColor, Priority, ChecklistGroup, Tag as TagType } from '@/types/card';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTravels } from '@/hooks/useTravels'; 
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSocket } from '@/contexts/SocketContext';
// ✨ IMPORTAÇÃO DO FALLBACK OFFLINE
import { apiWithOfflineFallback } from '@/utils/offlineSync';

interface TravelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, description: string, category: CategoryColor, priority: Priority, checklists: ChecklistGroup[], tags: TagType[], imageUrl?: string, dueDate?: Date) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  editingCard?: any;
  readOnly?: boolean;
  isTecnico?: boolean; 
  profileId?: string;
}

type PopoverType = "labels" | "assign" | "checklist" | "date" | "attachment" | "cover" | "priority" | null;
type TabType = "details" | "time" | "report" | "chat" | "logs";

const COVER_COLORS = ["#61bd4f", "#f2d600", "#ff9f1a", "#eb5a46", "#c377e0", "#0079bf", "#00c2e0", "#51e898", "#ff78cb", "#344563", "#b3bac5", "#dfe1e6"];
const LABEL_COLORS: Record<string, { bg: string, text: string }> = { blue: { bg: "#3b82f6", text: "#ffffff" }, green: { bg: "#22c55e", text: "#ffffff" }, orange: { bg: "#f97316", text: "#ffffff" }, pink: { bg: "#ec4899", text: "#ffffff" }, purple: { bg: "#a855f7", text: "#ffffff" }, teal: { bg: "#14b8a6", text: "#ffffff" } };
const PRIORITIES: { value: Priority; label: string; color: string }[] = [{ value: 'low', label: 'Baixa Prioridade', color: '#22c55e' }, { value: 'medium', label: 'Prioridade Média', color: '#eab308' }, { value: 'high', label: 'Alta Prioridade', color: '#f97316' }, { value: 'urgent', label: 'Urgência Máxima', color: '#ef4444' }];
const generateId = () => Math.random().toString(36).substring(2, 9);

export function TravelModal({ isOpen, onClose, onSave, onDelete, onArchive, editingCard, readOnly, isTecnico, profileId }: TravelModalProps) {
  const { profile } = useAuth();
  const { assignTraveler, removeTraveler, toggleChecklistItem: toggleChecklistApi, clockIn, clockOut } = useTravels() as any;
  const { socket } = useSocket(); 

  const myId = profile?.id || profileId || ""; 

  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [mobileChatView, setMobileChatView] = useState<'list' | 'messages'>('list');

  const [title, setTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [priority, setPriority] = useState<Priority>('medium');
  const [checklists, setChecklists] = useState<ChecklistGroup[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');

  const [technicians, setTechnicians] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // ✨ ESTADOS DO RELATÓRIO TÉCNICO
  const [reportClientName, setReportClientName] = useState("");
  const [reportCompany, setReportCompany] = useState("");
  const [reportObservations, setReportObservations] = useState("");
  const [showMobilePreview, setShowMobilePreview] = useState(false); // ✨ Controle de Visualização Mobile

  const [attachments, setAttachments] = useState<{id: string, name: string, url: string, addedAt: string}[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [selectedChatUser, setSelectedChatUser] = useState<string>('all');
  const [logSearchTerm, setLogSearchTerm] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");

  const [locationAddress, setLocationAddress] = useState<{city?: string, state?: string, postcode?: string} | null>(null);

  const [activePopover, setActivePopover] = useState<PopoverType>(null);
  const [travelers, setTravelers] = useState<any[]>([]); 
  const [assignTechId, setAssignTechId] = useState<string>('');
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
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
  const [labelNames, setLabelNames] = useState<Record<string, string>>(() => ({ blue: 'Azul', green: 'Verde', orange: 'Laranja', pink: 'Rosa', purple: 'Roxo', teal: 'Turquesa' }));

  const descRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const triggerAutoSave = (newValues: any = {}) => {
    if (readOnly || !editingCard || !title.trim()) return; 
    onSave(
      newValues.title ?? title.trim(), newValues.description ?? description.trim(), 'blue', 
      newValues.priority ?? priority, newValues.checklists ?? checklists, newValues.tags ?? tags, 
      newValues.coverUrl !== undefined ? newValues.coverUrl : (coverUrl || undefined), 
      newValues.dueDate !== undefined ? (newValues.dueDate ? new Date(newValues.dueDate) : undefined) : (dueDate ? new Date(dueDate) : undefined)
    );
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab("details");
      setMobileChatView("list");
      setExpandedLogId(null);
      setShowMobilePreview(false);
      api.get('/users').then((res) => {
        setTravelers(res.data);
        setAssignTechId('');
      }).catch(() => {});

      if (editingCard) {
        setTitle(editingCard.title || '');
        setDescription(editingCard.description || '');
        setPriority(editingCard.priority || 'medium');
        setChecklists(editingCard.checklists || []);
        setTags(editingCard.tags || []);
        setCoverUrl(editingCard.imageUrl || '');
        setDueDate(editingCard.dueDate ? new Date(editingCard.dueDate).toISOString().split('T')[0] : '');
        setAttachments(editingCard.attachments || []);
        setComments(editingCard.comments || []);
        setTechnicians(editingCard.technicians || []); 
        setTimeLogs(editingCard.time_logs || []);

        const names = { blue: 'Azul', green: 'Verde', orange: 'Laranja', pink: 'Rosa', purple: 'Roxo', teal: 'Turquesa' };
        (editingCard.tags || []).forEach((t: any) => { if (t.color) (names as any)[t.color] = t.name; });
        setLabelNames(names);

        const expandedState: Record<string, boolean> = {};
        (editingCard.checklists || []).forEach((g: any) => { expandedState[g.id] = true });
        setExpandedGroups(expandedState);

        if (editingCard.id) {
          api.get(`/travels/${editingCard.id}`).then((res) => {
            const data = res.data;
            setChecklists(data.checklists || []);
            setComments(data.comments || []);
            setTechnicians(data.technicians || []);
            setTimeLogs(data.time_logs || []); 
          }).catch(() => {});
        }

      } else {
        setTitle('Nova Viagem'); setDescription(''); setPriority('medium'); setChecklists([]);
        setTags([]); setCoverUrl(''); setDueDate(''); setAttachments([]); setComments([]); setTechnicians([]); setTimeLogs([]);
      }
    }
  }, [isOpen, editingCard]);

  // TEMPO REAL INVISÍVEL NO MODAL
  useEffect(() => {
    if (!socket || !isOpen || !editingCard?.id) return;

    const handleTravelUpdate = () => {
      api.get(`/travels/${editingCard.id}`).then((res) => {
        const data = res.data;
        setChecklists(data.checklists || []);
        setComments(data.comments || []);
        setTechnicians(data.technicians || []);
        setTimeLogs(data.time_logs || []); 
      }).catch(() => {});
    };

    socket.on('travel_board_updated', handleTravelUpdate);
    
    return () => {
      socket.off('travel_board_updated', handleTravelUpdate);
    };
  }, [socket, isOpen, editingCard?.id]);

  const openLog = timeLogs.find((l: any) => l.user_id === myId && !l.check_out);

  useEffect(() => {
    if (activeTab === 'time' && openLog && openLog.check_in_lat && openLog.check_in_lng) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${openLog.check_in_lat}&lon=${openLog.check_in_lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'pt-BR' }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.address) {
          setLocationAddress({
            city: data.address.city || data.address.town || data.address.village || data.address.municipality,
            state: data.address.state,
            postcode: data.address.postcode
          });
        }
      })
      .catch(err => console.error("Erro no geocoding reverso", err));
    } else {
      setLocationAddress(null);
    }
  }, [activeTab, openLog]);

  // LÓGICA WHATSAPP: MARCAR COMO LIDA COM SUPORTE OFFLINE
  useEffect(() => {
    if (activeTab === 'chat' && editingCard && myId) {
      let hasChanges = false;
      const updatedComments = comments.map(c => {
        if (c.isLog) return c; 
        if (c.authorId === myId) return c; 
        
        const readBy = c.readBy || [];
        if (readBy.includes(myId)) return c; 

        if (selectedChatUser === 'all' && !c.recipientId) {
          hasChanges = true;
          return { ...c, readBy: [...readBy, myId] };
        }
        else if (selectedChatUser === c.authorId && c.recipientId === myId) {
          hasChanges = true;
          return { ...c, readBy: [...readBy, myId] };
        }
        
        return c;
      });

      if (hasChanges) {
        setComments(updatedComments); 
        apiWithOfflineFallback('PUT', `/travels/${editingCard.id}`, { comments: updatedComments }, 'chat', editingCard.id).catch(() => {});
      }
    }
  }, [activeTab, selectedChatUser, comments, editingCard, myId]);

  useEffect(() => {
    if (activeTab === 'chat') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, activeTab, selectedChatUser]);

  useEffect(() => { if (isEditingDesc && descRef.current) descRef.current.focus(); }, [isEditingDesc]);

  const handleCloseModal = () => { if(!editingCard && !readOnly) triggerAutoSave(); onClose(); }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { if (activePopover) setActivePopover(null); else handleCloseModal(); } };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose, activePopover, editingCard, title]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (activePopover && popoverRef.current && !popoverRef.current.contains(e.target as Node)) { setActivePopover(null); setEditingLabelKey(null); } };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePopover]);

  const handleDelete = () => { if (readOnly || !onDelete || !editingCard) return; if (confirm("Excluir esta viagem permanentemente?")) { onDelete(editingCard.id); onClose(); } };
  const handleArchive = () => { if (readOnly || !onArchive || !editingCard) return; onArchive(editingCard.id); onClose(); };

  const updateChecklistTitle = (groupId: string, newTitle: string) => {
    if (readOnly) return;
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, title: newTitle } as any : c);
    setChecklists(newChecklists); triggerAutoSave({ checklists: newChecklists }); setEditingChecklistTitle(null);
  };

  const saveEditingItem = (groupId: string, itemId: string) => {
    if (!editingItemValue.trim() || readOnly) { setEditingItem(null); return; }
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, text: editingItemValue.trim() } : i) } : c);
    setChecklists(newChecklists); triggerAutoSave({ checklists: newChecklists }); setEditingItem(null);
  };

  const onChecklistItemDragEnd = (groupId: string, result: DropResult) => {
    if (!result.destination || readOnly) return;
    if (result.destination.index === result.source.index) return;
    const newChecklists = checklists.map(c => {
      if (c.id !== groupId) return c;
      const items = Array.from(c.items);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination!.index, 0, moved);
      return { ...c, items };
    });
    setChecklists(newChecklists); triggerAutoSave({ checklists: newChecklists });
  };

  const toggleLabel = (colorKey: string) => {
    if (readOnly) return;
    const customName = labelNames[colorKey] || '';
    const existing = tags.find((l) => l.color === colorKey);
    let newTags = existing ? tags.filter((l) => l.color !== colorKey) : [...tags, { id: generateId(), color: colorKey, name: customName }];
    setTags(newTags); triggerAutoSave({ tags: newTags });
  };

  const saveLabelName = (colorKey: string) => {
    if (readOnly) return;
    const newName = labelNames[colorKey] || '';
    const newTags = tags.map((l) => l.color === colorKey ? { ...l, name: newName } : l);
    setTags(newTags); setEditingLabelKey(null); triggerAutoSave({ tags: newTags });
  };

  const handleAssignTechnician = () => {
    if (!assignTechId || readOnly || !editingCard) return;
    const tech = travelers.find(t => t.id === assignTechId);
    if (!tech) return;

    const isAlreadyAssigned = technicians.some((t: any) => t.user_id === tech.id);
    if (isAlreadyAssigned) return;

    if (assignTraveler) assignTraveler(editingCard.id, tech.id);
    setTechnicians([...technicians, { travel_id: editingCard.id, user_id: tech.id }]);

    const newLog = { id: `log-${Date.now()}`, author: 'Sistema', text: `${profile?.name || 'Administrador'} adicionou ${tech.name || tech.email} à viagem.`, createdAt: new Date().toISOString(), isLog: true };
    const newComments = [...comments, newLog];
    setComments(newComments);
    try { apiWithOfflineFallback('PUT', `/travels/${editingCard.id}`, { comments: newComments }, 'chat', editingCard.id); } catch(e) {}
    setAssignTechId('');
  }

  const handleRemoveTechnician = (memberId: string, memberName: string) => {
    if (readOnly || !editingCard) return;
    if (confirm(`Deseja remover ${memberName} da equipa desta viagem?`)) {
      if (removeTraveler) removeTraveler(editingCard.id, memberId);
      setTechnicians(technicians.filter(t => t.user_id !== memberId));

      const newLog = { id: `log-${Date.now()}`, author: 'Sistema', text: `${profile?.name || 'Administrador'} removeu ${memberName} da viagem.`, createdAt: new Date().toISOString(), isLog: true };
      const newComments = [...comments, newLog];
      setComments(newComments);
      try { apiWithOfflineFallback('PUT', `/travels/${editingCard.id}`, { comments: newComments }, 'chat', editingCard.id); } catch(e) {}
    }
  };

  const addChecklistGroup = () => {
    if (!newChecklistTitle.trim() || readOnly) return;
    const newGroupId = generateId();
    const newChecklists = [...checklists, { id: newGroupId, title: newChecklistTitle.trim(), items: [] } as any];
    setChecklists(newChecklists); setExpandedGroups(prev => ({ ...prev, [newGroupId]: true }));
    triggerAutoSave({ checklists: newChecklists }); setNewChecklistTitle(""); setActivePopover(null);
  };

  const deleteChecklist = (groupId: string) => {
    if (readOnly) return;
    const newChecklists = checklists.filter(c => c.id !== groupId);
    setChecklists(newChecklists); triggerAutoSave({ checklists: newChecklists });
  };

  const toggleChecklistExpansion = (groupId: string) => { setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] })); };

  const addChecklistItem = (groupId: string) => {
    if (!newItemText.trim() || readOnly) return;
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: [...c.items, { id: generateId(), text: newItemText.trim(), completed: false }] } : c);
    setChecklists(newChecklists); triggerAutoSave({ checklists: newChecklists }); setNewItemText("");
  };

  const handleToggleChecklistItem = (groupId: string, itemId: string) => {
    const canToggle = !readOnly || isTecnico;
    if (!canToggle) return;

    const group = checklists.find(c => c.id === groupId);
    const item = group?.items.find(i => i.id === itemId);
    if (!item) return;

    if (!item.completed && !openLog && isTecnico) {
      toast.error("Ação Bloqueada: Inicie o seu turno (bater ponto) antes de executar as atividades.", {
        icon: "🛑",
        duration: 5000
      });
      setActiveTab("time"); 
      return; 
    }

    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, completed: !i.completed } : i) } : c);
    setChecklists(newChecklists);

    if (isTecnico && editingCard && toggleChecklistApi) {
      toggleChecklistApi(editingCard.id, itemId, groupId);
    } else {
      triggerAutoSave({ checklists: newChecklists });
    }

    if (!item.completed && isTecnico) { 
      let totalItems = 0;
      let completedItems = 0;
      
      newChecklists.forEach(g => {
        g.items.forEach(i => {
          totalItems++;
          if (i.completed) completedItems++;
        });
      });

      if (totalItems > 0 && completedItems === totalItems) {
        toast.success("Parabéns! Concluiu todas as tarefas. Não se esqueça de fechar o seu turno (Ponto de Saída).", {
          icon: "🎉",
          duration: 6000 
        });
        
        setTimeout(() => {
          setActiveTab("time");
        }, 2000);
      }
    }
  };

  const deleteChecklistItem = (groupId: string, itemId: string) => {
    if (readOnly) return;
    const newChecklists = checklists.map(c => c.id === groupId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c);
    setChecklists(newChecklists); triggerAutoSave({ checklists: newChecklists });
  };

  const addAttachment = () => {
    if (!newAttachmentName.trim() || readOnly) return;
    setAttachments([...attachments, { id: generateId(), name: newAttachmentName.trim(), url: newAttachmentUrl || "#", addedAt: new Date().toISOString() }]);
    setNewAttachmentName(""); setNewAttachmentUrl(""); setActivePopover(null);
  };

  const deleteAttachment = (attId: string) => { if (readOnly) return; setAttachments(attachments.filter(a => a.id !== attId)); };

  const requestLocationAndClock = async (action: 'in' | 'out') => {
    const toastId = toast.loading("A verificar localização e a gravar...");
    
    let location: { lat: number, lng: number } | undefined = undefined;

    if (navigator.geolocation) {
      try {
        location = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => {
              navigator.geolocation.getCurrentPosition(
                (posLow) => resolve({ lat: posLow.coords.latitude, lng: posLow.coords.longitude }),
                (errLow) => reject(errLow),
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
              );
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        });
        toast.success("Localização confirmada com sucesso!", { id: toastId });
      } catch (error) {
        toast.warning("Sinal GPS fraco. A registar sem precisão exata.", { id: toastId });
      }
    } else {
       toast.dismiss(toastId);
    }

    try {
      if (action === 'in') {
        if (clockIn) {
          const data = await clockIn(editingCard.id, location);
          if (data) setTimeLogs(prev => [...prev, data]);
        }
      } else {
        if (clockOut) {
          const data = await clockOut(editingCard.id, location);
          if (data) setTimeLogs(prev => prev.map(l => l.id === data.id ? data : l));
        }
      }
    } catch (err) {}
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !editingCard) return;
    const userId = profile?.id || profileId || "";
    
    const newComment = { 
      id: generateId(), 
      authorId: userId,
      author: profile?.name || "Usuário", 
      text: commentText.trim(), 
      createdAt: new Date().toISOString(), 
      readBy: [userId],
      recipientId: selectedChatUser === 'all' ? null : selectedChatUser 
    };
    
    const newComments = [...comments, newComment];
    setComments(newComments); setCommentText("");
    try { await apiWithOfflineFallback('PUT', `/travels/${editingCard.id}`, { comments: newComments }, 'chat', editingCard.id); } catch (e) {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCard) return;

    if (file.size > 4 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 4MB para não sobrecarregar o sistema.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const toastId = toast.loading("A processar arquivo...");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const userId = profile?.id || profileId || "";
      
      const newComment = { 
        id: generateId(), 
        authorId: userId,
        author: profile?.name || "Usuário", 
        text: "", 
        fileName: file.name,
        attachmentUrl: base64String, 
        createdAt: new Date().toISOString(), 
        readBy: [userId],
        recipientId: selectedChatUser === 'all' ? null : selectedChatUser 
      };
      
      const newComments = [...comments, newComment];
      setComments(newComments);
      
      try { 
        await apiWithOfflineFallback('PUT', `/travels/${editingCard.id}`, { comments: newComments }, 'chat', editingCard.id); 
        toast.success("Arquivo enviado com sucesso!", { id: toastId });
      } catch (err) {
        toast.error("Erro ao guardar o arquivo no chat.", { id: toastId });
      }
    };
    
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteComment = async (commentId: string) => {
    if (readOnly) return;
    const newComments = comments.filter(c => c.id !== commentId);
    setComments(newComments);
    if (editingCard) { try { await apiWithOfflineFallback('PUT', `/travels/${editingCard.id}`, { comments: newComments }, 'chat', editingCard.id); } catch (e) {} }
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'Em andamento...';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const handlePrintReport = () => {
    const content = document.getElementById('printable-report')?.innerHTML;
    if (!content) return;
    
    const printWindow = window.open('', '', 'width=900,height=900');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório - ${title}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print {
              @page { margin: 1cm; }
              body { padding: 0 !important; }
            }
          </style>
        </head>
        <body class="bg-white text-black p-8">
          ${content}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 800);
  };

  if (!isOpen) return null;

  const coverIsUrl = coverUrl && (coverUrl.startsWith("http") || coverUrl.startsWith("/"));
  
  const cardMembers = technicians.map((t: any) => {
    const user = travelers.find(u => u.id === t.user_id);
    return { id: t.user_id, name: user?.name || user?.email || 'Viajante' };
  });

  const availableTravelers = travelers.filter(t => !technicians.some((tech: any) => tech.user_id === t.id));

  const systemLogs = comments.filter(c => c.isLog);
  const filteredLogs = systemLogs.filter(log => {
    const matchSearch = log.text.toLowerCase().includes(logSearchTerm.toLowerCase());
    const matchDate = logDateFilter ? new Date(log.createdAt).toISOString().startsWith(logDateFilter) : true;
    return matchSearch && matchDate;
  });

  const chatMessages = comments.filter(c => {
    if (c.isLog) return false;
    if (selectedChatUser === 'all') return !c.recipientId;
    return (c.authorId === myId && c.recipientId === selectedChatUser) || 
           (c.authorId === selectedChatUser && c.recipientId === myId);
  });

  const totalUnread = comments.filter(c => {
    if (c.isLog || c.authorId === myId) return false;
    const isToMe = c.recipientId === myId;
    const isToGroup = !c.recipientId;
    const isUnread = !c.readBy?.includes(myId);
    return (isToMe || isToGroup) && isUnread;
  }).length;

  const getUnreadGroupCount = () => {
    return comments.filter(c => 
      !c.isLog && 
      c.authorId !== myId && 
      !c.recipientId && 
      !c.readBy?.includes(myId)
    ).length;
  };

  const getUnreadDirectCount = (userId: string) => {
    return comments.filter(c => 
      !c.isLog && 
      c.authorId === userId && 
      c.recipientId === myId && 
      !c.readBy?.includes(myId)
    ).length;
  };

  const getLastMessage = (userId: string) => {
    const msgs = comments.filter(c => !c.isLog && ((c.authorId === myId && c.recipientId === userId) || (c.authorId === userId && c.recipientId === myId)));
    return msgs.length > 0 ? (msgs[msgs.length - 1].fileName ? `📎 ${msgs[msgs.length - 1].fileName}` : msgs[msgs.length - 1].text) : "Nenhuma mensagem";
  }

  const getLastGroupMessage = () => {
    const msgs = comments.filter(c => !c.isLog && !c.recipientId);
    return msgs.length > 0 ? (msgs[msgs.length - 1].fileName ? `📎 ${msgs[msgs.length - 1].fileName}` : msgs[msgs.length - 1].text) : "Nenhuma mensagem";
  }

  const sortedTravelers = [...travelers.filter(t => t.id !== profile?.id)].sort((a, b) => {
    const msgsA = comments.filter(c => !c.isLog && ((c.authorId === myId && c.recipientId === a.id) || (c.authorId === a.id && c.recipientId === myId)));
    const timeA = msgsA.length > 0 ? new Date(msgsA[msgsA.length - 1].createdAt).getTime() : 0;

    const msgsB = comments.filter(c => !c.isLog && ((c.authorId === myId && c.recipientId === b.id) || (c.authorId === b.id && c.recipientId === myId)));
    const timeB = msgsB.length > 0 ? new Date(msgsB[msgsB.length - 1].createdAt).getTime() : 0;

    return timeB - timeA;
  });

  return (
    <div ref={overlayRef} className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[100] flex items-end md:items-center justify-center md:p-6 overflow-hidden animate-in fade-in duration-300" onClick={(e) => { if (e.target === overlayRef.current) handleCloseModal(); }}>
      
      <div className="bg-background w-full md:max-w-[1000px] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] relative flex flex-col h-[93dvh] md:h-[90vh] rounded-t-[2.5rem] md:rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom-12 md:slide-in-from-bottom-0 md:zoom-in-95 duration-300">

        <div className="w-full flex justify-center pt-4 pb-2 absolute top-0 z-[110] md:hidden pointer-events-none">
           <div className="w-12 h-1.5 bg-foreground/20 rounded-full"></div>
        </div>

        <button onClick={handleCloseModal} className="absolute top-5 right-5 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-background/80 dark:bg-black/60 backdrop-blur-xl border border-border/40 shadow-lg text-foreground hover:bg-muted hover:scale-105 active:scale-95 transition-all z-[110]">
          <X className="w-5 h-5 md:w-6 md:h-6 opacity-80" />
        </button>

        {coverUrl && ( coverIsUrl ? ( <div className="w-full h-28 md:h-36 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${coverUrl})` }} /> ) : ( <div className="w-full h-12 shrink-0" style={{ backgroundColor: coverUrl }} /> ) )}

        <div className={`px-6 md:px-10 ${coverUrl ? 'pt-6' : 'pt-10 md:pt-12'} pb-4 flex flex-col gap-4 bg-background z-10 shrink-0 border-b border-border/40`}>
          <div className="flex items-start gap-4">
            <div className="hidden md:flex w-14 h-14 rounded-[1.25rem] bg-primary/10 items-center justify-center shrink-0 border border-primary/10 shadow-sm">
               <CreditCard className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 pr-10"> 
              {isEditingTitle && !readOnly ? (
                <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { setIsEditingTitle(false); triggerAutoSave(); }} onKeyDown={(e) => { if (e.key === "Enter") { setIsEditingTitle(false); triggerAutoSave(); } }} className="text-2xl md:text-3xl font-black text-foreground bg-transparent border-b-2 border-primary outline-none w-full pb-1" autoFocus />
              ) : (
                <h2 className={`text-2xl md:text-3xl font-black text-foreground tracking-tight leading-none ${readOnly ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'}`} onClick={() => !readOnly && setIsEditingTitle(true)}> {title} </h2>
              )}
              <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase mt-2.5 flex items-center gap-2">
                 Detalhes da Viagem
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2 w-full overflow-x-auto custom-scrollbar no-scrollbar-arrows pb-1 snap-x">
            <button onClick={() => setActiveTab('details')} className={`px-5 py-2.5 text-[13px] md:text-sm font-extrabold rounded-full transition-all flex items-center gap-2 whitespace-nowrap snap-start ${activeTab === 'details' ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <CheckSquare className="w-4 h-4" /> Tarefas
            </button>
            <button onClick={() => setActiveTab('time')} className={`px-5 py-2.5 text-[13px] md:text-sm font-extrabold rounded-full transition-all flex items-center gap-2 whitespace-nowrap snap-start ${activeTab === 'time' ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Timer className="w-4 h-4" /> Relógio de Ponto
            </button>
            
            {/* ✨ NOVO BOTÃO DE RELATÓRIO ✨ */}
            <button onClick={() => setActiveTab('report')} className={`px-5 py-2.5 text-[13px] md:text-sm font-extrabold rounded-full transition-all flex items-center gap-2 whitespace-nowrap snap-start ${activeTab === 'report' ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <FileText className="w-4 h-4" /> Relatório
            </button>

            <button onClick={() => setActiveTab('chat')} className={`relative px-5 py-2.5 text-[13px] md:text-sm font-extrabold rounded-full transition-all flex items-center gap-2 whitespace-nowrap snap-start ${activeTab === 'chat' ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <MessageSquare className="w-4 h-4" /> Chat
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-sm">
                  {totalUnread}
                </span>
              )}
            </button>
            <button onClick={() => setActiveTab('logs')} className={`px-5 py-2.5 text-[13px] md:text-sm font-extrabold rounded-full transition-all flex items-center gap-2 whitespace-nowrap snap-start ${activeTab === 'logs' ? 'bg-foreground text-background shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Info className="w-4 h-4" /> Histórico
            </button>
          </div>
        </div>

        <div className={`flex-1 flex flex-col bg-background min-h-0 ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
        
          {activeTab === 'details' && (
            <div className="flex flex-col md:flex-row px-6 md:px-10 py-8 gap-10 animate-in fade-in duration-300">
              <div className="flex-1 min-w-0 space-y-10">

                {(cardMembers.length > 0 || tags.length > 0 || dueDate || priority) && (
                  <div className="flex flex-wrap gap-6 p-6 bg-muted/20 border border-border/30 rounded-3xl shadow-sm">
                    {cardMembers.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Equipa</h4>
                        <div className="flex -space-x-2">
                          {cardMembers.map((m: any) => (
                            <div key={m.id} className="group relative" title={m.name}>
                              <div className="w-10 h-10 rounded-full bg-primary border-2 border-background flex items-center justify-center text-sm font-extrabold text-primary-foreground shadow-sm transition-transform hover:scale-110 cursor-pointer">
                                {m.name.substring(0, 2).toUpperCase()}
                              </div>
                              {!readOnly && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleRemoveTechnician(m.id, m.name); }} 
                                  className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 bg-destructive text-white rounded-full p-0.5 shadow-md transition-opacity z-10"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tags.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Etiquetas</h4>
                        <div className="flex flex-wrap gap-2">
                          {tags.map((label) => {
                            const colorInfo = LABEL_COLORS[label.color || 'blue'];
                            return <span key={label.id} className="px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm" style={{ backgroundColor: colorInfo?.bg, color: colorInfo?.text }}>{label.name || label.color}</span>;
                          })}
                        </div>
                      </div>
                    )}
                    {priority && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prioridade</h4>
                        <span className="inline-flex px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ backgroundColor: PRIORITIES.find(p => p.value === priority)?.color }}>{PRIORITIES.find(p => p.value === priority)?.label}</span>
                      </div>
                    )}
                    {dueDate && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prazo Limite</h4>
                        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm ${new Date(dueDate) < new Date() ? "bg-destructive text-destructive-foreground" : "bg-background text-foreground border border-border/50"}`}>
                          <Clock className="w-3.5 h-3.5" /> {new Date(dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) }
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AlignLeft className="w-5 h-5 text-muted-foreground" />
                    <h4 className="text-xl font-extrabold text-foreground tracking-tight">Descrição</h4>
                  </div>
                  {isEditingDesc && !readOnly ? (
                    <div className="md:pl-7">
                      <textarea ref={descRef} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-5 rounded-3xl border border-border/50 bg-muted/20 shadow-inner text-[15px] font-medium resize-none outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all min-h-[140px] leading-relaxed" placeholder="Adicione todos os detalhes da viagem..." />
                      <div className="flex items-center gap-2 mt-4">
                        <Button onClick={() => { setIsEditingDesc(false); triggerAutoSave(); }} className="px-6 rounded-full font-bold shadow-md">Guardar Detalhes</Button>
                        <Button variant="ghost" onClick={() => { setDescription(editingCard?.description || ""); setIsEditingDesc(false); }} className="rounded-full font-bold hover:bg-muted">Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={`md:pl-7 py-1 transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer group'}`} onClick={() => !readOnly && setIsEditingDesc(true)}>
                      {description ? ( <p className={`text-[15px] font-medium leading-relaxed whitespace-pre-wrap transition-colors ${readOnly ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}> {description} </p> ) : ( !readOnly ? ( <div className="p-6 rounded-3xl bg-muted/20 border-2 border-dashed border-border/40 text-center text-[15px] font-bold text-muted-foreground group-hover:bg-muted/40 transition-colors"> Tocar para adicionar uma descrição... </div> ) : ( <p className="text-[15px] font-medium text-muted-foreground italic">Sem descrição.</p> ) )}
                    </div>
                  )}
                </div>

                {checklists.map((checklist) => {
                  const total = checklist.items.length;
                  const completed = checklist.items.filter((i) => i.completed).length;
                  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const cTitle = (checklist as any).title || "Lista de Tarefas";
                  const isExpanded = expandedGroups[checklist.id];

                  return (
                    <div key={checklist.id} className="pt-8 border-t border-border/30">
                      <div className="flex items-center gap-3 mb-5">
                        <CheckSquare className="w-6 h-6 text-primary shrink-0" />
                        {editingChecklistTitle === checklist.id && !readOnly ? (
                          <input value={editingChecklistTitleValue} onChange={(e) => setEditingChecklistTitleValue(e.target.value)} onBlur={() => updateChecklistTitle(checklist.id, editingChecklistTitleValue || cTitle)} onKeyDown={(e) => { if (e.key === "Enter") updateChecklistTitle(checklist.id, editingChecklistTitleValue || cTitle); if (e.key === "Escape") setEditingChecklistTitle(null); }} className="flex-1 text-xl font-extrabold text-foreground bg-transparent border-b-2 border-primary outline-none" autoFocus />
                        ) : (
                          <div className={`flex-1 flex flex-wrap items-center gap-2 ${readOnly ? '' : 'cursor-pointer group/title'}`} onClick={() => { if(!readOnly) { setEditingChecklistTitle(checklist.id); setEditingChecklistTitleValue(cTitle); } }}>
                            <h4 className={`text-xl font-extrabold text-foreground tracking-tight ${readOnly ? '' : 'group-hover:opacity-80 transition-opacity'}`}>{cTitle}</h4>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                           <Button variant="ghost" size="icon" onClick={() => toggleChecklistExpansion(checklist.id)} className="text-muted-foreground hover:bg-muted rounded-full"> {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />} </Button>
                           {!readOnly && ( <Button variant="ghost" size="icon" onClick={() => deleteChecklist(checklist.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" title="Excluir lista"> <Trash2 className="w-5 h-5" /> </Button> )}
                        </div>
                      </div>
                      
                      <div className="md:pl-9 mb-6 flex items-center gap-4">
                        <span className="text-sm font-black text-muted-foreground w-10">{percent}%</span>
                        <div className="flex-1 h-3 bg-muted/60 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full transition-all duration-500 shadow-sm ${percent === 100 ? "bg-[#00A868]" : "bg-primary"}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>

                      {isExpanded && (
                         <DragDropContext onDragEnd={(r) => onChecklistItemDragEnd(checklist.id, r)}>
                           <Droppable droppableId={`checklist-items-${checklist.id}`} isDropDisabled={readOnly}>
                             {(provided) => (
                               <div className="md:pl-9 flex flex-col gap-2.5" ref={provided.innerRef} {...provided.droppableProps}>
                                 {checklist.items.map((item, idx) => {
                                   const canToggle = !readOnly || isTecnico;

                                   return (
                                   <Draggable key={item.id} draggableId={`item-${item.id}`} index={idx} isDragDisabled={readOnly}>
                                     {(dragProvided, dragSnapshot) => (
                                       <div 
                                         ref={dragProvided.innerRef} 
                                         {...dragProvided.draggableProps} 
                                         style={{...dragProvided.draggableProps.style, margin: 0}}
                                         className={`flex items-center gap-4 group/item py-3 px-5 rounded-3xl transition-all border ${dragSnapshot.isDragging ? "bg-background border-primary/50 shadow-xl z-50 ring-2 ring-primary/20 scale-105" : "bg-muted/20 border-border/30 hover:border-primary/30 hover:bg-background hover:shadow-sm"}`}
                                       >
                                         <span {...dragProvided.dragHandleProps} className={`opacity-0 ${!readOnly && 'group-hover/item:opacity-100'} cursor-grab active:cursor-grabbing text-muted-foreground shrink-0`}> <GripVertical className="w-5 h-5" /> </span>
                                         <button onClick={() => canToggle && handleToggleChecklistItem(checklist.id, item.id)} className={`shrink-0 transition-transform active:scale-90 ${canToggle ? 'cursor-pointer' : 'cursor-default opacity-70'}`}>
                                           {item.completed ? ( <div className="w-6 h-6 rounded-full bg-[#00A868] flex items-center justify-center shadow-sm"> <Check className="w-4 h-4 text-white" /> </div> ) : ( <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/50 bg-transparent transition-colors hover:border-primary shadow-sm" /> )}
                                         </button>
                                         {editingItem?.groupId === checklist.id && editingItem?.itemId === item.id && !readOnly ? (
                                           <input value={editingItemValue} onChange={(e) => setEditingItemValue(e.target.value)} onBlur={() => saveEditingItem(checklist.id, item.id)} onKeyDown={(e) => { if (e.key === "Enter") saveEditingItem(checklist.id, item.id); if (e.key === "Escape") setEditingItem(null); }} className="flex-1 px-4 py-2 rounded-2xl border border-primary bg-background text-[15px] font-bold outline-none shadow-sm" autoFocus />
                                         ) : (
                                           <span className={`flex-1 text-[15px] font-bold select-none transition-colors ${item.completed ? "line-through text-muted-foreground/50" : "text-foreground"} ${readOnly ? '' : 'cursor-text'}`} onDoubleClick={() => { if(!readOnly){ setEditingItem({ groupId: checklist.id, itemId: item.id }); setEditingItemValue(item.text); } }}> {item.text} </span>
                                         )}
                                         {!readOnly && ( <button onClick={() => deleteChecklistItem(checklist.id, item.id)} className="opacity-0 group-hover/item:opacity-100 p-2 rounded-full hover:bg-destructive/10 transition-colors shrink-0"> <X className="w-4 h-4 text-muted-foreground hover:text-destructive" /> </button> )}
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
                          <div className="md:pl-9 mt-4">
                            <input value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addChecklistItem(checklist.id); if (e.key === "Escape") { setAddingItemForChecklist(null); setNewItemText(""); } }} placeholder="Escreva a nova tarefa e prima Enter..." className="w-full px-5 py-4 rounded-3xl border border-input bg-muted/10 shadow-sm text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-all" autoFocus />
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={() => addChecklistItem(checklist.id)} className="rounded-full font-bold px-6 h-10">Guardar Tarefa</Button>
                              <Button size="sm" variant="ghost" onClick={() => { setAddingItemForChecklist(null); setNewItemText(""); }} className="rounded-full h-10 px-6 font-bold hover:bg-muted">Cancelar</Button>
                            </div>
                          </div>
                        ) : ( <button onClick={() => setAddingItemForChecklist(checklist.id)} className="md:ml-9 mt-4 px-6 py-3.5 rounded-full bg-muted/30 border border-dashed border-border/50 hover:border-primary hover:bg-primary/5 text-[15px] font-extrabold text-muted-foreground hover:text-primary transition-all shadow-sm"> + Nova Tarefa </button> )
                      )}
                    </div>
                  );
                })}

                {attachments && attachments.length > 0 && (
                  <div className="pt-8 border-t border-border/30">
                    <div className="flex items-center gap-2 mb-5">
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                      <h4 className="text-xl font-extrabold text-foreground tracking-tight">Anexos</h4>
                    </div>
                    <div className="md:pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {attachments.map((att) => (
                        <div key={att.id} className="flex items-center gap-4 p-4 rounded-3xl border border-border/50 bg-muted/10 hover:bg-background hover:border-primary/30 group/att transition-all cursor-pointer shadow-sm hover:shadow-md">
                          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-[11px] font-black text-primary uppercase shadow-inner"> {att.name.split(".").pop()?.substring(0,4) || 'ARQ'} </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-bold text-foreground truncate">{att.name}</p>
                            <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-widest mt-1">{new Date(att.addedAt).toLocaleDateString("pt-BR")}</p>
                          </div>
                          {!readOnly && ( <button onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }} className="opacity-0 group-hover/att:opacity-100 p-2.5 rounded-full hover:bg-destructive/10 transition-colors"> <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" /> </button> )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!readOnly && (
                <div className="w-full md:w-64 space-y-3 flex-shrink-0 mt-6 md:mt-0 relative md:sticky md:top-6 self-start pb-8">
                    <h4 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-4 pl-2 hidden md:block">Ferramentas</h4>
                    {[
                      { id: "assign", icon: Users, label: "Membros" },
                      { id: "priority", icon: AlertCircle, label: "Prioridade" },
                      { id: "labels", icon: Tag, label: "Etiquetas" },
                      { id: "checklist", icon: CheckSquare, label: "Checklist" },
                      { id: "date", icon: Clock, label: "Data Limite" },
                      { id: "attachment", icon: Paperclip, label: "Anexo" },
                      { id: "cover", icon: Image, label: "Capa" }
                    ].map((btn) => (
                      <div key={btn.id} className="relative">
                        <button onClick={() => setActivePopover(activePopover === btn.id ? null : btn.id as PopoverType)} className="flex items-center gap-4 w-full px-5 py-3.5 rounded-full bg-muted/30 border border-transparent hover:border-border hover:bg-muted text-[15px] font-extrabold text-foreground transition-all">
                          <btn.icon className="w-4 h-4 text-muted-foreground" /> {btn.label}
                        </button>
                        {activePopover === btn.id && (
                          <div ref={popoverRef} className="absolute right-0 md:right-full md:mr-4 top-0 md:top-auto w-[320px] bg-background border border-border/50 rounded-[2rem] shadow-2xl z-[100] p-6 animate-in zoom-in-95 fade-in duration-200">
                            <div className="flex items-center justify-between mb-5">
                              <h5 className="text-[15px] font-extrabold text-foreground">{btn.label}</h5>
                              <button onClick={() => setActivePopover(null)} className="p-2 rounded-full hover:bg-muted transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
                            </div>

                            {btn.id === "assign" && (
                              <div className="space-y-5">
                                {cardMembers.length > 0 && (
                                  <div className="space-y-3">
                                    <h6 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Na Viagem</h6>
                                    {cardMembers.map((m: any) => (
                                      <div key={m.id} className="flex items-center justify-between bg-muted/30 px-4 py-3 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm">
                                            {m.name.substring(0, 2).toUpperCase()}
                                          </div>
                                          <span className="text-[15px] font-bold text-foreground">{m.name.split(' ')[0]}</span>
                                        </div>
                                        {!readOnly && ( <button onClick={() => handleRemoveTechnician(m.id, m.name)} className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-colors"> <X className="w-4 h-4" /> </button> )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!readOnly && (
                                  <div className="space-y-3 pt-4 border-t border-border/50">
                                    <h6 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Adicionar</h6>
                                    <select value={assignTechId} onChange={(e) => setAssignTechId(e.target.value)} className="w-full px-4 py-3.5 rounded-2xl border border-input bg-muted/20 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer">
                                      <option value="" disabled>Selecione alguém...</option>
                                      {availableTravelers.length === 0 && <option value="" disabled>Todos adicionados!</option>}
                                      {availableTravelers.map(t => <option key={t.id} value={t.id}>{t.name || t.email}</option>)}
                                    </select>
                                    <Button onClick={handleAssignTechnician} disabled={!assignTechId} className="w-full rounded-full h-12 font-bold shadow-md"> Adicionar à Viagem </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {btn.id === "priority" && ( <div className="space-y-2"> {PRIORITIES.map(p => ( <button key={p.value} onClick={() => { setPriority(p.value); triggerAutoSave({ priority: p.value }); setActivePopover(null); }} className="flex items-center w-full p-4 rounded-2xl hover:bg-muted text-[15px] font-bold transition-colors"> <span className="w-3.5 h-3.5 rounded-full mr-4 shadow-sm" style={{ backgroundColor: p.color }} /> <span className="flex-1 text-left text-foreground">{p.label}</span> {priority === p.value && <Check className="w-4 h-4 text-primary" />} </button> ))} </div> )}
                            {btn.id === "labels" && ( <div className="space-y-2"> {Object.entries(LABEL_COLORS).map(([key, val]) => ( <div key={key} className="flex items-center gap-2"> <button onClick={() => toggleLabel(key)} className="flex-1 flex items-center h-12 rounded-2xl px-5 shadow-sm border border-transparent hover:opacity-90 transition-opacity" style={{ backgroundColor: val.bg }}> {editingLabelKey === key ? ( <input value={labelNames[key]} onChange={(e) => setLabelNames((prev) => ({ ...prev, [key]: e.target.value }))} onBlur={() => saveLabelName(key)} onKeyDown={(e) => { if (e.key === "Enter") saveLabelName(key); e.stopPropagation(); }} onClick={(e) => e.stopPropagation()} className="flex-1 bg-transparent outline-none text-[15px] font-bold w-full" style={{ color: val.text }} autoFocus /> ) : ( <span className="text-[15px] font-bold" style={{ color: val.text }}>{labelNames[key] || "Nova Etiqueta"}</span> )} {tags.some((l) => l.color === key) && <Check className="w-4 h-4 ml-auto shrink-0" style={{ color: val.text }} />} </button> <button onClick={(e) => { e.stopPropagation(); setEditingLabelKey(editingLabelKey === key ? null : key); }} className="p-3.5 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"> <Pencil className="w-4 h-4 text-muted-foreground" /> </button> </div> ))} </div> )}
                            {btn.id === "checklist" && ( <div className="space-y-4"> <div className="space-y-2"> <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Nome da Lista</label> <input value={newChecklistTitle} onChange={(e) => setNewChecklistTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChecklistGroup()} placeholder="Ex: Tarefas do Dia..." className="w-full px-5 py-3.5 rounded-2xl border border-input bg-muted/20 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" autoFocus /> </div> <Button onClick={addChecklistGroup} disabled={!newChecklistTitle.trim()} className="w-full rounded-full h-12 font-bold shadow-md"> Criar Lista </Button> </div> )}
                            {btn.id === "date" && ( <div className="space-y-4"> <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-5 py-3.5 rounded-2xl border border-input bg-muted/20 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" /> <div className="flex gap-2"> <Button onClick={() => { triggerAutoSave({ dueDate }); setActivePopover(null); }} className="flex-1 rounded-full h-12 font-bold">Guardar</Button> {dueDate && <Button variant="ghost" onClick={() => { setDueDate(""); triggerAutoSave({ dueDate: "" }); setActivePopover(null); }} className="rounded-full h-12 font-bold text-destructive hover:bg-destructive/10">Remover</Button>} </div> </div> )}
                            {btn.id === "attachment" && ( <div className="space-y-4"> <input value={newAttachmentName} onChange={(e) => setNewAttachmentName(e.target.value)} placeholder="Nome do documento..." className="w-full px-5 py-3.5 rounded-2xl border border-input bg-muted/20 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" autoFocus /> <input value={newAttachmentUrl} onChange={(e) => setNewAttachmentUrl(e.target.value)} placeholder="Link URL (Opcional)" className="w-full px-5 py-3.5 rounded-2xl border border-input bg-muted/20 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" autoFocus /> <Button onClick={addAttachment} className="w-full rounded-full h-12 font-bold shadow-md"> Anexar Documento </Button> </div> )}
                            {btn.id === "cover" && ( <div className="space-y-5"> <div> <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 pl-1">Cores</p> <div className="grid grid-cols-4 gap-2.5"> {COVER_COLORS.map((color) => ( <button key={color} onClick={() => { setCoverUrl(color); triggerAutoSave({ coverUrl: color }); setActivePopover(null); }} className={`h-12 rounded-2xl transition-transform hover:scale-105 shadow-sm border border-transparent ${coverUrl === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} style={{ backgroundColor: color }} /> ))} </div> </div> <div> <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 pl-1">Link de Imagem</p> <input value={coverUrl.startsWith('#') ? '' : coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-3 rounded-2xl border border-input bg-muted/20 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" /> </div> <div className="flex gap-2"> <Button onClick={() => { triggerAutoSave({ coverUrl }); setActivePopover(null); }} className="flex-1 rounded-full h-12 font-bold">Aplicar Capa</Button> {coverUrl && <Button variant="ghost" onClick={() => { setCoverUrl(''); triggerAutoSave({ coverUrl: '' }); setActivePopover(null); }} className="rounded-full h-12 font-bold text-destructive hover:bg-destructive/10">Remover</Button>} </div> </div> )}
                          </div>
                        )}
                      </div>
                    ))}
                    {editingCard && ( <div className="pt-8 mt-2 border-t border-border/30 space-y-2"> <button onClick={handleArchive} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-muted/30 border border-transparent hover:bg-muted text-[13px] font-extrabold text-foreground transition-all"> <Archive className="w-4 h-4 text-muted-foreground" /> Arquivar </button> <button onClick={handleDelete} className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-destructive/5 border border-transparent hover:bg-destructive/10 text-[13px] font-extrabold text-destructive transition-all"> <Trash2 className="w-4 h-4" /> Eliminar Viagem </button> </div> )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'time' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-10">
              <div className="space-y-10 max-w-4xl mx-auto pb-10">
                
                <div className="p-8 rounded-[2rem] bg-muted/20 border border-border/30 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner transition-colors duration-500 ${openLog ? 'bg-[#00A868] text-white' : 'bg-muted border border-border text-muted-foreground'}`}>
                      <Timer className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-foreground tracking-tight">Registo de Turno</h4>
                      <p className="text-[15px] text-muted-foreground font-medium mt-2 max-w-md">
                        {openLog ? 'O seu turno está a ser contabilizado. Lembre-se de fechar ao finalizar.' : 'Pressione o botão para dar início ao seu tempo de viagem e registar o GPS.'}
                      </p>
                    </div>
                  </div>
                  
                  {openLog ? (
                    <Button onClick={() => requestLocationAndClock('out')} className="rounded-full shadow-lg h-14 px-10 flex items-center gap-3 text-[15px] font-black w-full md:w-auto bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80 transition-all hover:scale-105 active:scale-95">
                      <MapPin className="w-5 h-5" /> Fechar Turno
                    </Button>
                  ) : (
                    <Button onClick={() => requestLocationAndClock('in')} className="rounded-full shadow-lg h-14 px-10 flex items-center gap-3 text-[15px] font-black w-full md:w-auto bg-[#00A868] text-white hover:bg-[#00A868]/90 transition-all hover:scale-105 active:scale-95">
                      <MapPin className="w-5 h-5" /> Iniciar Turno
                    </Button>
                  )}
                </div>

                {openLog && openLog.check_in_lat && openLog.check_in_lng && (
                  <div className="rounded-[2rem] overflow-hidden shadow-lg border border-border/40 bg-background animate-in slide-in-from-bottom-8 fade-in duration-500">
                    <div className="w-full h-72 bg-muted relative">
                      <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        scrolling="no"
                        marginHeight={0}
                        marginWidth={0}
                        src={`https://maps.google.com/maps?q=${openLog.check_in_lat},${openLog.check_in_lng}&hl=pt-BR&z=16&output=embed`}
                        style={{ border: 0 }}
                      ></iframe>
                      
                      <a 
                        href={`https://maps.google.com/maps?q=${openLog.check_in_lat},${openLog.check_in_lng}`} 
                        target="_blank" rel="noopener noreferrer"
                        className="absolute bottom-5 right-5 bg-background/95 backdrop-blur-xl px-5 py-3 rounded-full shadow-xl border border-border/20 flex items-center gap-2 text-[13px] font-black text-foreground hover:bg-background transition-all hover:scale-105 active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4 text-primary" /> Ver no Maps
                      </a>

                      <div className="absolute top-5 left-5 bg-background/95 backdrop-blur-xl px-4 py-2 rounded-full shadow-md border border-border/20 flex items-center gap-2">
                         <div className="w-2.5 h-2.5 rounded-full bg-[#00A868] shadow-[0_0_8px_rgba(0,168,104,0.8)] animate-pulse" />
                         <span className="text-[11px] font-black uppercase tracking-widest text-foreground">Sinal de GPS Ativo</span>
                      </div>
                    </div>
                    
                    <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-8 bg-muted/10 border-t border-border/40">
                       <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Técnico</p>
                          <div className="text-[15px] font-bold text-foreground flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shadow-sm">{profile?.name?.substring(0,2).toUpperCase()}</div>
                              {profile?.name || 'Utilizador'}
                          </div>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Entrada</p>
                          <p className="text-[15px] font-bold text-foreground flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary"/> {new Date(openLog.check_in).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Cidade/Região</p>
                          <p className="text-[15px] font-bold text-foreground flex items-center gap-1.5 truncate" title={`${locationAddress?.city}, ${locationAddress?.state}`}><Map className="w-4 h-4 text-primary shrink-0"/> {locationAddress?.city || 'A procurar...'}, {locationAddress?.state || '-'}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">CEP</p>
                          <p className="text-[15px] font-bold text-foreground">{locationAddress?.postcode || 'A procurar...'}</p>
                       </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <h4 className="text-lg font-black text-foreground flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" /> Histórico Recente
                  </h4>
                  
                  {timeLogs.length > 0 ? (
                    <div className="border border-border/40 rounded-[2rem] shadow-sm bg-background w-full overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left min-w-[300px]">
                          <thead className="bg-muted/30 text-muted-foreground border-b border-border/40">
                            <tr>
                              <th className="px-6 md:px-8 py-5 font-black uppercase text-[10px] tracking-widest">Membro</th>
                              <th className="px-6 md:px-8 py-5 font-black uppercase text-[10px] tracking-widest hidden sm:table-cell">Registo Entrada</th>
                              <th className="px-6 md:px-8 py-5 font-black uppercase text-[10px] tracking-widest hidden sm:table-cell">Registo Saída</th>
                              <th className="px-6 md:px-8 py-5 font-black uppercase text-[10px] tracking-widest text-right">Tempo Gasto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {timeLogs.slice().reverse().map((log: any) => {
                              const u = travelers.find(t => t.id === log.user_id);
                              const isExpanded = expandedLogId === log.id;
                              
                              return (
                                <Fragment key={log.id}>
                                  <tr 
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)} 
                                    className={`transition-colors cursor-pointer ${isExpanded ? 'bg-muted/10' : 'hover:bg-muted/5'}`}
                                  >
                                    <td className="px-6 md:px-8 py-5 font-bold text-foreground flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-extrabold shadow-inner shrink-0">
                                        {u?.name?.substring(0, 2).toUpperCase() || 'U'}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="text-[15px] truncate block">{u?.name || 'Usuário'}</span>
                                        {log.check_in_lat && (
                                          <div className="text-[11px] text-muted-foreground font-bold flex items-center gap-1 mt-1">
                                            <MapPin className="w-3.5 h-3.5 text-[#00A868]" /> Mapa Disponível
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 md:px-8 py-5 font-semibold text-muted-foreground hidden sm:table-cell text-[14px]">
                                      {new Date(log.check_in).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-6 md:px-8 py-5 font-semibold text-muted-foreground hidden sm:table-cell text-[14px]">
                                      {log.check_out ? new Date(log.check_out).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : <span className="text-yellow-500 font-bold flex items-center gap-1.5 bg-yellow-500/10 w-max px-3 py-1 rounded-full text-xs"><Timer className="w-3.5 h-3.5"/> Em progresso</span>}
                                    </td>
                                    <td className="px-6 md:px-8 py-5 font-black text-primary text-right text-[15px]">
                                      <div className="flex items-center justify-end gap-3">
                                        {formatDuration(log.check_in, log.check_out)}
                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                      </div>
                                    </td>
                                  </tr>

                                  {isExpanded && (
                                    <tr className="bg-muted/5 border-b border-border/20">
                                      <td colSpan={4} className="p-0">
                                        <div className="p-5 md:p-8 animate-in slide-in-from-top-2">
                                          
                                          <div className="flex sm:hidden justify-between items-center bg-background p-4 rounded-2xl border border-border/30 mb-5 shadow-sm">
                                              <div>
                                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Entrada</p>
                                                  <p className="text-[13px] font-bold text-foreground">{new Date(log.check_in).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center justify-end gap-1"><Clock className="w-3 h-3"/> Saída</p>
                                                  {log.check_out ? (
                                                    <p className="text-[13px] font-bold text-foreground">{new Date(log.check_out).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                  ) : (
                                                    <span className="text-yellow-500 font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider inline-block mt-0.5">Andamento</span>
                                                  )}
                                              </div>
                                          </div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-[#00A868]" /> Local de Entrada
                                              </p>
                                              {log.check_in_lat && log.check_in_lng ? (
                                                <div className="w-full h-48 md:h-56 rounded-[1.5rem] overflow-hidden relative border border-border/30 shadow-inner">
                                                  <iframe width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${log.check_in_lat},${log.check_in_lng}&hl=pt-BR&z=16&output=embed`} style={{ border: 0 }}></iframe>
                                                  <a href={`https://maps.google.com/maps?q=${log.check_in_lat},${log.check_in_lng}`} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:scale-110 transition-transform">
                                                    <ExternalLink className="w-5 h-5 text-primary" />
                                                  </a>
                                                </div>
                                              ) : (
                                                <div className="w-full h-48 md:h-56 rounded-[1.5rem] bg-muted/20 border-2 border-dashed border-border/40 flex flex-col items-center justify-center text-muted-foreground">
                                                  <MapPin className="w-8 h-8 opacity-20 mb-2" />
                                                  <span className="text-sm font-bold">Sem localização registada</span>
                                                </div>
                                              )}
                                            </div>

                                            <div className="space-y-3">
                                              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-destructive" /> Local de Saída
                                              </p>
                                              {log.check_out_lat && log.check_out_lng ? (
                                                <div className="w-full h-48 md:h-56 rounded-[1.5rem] overflow-hidden relative border border-border/30 shadow-inner">
                                                  <iframe width="100%" height="100%" frameBorder="0" src={`https://maps.google.com/maps?q=${log.check_out_lat},${log.check_out_lng}&hl=pt-BR&z=16&output=embed`} style={{ border: 0 }}></iframe>
                                                  <a href={`https://maps.google.com/maps?q=${log.check_out_lat},${log.check_out_lng}`} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-md p-3 rounded-full shadow-lg hover:scale-110 transition-transform">
                                                    <ExternalLink className="w-5 h-5 text-primary" />
                                                  </a>
                                                </div>
                                              ) : (
                                                <div className="w-full h-48 md:h-56 rounded-[1.5rem] bg-muted/20 border-2 border-dashed border-border/40 flex flex-col items-center justify-center text-muted-foreground">
                                                  <MapPin className="w-8 h-8 opacity-20 mb-2" />
                                                  <span className="text-sm font-bold text-center px-4">{log.check_out ? 'Sem localização registada' : 'A aguardar fecho de turno...'}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-muted/20 rounded-[2rem] border border-dashed border-border/50">
                      <Timer className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-[15px] text-muted-foreground font-bold">Nenhum registo de ponto para esta viagem.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ✨ NOVA ABA DE RELATÓRIO (HÍBRIDA MOBILE/DESKTOP) ✨ */}
          {activeTab === 'report' && (
            <div className="flex-1 flex flex-col h-full bg-muted/5 overflow-y-auto p-4 md:p-10">
              
              {/* ✨ ECRÃ MOBILE: MOSTRA SÓ OS CAMPOS E O BOTÃO DE VISUALIZAR ✨ */}
              {!showMobilePreview && (
                <div className="flex flex-col md:hidden space-y-6 pb-8">
                  <div>
                    <h3 className="text-xl font-black text-foreground">Gerar Relatório</h3>
                    <p className="text-[13px] text-muted-foreground mt-1 font-medium">Preencha os dados do cliente para gerar o documento formal.</p>
                  </div>
                  
                  <div className="space-y-4 bg-background p-5 rounded-[2rem] border border-border/50 shadow-sm">
                    <div>
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Cliente / Contato</label>
                      <input value={reportClientName} onChange={e=>setReportClientName(e.target.value)} className="w-full mt-1 px-4 py-3 rounded-xl border border-input bg-muted/10 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Ex: João Silva" />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Empresa / Obra</label>
                      <input value={reportCompany} onChange={e=>setReportCompany(e.target.value)} className="w-full mt-1 px-4 py-3 rounded-xl border border-input bg-muted/10 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Ex: Edifício Central" />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Observações do Serviço</label>
                      <textarea value={reportObservations} onChange={e=>setReportObservations(e.target.value)} rows={4} className="w-full mt-1 px-4 py-3 rounded-xl border border-input bg-muted/10 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary resize-none transition-all custom-scrollbar" placeholder="Detalhes técnicos, peças utilizadas..." />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button onClick={() => setShowMobilePreview(true)} variant="outline" className="w-full rounded-xl h-14 font-black flex items-center justify-center gap-2 text-[14px]">
                      <Eye className="w-4 h-4" /> Visualizar
                    </Button>
                    <Button onClick={handlePrintReport} className="w-full rounded-xl h-14 font-black shadow-lg flex items-center justify-center gap-2 text-[14px]">
                      <Printer className="w-4 h-4" /> Imprimir
                    </Button>
                  </div>
                </div>
              )}

              {/* ✨ ECRÃ PC OU MODO PREVIEW NO MOBILE ✨ */}
              <div className={`flex-col md:flex-row gap-8 h-full ${!showMobilePreview ? 'hidden md:flex' : 'flex'}`}>
                
                {/* Lado Esquerdo (Fixo no PC, Oculto no Preview Mobile) */}
                <div className="hidden md:flex md:w-1/3 lg:w-[320px] flex-col space-y-6 shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-foreground">Configurar Relatório</h3>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">Preencha os dados abaixo para gerar o documento formal de serviço.</p>
                  </div>
                  
                  <div className="space-y-5 bg-background p-6 rounded-[2rem] border border-border/50 shadow-sm">
                    <div>
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Cliente / Contato</label>
                      <input value={reportClientName} onChange={e=>setReportClientName(e.target.value)} className="w-full mt-2 px-5 py-4 rounded-2xl border border-input bg-muted/10 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Ex: João Silva" />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Empresa / Obra</label>
                      <input value={reportCompany} onChange={e=>setReportCompany(e.target.value)} className="w-full mt-2 px-5 py-4 rounded-2xl border border-input bg-muted/10 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Ex: Edifício Central" />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Observações do Serviço</label>
                      <textarea value={reportObservations} onChange={e=>setReportObservations(e.target.value)} rows={5} className="w-full mt-2 px-5 py-4 rounded-2xl border border-input bg-muted/10 text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary resize-none transition-all custom-scrollbar" placeholder="Detalhes técnicos, peças utilizadas, estado do local..." />
                    </div>
                  </div>

                  <Button onClick={handlePrintReport} className="w-full rounded-full h-14 font-black shadow-lg flex items-center justify-center gap-3 text-[15px] hover:scale-105 active:scale-95 transition-all">
                    <Printer className="w-5 h-5" /> Imprimir Relatório
                  </Button>
                </div>

                {/* Área do Papel A4 */}
                <div className="flex-1 bg-muted/20 md:border md:border-border/40 shadow-inner md:rounded-[2rem] overflow-y-auto flex flex-col justify-start items-center custom-scrollbar relative p-0 md:p-10 -mx-4 md:mx-0">
                  
                  {/* Botões do Topo (Só aparecem no Mobile Preview) */}
                  {showMobilePreview && (
                    <div className="w-full flex justify-between items-center mb-4 md:hidden sticky top-0 bg-background/90 backdrop-blur-xl z-20 py-3 px-4 border-b border-border/30 shadow-sm">
                      <button onClick={() => setShowMobilePreview(false)} className="flex items-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="w-5 h-5" /> Voltar
                      </button>
                      <Button onClick={handlePrintReport} size="sm" className="rounded-full font-black text-[12px] h-9 px-4">
                        <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
                      </Button>
                    </div>
                  )}

                  {/* O Papel A4 Responsivo (Escala automaticamente no Mobile) */}
                  <div className="w-full overflow-x-auto pb-6 px-4 md:px-0 flex justify-center custom-scrollbar">
                    <div id="printable-report" className="bg-white text-black p-8 md:p-14 w-full max-w-[21cm] min-h-[29.7cm] shadow-2xl relative shrink-0">
                      
                      {/* Cabeçalho */}
                      <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                        <img src={`${window.location.origin}/logo-royale.png`} alt="Royale" className="h-12 md:h-16 object-contain" />
                        <div className="text-right">
                          <h1 className="text-lg md:text-2xl font-black uppercase tracking-wider m-0">Relatório de Serviço</h1>
                          <p className="text-xs md:text-sm font-medium text-gray-600 mt-1"><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs md:text-sm font-medium text-gray-600"><strong>Ref:</strong> {title}</p>
                        </div>
                      </div>

                      {/* Dados do Cliente */}
                      <div className="mb-8">
                        <h2 className="text-[11px] md:text-[13px] font-black uppercase tracking-widest border-b-2 border-gray-100 pb-2 mb-4 text-gray-800">Dados do Cliente</h2>
                        <p className="text-xs md:text-sm mb-2"><strong className="text-black">Cliente / Contato:</strong> {reportClientName || '________________________________________'}</p>
                        <p className="text-xs md:text-sm mb-2"><strong className="text-black">Empresa / Obra:</strong> {reportCompany || '________________________________________'}</p>
                        <p className="text-xs md:text-sm"><strong className="text-black">Técnico Responsável:</strong> {profile?.name || 'Equipa Técnica'}</p>
                      </div>

                      {/* Checklist */}
                      <div className="mb-8">
                        <h2 className="text-[11px] md:text-[13px] font-black uppercase tracking-widest border-b-2 border-gray-100 pb-2 mb-4 text-gray-800">Tarefas Registadas</h2>
                        {checklists.length > 0 ? (
                          <table className="w-full border-collapse border border-gray-300 text-xs md:text-sm">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 p-2 md:p-3 text-left font-black uppercase tracking-wider text-[9px] md:text-[11px]">Grupo / Categoria</th>
                                <th className="border border-gray-300 p-2 md:p-3 text-left font-black uppercase tracking-wider text-[9px] md:text-[11px]">Descrição da Tarefa</th>
                                <th className="border border-gray-300 p-2 md:p-3 text-left font-black uppercase tracking-wider text-[9px] md:text-[11px] w-24 md:w-32">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checklists.map(group => (
                                group.items.map(item => (
                                  <tr key={item.id} className="border-b border-gray-200">
                                    <td className="border border-gray-300 p-2 md:p-3 font-medium text-gray-700">{(group as any).title || 'Lista de Tarefas'}</td>
                                    <td className="border border-gray-300 p-2 md:p-3 font-semibold text-black">{item.text}</td>
                                    <td className={`border border-gray-300 p-2 md:p-3 font-bold ${item.completed ? 'text-[#00A868]' : 'text-red-500'}`}>
                                      {item.completed ? '✔ Concluído' : '✗ Pendente'}
                                    </td>
                                  </tr>
                                ))
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-xs md:text-sm text-gray-500 italic">Nenhuma tarefa associada a este serviço.</p>
                        )}
                      </div>

                      {/* Observações */}
                      <div className="mb-10">
                        <h2 className="text-[11px] md:text-[13px] font-black uppercase tracking-widest border-b-2 border-gray-100 pb-2 mb-4 text-gray-800">Observações e Notas Técnicas</h2>
                        <div className="border border-dashed border-gray-400 p-4 md:p-5 rounded-xl min-h-[100px] md:min-h-[120px] bg-gray-50 text-xs md:text-sm text-gray-800 whitespace-pre-wrap">
                          {reportObservations || 'Nenhuma observação registada pelo técnico.'}
                        </div>
                      </div>

                      {/* Assinaturas */}
                      <div className="mt-16 md:mt-24 flex flex-col md:flex-row justify-between gap-10">
                        <div className="flex-1 border-t border-black pt-3 text-center">
                          <p className="font-bold text-xs md:text-sm text-black uppercase tracking-wider">Assinatura do Técnico</p>
                          <p className="text-[10px] md:text-xs font-medium text-gray-500 mt-1">{profile?.name || 'Técnico Royale'}</p>
                        </div>
                        <div className="flex-1 border-t border-black pt-3 text-center">
                          <p className="font-bold text-xs md:text-sm text-black uppercase tracking-wider">Assinatura do Cliente</p>
                          <p className="text-[10px] md:text-xs font-medium text-gray-500 mt-1">{reportClientName || 'Responsável Local'}</p>
                        </div>
                      </div>
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col md:flex-row min-h-0 border-t border-border/30 bg-background">
              
              <div className={`w-full md:w-[340px] flex-col border-b md:border-b-0 md:border-r border-border/30 bg-muted/10 h-full shrink-0 ${mobileChatView === 'messages' ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-6 border-b border-border/30 shrink-0">
                  <h3 className="text-xl font-black text-foreground tracking-tight">Mensagens</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar min-h-0">
                  
                  <button onClick={() => { setSelectedChatUser('all'); setMobileChatView('messages'); }} className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all ${selectedChatUser === 'all' ? 'bg-background shadow-md border border-border/50' : 'hover:bg-muted/50 border border-transparent'}`}>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                      <Users className="w-5 h-5"/>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[15px] font-extrabold truncate text-foreground">Grupo da Viagem</p>
                        {getUnreadGroupCount() > 0 && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00A868] text-[10px] font-black text-white">{getUnreadGroupCount()}</span>
                        )}
                      </div>
                      <p className="text-[13px] font-medium text-muted-foreground truncate">{getLastGroupMessage()}</p>
                    </div>
                  </button>

                  <div className="pt-4 pb-2 px-4">
                     <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Conversas Diretas</p>
                  </div>

                  {sortedTravelers.map(t => {
                    const unread = getUnreadDirectCount(t.id);
                    return (
                      <button key={t.id} onClick={() => { setSelectedChatUser(t.id); setMobileChatView('messages'); }} className={`w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all ${selectedChatUser === t.id ? 'bg-background shadow-md border border-border/50' : 'hover:bg-muted/50 border border-transparent'}`}>
                        <div className="w-12 h-12 rounded-full bg-muted border border-border/50 flex items-center justify-center text-muted-foreground text-[15px] font-extrabold shrink-0 shadow-inner relative">
                          {t.name?.substring(0,2).toUpperCase() || 'U'}
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00A868] border-[3px] border-background rounded-full"></div>
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[15px] font-extrabold truncate text-foreground">{t.name || t.email}</p>
                            {unread > 0 && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00A868] text-[10px] font-black text-white">{unread}</span>
                            )}
                          </div>
                          <p className="text-[13px] font-medium text-muted-foreground truncate">{getLastMessage(t.id)}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className={`flex-1 flex-col relative bg-muted/5 min-h-0 ${mobileChatView === 'list' ? 'hidden md:flex' : 'flex'}`}>
                <div className="px-5 py-4 border-b border-border/30 bg-background/80 backdrop-blur-xl flex items-center gap-4 shadow-sm z-10 shrink-0">
                  <button onClick={() => setMobileChatView('list')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  {selectedChatUser === 'all' ? (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Users className="w-5 h-5"/></div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[13px] font-extrabold shadow-sm">{travelers.find(t=>t.id===selectedChatUser)?.name?.substring(0,2).toUpperCase()}</div>
                  )}
                  <div>
                    <h4 className="text-[15px] font-black text-foreground">{selectedChatUser === 'all' ? 'Grupo da Viagem' : travelers.find(t=>t.id===selectedChatUser)?.name}</h4>
                    <p className="text-[11px] font-bold text-primary tracking-wide">{selectedChatUser === 'all' ? 'Todos os membros envolvidos' : 'Online'}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-8 flex flex-col-reverse gap-5 custom-scrollbar relative z-10 min-h-0">
                  <div ref={messagesEndRef} />
                  {chatMessages.length > 0 ? [...chatMessages].reverse().map((msg) => {
                    const isMe = msg.authorId === (profile?.id || profileId);
                    return (
                      <div key={msg.id} className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                        {!isMe && <span className="text-[11px] font-black text-muted-foreground ml-4 mb-1.5 drop-shadow-sm tracking-wide">{msg.author.split(' ')[0]}</span>}
                        <div className={`px-5 pt-3.5 pb-2.5 shadow-sm relative group ${isMe ? 'bg-primary text-primary-foreground rounded-[1.5rem] rounded-tr-sm' : 'bg-background text-foreground rounded-[1.5rem] rounded-tl-sm border border-border/30'} ${msg.attachmentUrl && !msg.text ? 'p-2' : ''}`}>
                          
                          {msg.attachmentUrl && (
                            <div className={`rounded-xl overflow-hidden relative ${msg.text ? 'mb-3 border border-black/5' : ''}`}>
                              {msg.attachmentUrl.startsWith('data:image') ? (
                                <img src={msg.attachmentUrl} alt="Anexo" className="w-full max-w-[280px] max-h-[280px] object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => {
                                  const w = window.open();
                                  w?.document.write(`<img src="${msg.attachmentUrl}" style="max-width:100%;" />`);
                                }} />
                              ) : (
                                <a href={msg.attachmentUrl} download={msg.fileName || "anexo"} className="flex items-center gap-3 p-3 bg-black/10 hover:bg-black/20 transition-colors text-sm font-bold min-w-[220px] max-w-[280px]">
                                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Paperclip className="w-5 h-5" /></div>
                                  <span className="truncate flex-1">{msg.fileName || "Baixar Arquivo"}</span>
                                </a>
                              )}
                            </div>
                          )}

                          {msg.text && <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap pr-12">{msg.text}</p>}
                          
                          <div className={`text-[10px] font-black flex items-center justify-end gap-1 opacity-70 ${msg.attachmentUrl && !msg.text ? 'absolute bottom-3 right-3 bg-black/50 text-white px-2 py-1 rounded-full backdrop-blur-md' : 'mt-1 float-right -mb-1 -mr-2'}`}>
                             {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                             {isMe && <Check className={`w-3.5 h-3.5 ${msg.attachmentUrl && !msg.text ? 'text-white' : 'text-primary-foreground'}`} />}
                          </div>
                          {msg.text && <div className="clear-both"></div>}
                        </div>
                      </div>
                    )
                  }) : (
                    <div className="m-auto bg-background/80 backdrop-blur-xl px-8 py-4 rounded-full shadow-sm border border-border/30 z-10 text-center">
                      <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-[13px] font-bold text-muted-foreground">Inicie uma conversa em tempo real.</p>
                    </div>
                  )}
                </div>

                <div className="p-4 md:p-5 bg-background/80 backdrop-blur-xl border-t border-border/30 flex gap-3 items-end z-10 shrink-0 pb-safe">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                  <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors shrink-0 mb-1" title="Anexar Arquivo">
                     <Paperclip className="w-6 h-6" />
                  </button>
                  <textarea 
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }} 
                    placeholder="Escreva uma mensagem..." 
                    className="flex-1 bg-muted/30 border border-transparent focus:border-border/50 rounded-[1.5rem] px-5 py-4 text-[15px] font-medium outline-none focus:ring-2 focus:ring-primary focus:bg-background shadow-inner resize-none min-h-[52px] max-h-[120px] custom-scrollbar text-foreground transition-all" 
                    rows={1}
                  />
                  <button 
                    onClick={handleAddComment} 
                    disabled={!commentText.trim()} 
                    className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg disabled:opacity-40 transition-all hover:scale-105 active:scale-95 shrink-0 mb-1"
                  >
                    <Send className="w-5 h-5 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-muted/5">
              <div className="max-w-3xl mx-auto flex flex-col h-full">
                
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                   <div className="relative flex-1">
                      <Search className="w-5 h-5 absolute left-5 top-4 text-muted-foreground" />
                      <input value={logSearchTerm} onChange={e=>setLogSearchTerm(e.target.value)} placeholder="Procurar histórico..." className="w-full pl-14 pr-5 py-4 bg-background border border-border/50 rounded-full text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all" />
                   </div>
                   <div className="relative">
                      <CalendarDays className="w-5 h-5 absolute left-5 top-4 text-muted-foreground" />
                      <input type="date" value={logDateFilter} onChange={e=>setLogDateFilter(e.target.value)} className="w-full md:w-auto pl-14 pr-5 py-4 bg-background border border-border/50 rounded-full text-[15px] font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all" />
                   </div>
                   {(logSearchTerm || logDateFilter) && (
                     <button onClick={()=>{setLogSearchTerm(''); setLogDateFilter('');}} className="px-6 py-4 text-[13px] font-black text-muted-foreground hover:text-foreground transition-colors bg-muted/50 rounded-full">Limpar</button>
                   )}
                </div>

                <div className="space-y-4">
                  {filteredLogs.length > 0 ? [...filteredLogs].reverse().map((log) => (
                    <div key={log.id} className="flex items-center gap-5 py-4 px-6 rounded-3xl bg-background border border-border/30 shadow-sm hover:shadow-md transition-shadow"> 
                      <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.6)] shrink-0" />
                      <div className="flex-1 min-w-0"> 
                        <p className="text-[15px] font-bold text-foreground truncate">{log.text}</p> 
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mt-1"> {new Date(log.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} </p> 
                      </div> 
                    </div>
                  )) : (
                    <div className="text-center py-20 bg-transparent rounded-3xl border-2 border-dashed border-border/50 mt-4"> 
                      <Info className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" /> 
                      <p className="text-[15px] font-black text-foreground">Sem histórico encontrado.</p> 
                      <p className="text-[13px] font-medium text-muted-foreground mt-2">Nenhuma atividade recente ou verifique os filtros.</p>
                    </div> 
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
