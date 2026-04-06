'use client';

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';

/**
 * @fileOverview Legal Briefing PDF Engine
 * Generates a professional summary of legislative updates for landlords and tenants.
 * Returns the jsPDF instance to allow both saving and base64 extraction.
 */

export const generateLawUpdatePDF = async (title: string, content: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // --- HEADER ---
  doc.setFillColor(167, 209, 171); // Brand Primary: #A7D1AB
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text('LEGISLATIVE BRIEFING', 105, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.text('OFFICIAL PORTFOLIO UPDATE', 105, 33, { align: 'center' });

  let finalY = 55;

  // --- CONTENT ---
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  const splitTitle = doc.splitTextToSize(title, 180);
  doc.text(splitTitle, 14, finalY);
  finalY += (splitTitle.length * 8) + 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const splitContent = doc.splitTextToSize(content, 180);
  doc.text(splitContent, 14, finalY);

  // --- FOOTER ---
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Official News Alert - RentSafeUK Portfolio Manager - Generated ${format(new Date(), 'PPP')}`,
    105,
    285,
    { align: 'center' }
  );

  return doc;
};
