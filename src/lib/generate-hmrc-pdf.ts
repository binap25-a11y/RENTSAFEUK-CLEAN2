'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * @fileOverview Professional HMRC Self Assessment Briefing Engine
 * Generates an itemized financial audit ledger for professional tax reporting.
 */

interface Transaction {
  date: Date | null;
  category: string;
  description: string;
  amount: number;
  property: string;
}

export const generateHMRCPDF = async (
  year: number,
  landlordName: string,
  totalIncome: number,
  expenses: any[],
  repairs: any[],
  propertyAddress: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- HEADER ---
  doc.setFillColor(33, 114, 249); // Professional Blue
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(255);
  doc.text('HMRC SELF ASSESSMENT BRIEFING', 105, 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text('ITEMIZED PROPERTY RENTAL AUDIT', 105, 30, { align: 'center' });
  doc.text(`REPORTING PERIOD: 01 JAN ${year} - 31 DEC ${year}`, 105, 36, { align: 'center' });

  let finalY = 50;

  // --- IDENTITY & CONTEXT ---
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Landlord Identity:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(landlordName || 'Verified User', 55, finalY);
  finalY += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Registry Asset:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  const splitAddr = doc.splitTextToSize(propertyAddress || 'Entire Portfolio (Consolidated)', 140);
  doc.text(splitAddr, 55, finalY);
  finalY += (splitAddr.length * 7) + 10;

  // --- EXECUTIVE SUMMARY ---
  doc.setFillColor(245, 245, 245);
  doc.rect(14, finalY, 182, 30, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('FINANCIAL POSITION SUMMARY', 105, finalY + 8, { align: 'center' });
  
  const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0) + 
                        repairs.reduce((acc, r) => acc + (Number(r.expectedCost || r.estimatedCost || 0)), 0);
  const netPosition = totalIncome - totalExpenses;

  doc.setFontSize(10);
  doc.text(`Total Rental Income:`, 20, finalY + 18);
  doc.text(`£${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 100, finalY + 18, { align: 'right' });
  
  doc.text(`Total Allowable Expenses:`, 20, finalY + 24);
  doc.text(`£${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 100, finalY + 24, { align: 'right' });

  doc.text(`NET TAXABLE POSITION:`, 120, finalY + 21);
  doc.setFontSize(14);
  doc.setTextColor(netPosition >= 0 ? [33, 114, 249] : [239, 68, 68]);
  doc.text(`£${netPosition.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 21, { align: 'right' });

  doc.setTextColor(0);
  finalY += 40;

  // --- ITEMIZED LEDGER ---
  const allTransactions: any[] = [
    ...expenses.map(e => ({
        date: e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date(e.date),
        type: e.expenseType,
        desc: e.notes || e.expenseType,
        amount: Number(e.amount)
    })),
    ...repairs.map(r => ({
        date: r.reportedDate?.seconds ? new Date(r.reportedDate.seconds * 1000) : new Date(r.reportedDate),
        type: 'Repairs and Maintenance',
        desc: r.title,
        amount: Number(r.expectedCost || r.estimatedCost || 0)
    }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const tableRows = allTransactions.map(t => [
    format(t.date, 'dd/MM/yyyy'),
    t.type,
    t.desc,
    `£${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    startY: finalY,
    head: [['Date', 'Audit Category', 'Description', 'Amount (£)']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [33, 114, 249], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 40 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
    }
  });

  finalY = (doc as any).lastAutoTable.finalY + 15;

  // --- CATEGORY SUMMARY ---
  const categories: Record<string, number> = {};
  allTransactions.forEach(t => { categories[t.type] = (categories[t.type] || 0) + t.amount; });
  
  const categoryRows = Object.entries(categories).map(([name, amount]) => [
    name,
    `£${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
  ]);

  if (finalY > pageHeight - 60) {
      doc.addPage();
      finalY = 20;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AGGREGATED TAX CATEGORIES', 14, finalY);
  finalY += 5;

  autoTable(doc, {
    startY: finalY,
    body: categoryRows,
    theme: 'striped',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } }
  });

  // --- DISCLAIMER ---
  finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(8);
  doc.setTextColor(150);
  const disclaimer = "DISCLAIMER: This briefing is an administrative extract from the RentSafeUK digital registry. It is intended to assist your tax preparation but does not constitute official financial advice. Please verify all figures with a qualified accountant before submitting your HMRC Self Assessment.";
  const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
  doc.text(splitDisclaimer, 14, finalY);

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

  doc.save(`HMRC-Briefing-${year}-${landlordName.replace(/\s+/g, '-')}.pdf`);
  return doc;
};
