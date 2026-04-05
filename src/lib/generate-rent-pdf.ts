'use client';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * @fileOverview Professional Rental Statement PDF Engine
 * Generates a chronological ledger of rent payments for a specific property and year.
 */

interface RentRow {
  month: string;
  year: number;
  rent: number;
  amountPaid: number;
  status: string;
}

export const generateRentPDF = async (
  year: number,
  propertyAddress: string,
  tenantName: string,
  statementData: RentRow[],
  totals: { totalExpected: number; totalCollected: number; remaining: number; rate: number }
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- HEADER ---
  doc.setFillColor(167, 209, 171); // Brand Primary: #A7D1AB
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text('RENTAL STATEMENT', 105, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`REPORTING PERIOD: CALENDAR YEAR ${year}`, 105, 33, { align: 'center' });

  let finalY = 50;

  // --- IDENTITY & CONTEXT ---
  doc.setTextColor(0);
  doc.setFontSize(12);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Property Asset:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  const splitAddr = doc.splitTextToSize(propertyAddress, 140);
  doc.text(splitAddr, 55, finalY);
  finalY += (splitAddr.length * 7) + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Resident:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.text(tenantName || 'N/A', 55, finalY);
  finalY += 15;

  // --- LEDGER TABLE ---
  const tableRows = statementData.map(row => [
    row.month,
    row.year.toString(),
    `£${row.rent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    `£${row.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    row.status
  ]);

  autoTable(doc, {
    startY: finalY,
    head: [['Month', 'Year', 'Rent Due', 'Amount Paid', 'Status']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [167, 209, 171], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'center', fontStyle: 'bold' }
    }
  });

  finalY = (doc as any).lastAutoTable.finalY + 15;

  // --- SUMMARY BOX ---
  if (finalY > pageHeight - 60) {
    doc.addPage();
    finalY = 20;
  }

  doc.setFillColor(245, 245, 245);
  doc.rect(14, finalY, 182, 35, 'F');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('STATEMENT SUMMARY', 105, finalY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text('Total Rent Accrued:', 20, finalY + 18);
  doc.text(`£${totals.totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 100, finalY + 18, { align: 'right' });
  
  doc.text('Total Rent Collected:', 20, finalY + 26);
  doc.setTextColor(34, 197, 94); // Green
  doc.text(`£${totals.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 100, finalY + 26, { align: 'right' });
  
  doc.setTextColor(0);
  doc.text('Outstanding Arrears:', 120, finalY + 18);
  doc.setTextColor(239, 68, 68); // Red
  doc.text(`£${totals.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 190, finalY + 18, { align: 'right' });
  
  doc.setTextColor(0);
  doc.text('Collection Efficiency:', 120, finalY + 26);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totals.rate.toFixed(1)}%`, 190, finalY + 26, { align: 'right' });

  // --- FOOTER ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Official Registry Extract - RentSafeUK Portfolio - Page ${i} of ${pageCount} - Generated ${format(new Date(), 'PPpp')}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  const safeAddress = propertyAddress.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  doc.save(`Rent-Statement-${safeAddress}-${year}.pdf`);
  return doc;
};
