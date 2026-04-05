'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * @fileOverview Professional Chat Audit PDF Engine
 * Generates a chronological ledger of messages between management and residents.
 * Explicitly includes the full legal name of the tenant for audit compliance.
 */

interface ChatMessage {
  senderName: string;
  content: string;
  timestamp: any;
  senderId: string;
}

export const generateChatPDF = async (
  messages: ChatMessage[],
  propertyAddress: string,
  tenantName: string,
  landlordName: string,
  currentUserId: string
) => {
  if (!messages || messages.length === 0) return null;

  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- HEADER ---
  doc.setFillColor(167, 209, 171); // Brand Primary: #A7D1AB
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255);
  doc.text('COMMUNICATION AUDIT TRAIL', 105, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.text('OFFICIAL REGISTRY RECORD', 105, 33, { align: 'center' });

  let finalY = 50;

  // --- CONTEXT DETAILS ---
  doc.setTextColor(0);
  doc.setFontSize(12);
  
  // Property Address
  doc.setFont('helvetica', 'bold');
  doc.text('Property Asset:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  const splitAddress = doc.splitTextToSize(propertyAddress, 140);
  doc.text(splitAddress, 55, finalY);
  finalY += (splitAddress.length * 7) + 5;

  // Tenant Full Name (Registry ID)
  doc.setFont('helvetica', 'bold');
  doc.text('Tenant Full Name:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(tenantName, 55, finalY);
  finalY += 7;

  // Landlord/Management Identity
  doc.setFont('helvetica', 'bold');
  doc.text('Management:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(landlordName, 55, finalY);
  finalY += 15;

  // --- MESSAGE TABLE ---
  const tableRows = messages.map((m) => {
    let dateStr = 'N/A';
    try {
      const d = m.timestamp?.seconds ? new Date(m.timestamp.seconds * 1000) : new Date(m.timestamp);
      dateStr = isNaN(d.getTime()) ? 'N/A' : format(d, 'dd/MM/yyyy HH:mm');
    } catch (e) {}

    // Use the name provided in the mapped message object for professional clarity
    const identity = m.senderName;

    return [dateStr, identity, m.content];
  });

  autoTable(doc, {
    startY: finalY,
    head: [['Date/Time', 'Sender Identity', 'Message Content']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [167, 209, 171], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 45, fontStyle: 'bold' },
      2: { cellWidth: 'auto' }
    }
  });

  // --- FOOTER ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `RentSafeUK Portfolio Registry - Page ${i} of ${pageCount} - Generated ${format(new Date(), 'PPpp')}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const safeAddress = propertyAddress.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  doc.save(`Chat-Audit-${safeAddress}-${format(new Date(), 'yyyyMMdd')}.pdf`);
  return doc;
};
