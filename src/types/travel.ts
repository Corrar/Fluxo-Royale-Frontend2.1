// ficheiro: src/types/travel.ts

import { Priority, ChecklistGroup, Tag } from './card';

// 1. Interface da Viagem Principal
export interface Travel {
  id: string;
  title: string;
  description?: string;
  status: string; // Agora é string, pois usamos as listas do Kanban (ex: 'list-todo', 'list-doing')
  priority?: Priority; // Adicionado do Kanban
  listId?: string; // Adicionado do Kanban
  imageUrl?: string; // Adicionado do Kanban (Capa)
  cover_url?: string;
  due_date?: string; // Data limite
  dueDate?: Date | string; 
  created_by: string; // ID do Líder
  created_at: string;
  updated_at: string;
  
  // Relações em JSONB carregadas pelo Kanban
  checklists?: ChecklistGroup[] | any[]; // <-- CORREÇÃO PRINCIPAL DO ERRO
  tags?: Tag[] | any[];
  attachments?: any[];
  comments?: any[];

  // Relações antigas carregadas via SQL/Joins
  technicians?: TravelTechnician[];
  messages?: TravelMessage[];
  time_logs?: TravelTimeLog[];
}

// 2. Interface dos Técnicos Atribuídos
export interface TravelTechnician {
  travel_id: string;
  user_id: string; // ID do Técnico
  assigned_at: string;
}

// 3. Interface do Bate-Ponto
export interface TravelTimeLog {
  id: string;
  travel_id: string;
  user_id: string;
  check_in: string; // Hora de entrada
  check_out?: string; // Hora de saída (opcional, pois pode não ter saído ainda)
  created_at: string;
}

// 4. Interface das Tarefas Extra (Checklist Antigo - Mantido por retrocompatibilidade)
export interface TravelChecklist {
  id: string;
  travel_id: string;
  description: string;
  is_completed: boolean; 
  completed_at?: string;
  created_by: string;
  created_at: string;
}

// 5. Interface do Chat / Observações
export interface TravelMessage {
  id: string;
  travel_id: string;
  user_id: string;
  message: string;
  image_url?: string; // Link da imagem, se houver
  created_at: string;
  
  // Temporário para o modo offline (para sabermos se já foi enviado para o servidor)
  is_offline?: boolean; 
}
