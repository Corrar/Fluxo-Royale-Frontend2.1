// ficheiro: src/utils/generateTravelPDF.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Travel } from '../types/travel';

export const generateTravelPDF = (travel: Travel) => {
  // Cria um novo documento A4
  const doc = new jsPDF();

  // 1. CABEÇALHO DO RELATÓRIO
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // Cor escura (slate-900)
  doc.text('Relatório de Viagem / Serviço Externo', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139); // Cor cinza
  doc.text(`Destino / Tarefa Principal: ${travel.title}`, 14, 32);
  
  doc.setFontSize(10);
  doc.text(`Descrição: ${travel.description || 'Sem descrição'}`, 14, 38);
  doc.text(`Status atual: ${travel.status.replace('_', ' ').toUpperCase()}`, 14, 44);
  doc.text(`Data de Emissão: ${new Date().toLocaleString()}`, 14, 50);

  let finalY = 60; // Posição vertical na página

  // 2. TABELA DE BATE-PONTO
  if (travel.time_logs && travel.time_logs.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('1. Histórico de Ponto', 14, finalY);
    
    const timeLogsData = travel.time_logs.map(log => [
      log.user_id.substring(0, 8) + '...', // Idealmente no futuro puxas o nome do BD
      new Date(log.check_in).toLocaleString(),
      log.check_out ? new Date(log.check_out).toLocaleString() : 'Expediente em andamento'
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['ID do Técnico', 'Entrada (Check-in)', 'Saída (Check-out)']],
      body: timeLogsData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] } // Azul Royale
    });
    
    // Atualiza a posição Y para a próxima secção não ficar por cima
    finalY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 3. TABELA DE CHECKLISTS (Tarefas)
  if (travel.checklists && travel.checklists.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('2. Tarefas / Checklists Realizados', 14, finalY);
    
    const checklistData = travel.checklists.map(item => [
      item.description,
      item.is_completed ? '✅ Concluído' : '❌ Pendente',
      item.completed_at ? new Date(item.completed_at).toLocaleString() : '-'
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Descrição da Tarefa', 'Status', 'Data de Conclusão']],
      body: checklistData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] } // Esmeralda
    });
    
    finalY = (doc as any).lastAutoTable.finalY + 15;
  }

  // 4. OBSERVAÇÕES (Histórico do Chat)
  if (travel.messages && travel.messages.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('3. Observações e Registos (Chat)', 14, finalY);
    
    const chatData = travel.messages.map(msg => [
      new Date(msg.created_at).toLocaleString(),
      msg.message
    ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Data / Hora', 'Observação']],
      body: chatData,
      theme: 'striped',
      headStyles: { fillColor: [234, 179, 8] } // Amarelo Royale
    });
  }

  // 5. SALVAR O DOCUMENTO
  // Ex: "Relatorio_Conserto_no_Cliente_X.pdf"
  const fileName = `Relatorio_${travel.title.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
};
