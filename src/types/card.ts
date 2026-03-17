export type CategoryColor = 'blue' | 'green' | 'orange' | 'pink' | 'purple' | 'teal';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

// NOVIDADE: Criamos a estrutura do Grupo de Delegação
export interface ChecklistGroup {
  id: string;
  assignedToId: string;     // ID do técnico (para sabermos de quem é)
  assignedToName: string;   // Nome do técnico (para mostrar no ecrã)
  items: ChecklistItem[];   // A lista de tarefas exclusivas dele
}

// A interface Tag que o Vercel pediu antes
export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface CardData {
  id: string;
  title: string;
  description: string;
  category: CategoryColor;
  priority: Priority;
  
  // Retrocompatibilidade
  checklist?: ChecklistItem[]; 
  
  // Nova estrutura de grupos para a Elétrica
  checklists?: ChecklistGroup[]; 

  // Tags
  tags?: Tag[];
  
  // ---> CORREÇÃO: ADICIONAMOS AS DUAS PROPRIEDADES QUE FALTAVAM AQUI <---
  imageUrl?: string;
  dueDate?: Date | string;
  
  createdAt: Date;
  completed: boolean;
  completedAt?: Date;
}
