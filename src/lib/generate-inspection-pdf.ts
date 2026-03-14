'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * @fileOverview Professional Inspection PDF Generation Engine
 * Centralizes logic for Single-Let and HMO audit reports.
 */

interface Property {
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
}

const formatAddress = (address: Property['address']) => {
  if (!address) return 'Unknown Property';
  return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
};

const safeFormatDate = (dateValue: any) => {
  if (!dateValue) return 'N/A';
  let d: Date;
  if (dateValue instanceof Date) {
    d = dateValue;
  } else if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
    d = new Date(dateValue.seconds * 1000);
  } else {
    d = new Date(dateValue);
  }
  
  try {
    return isNaN(d.getTime()) ? 'N/A' : format(d, 'PPP');
  } catch (e) {
    return 'N/A';
  }
};

const singleLetSections = {
  exterior: { title: 'Exterior', fields: [{ key: 'roofCondition', label: 'Roof condition' }, { key: 'walls', label: 'Walls, brickwork' }, { key: 'windowsAndDoors', label: 'Windows and external doors' }, { key: 'garden', label: 'Garden maintained' }, { key: 'pathways', label: 'Pathways safe and clear' }, { key: 'bins', label: 'Bins accessible' }] },
  safety: { title: 'Safety & Compliance', fields: [{ key: 'smokeAlarms', label: 'Smoke alarms tested' }, { key: 'coAlarm', label: 'CO alarm tested' }, { key: 'electricalSockets', label: 'Electrical sockets safe' }, { key: 'gasCert', label: 'Gas safety certificate valid' }, { key: 'eicr', label: 'EICR valid' }, { key: 'patCert', label: 'PAT Certificate valid' }, { key: 'noTampering', label: 'No tampering with safety equipment' }] },
  interior: { title: 'Interior General Condition', fields: [{ key: 'wallsCeilingsFloors', label: 'Walls, ceilings, floors' }, { key: 'noDamp', label: 'No signs of damp or mould' }, { key: 'windows', label: 'Windows open and close' }, { key: 'doors', label: 'Internal doors and locks' }, { key: 'ventilation', label: 'Adequate ventilation' }, { key: 'cleanliness', label: 'General cleanliness acceptable' }] },
  kitchen: { title: 'Kitchen', fields: [{ key: 'worktops', label: 'Worktops, cupboards, flooring' }, { key: 'sink', label: 'Sink and taps' }, { key: 'oven', label: 'Oven and hob' }, { key: 'fridge', label: 'Fridge freezer' }, { key: 'washingMachine', label: 'Washing machine (if supplied)' }, { key: 'ventilation', label: 'Adequate ventilation' }] },
  bathrooms: { title: 'Bathrooms', fields: [{ key: 'toilet', label: 'Toilet flushing' }, { key: 'shower', label: 'Shower/bath working' }, { key: 'noLeaks', label: 'No leaks from taps/pipes' }, { key: 'extractor', label: 'Extractor fan working' }, { key: 'sealant', label: 'Sealant and grout intact' }, { key: 'noMould', label: 'No mould or damp' }] },
  heating: { title: 'Heating', fields: [{ key: 'boiler', label: 'Boiler functioning' }, { key: 'radiators', label: 'Radiators heating' }, { key: 'thermostat', label: 'Thermostat working' }, { key: 'hotWater', label: 'Hot water supply' }] },
  bedrooms: { title: 'Bedrooms', fields: [{ key: 'windows', label: 'Windows and locks' }, { key: 'heating', label: 'Heating operational' }, { key: 'noDamp', label: 'No damp or mould' }, { key: 'flooring', label: 'Flooring and walls' }, { key: 'furniture', label: 'Furniture condition (if provided)' }] },
};

const hmoSections = {
  fireSafety: { title: 'Fire Safety (HMO Specific)', fields: [ { key: 'interlinkedAlarms', label: 'Interlinked smoke alarms' }, { key: 'heatDetector', label: 'Heat detector in kitchen' }, { key: 'fireDoors', label: 'Fire doors self-closing' }, { key: 'doorSeals', label: 'Door intumescent strips intact' }, { key: 'extinguishers', label: 'Fire extinguishers serviced' }, { key: 'fireBlanket', label: 'Fire blanket in kitchen' }, { key: 'emergencyLighting', label: 'Emergency lighting operational' }, { key: 'clearRoutes', label: 'Fire escape routes clear' }, { key: 'signage', label: 'Fire safety signage displayed' }] },
  communal: { title: 'Communal Areas', fields: [{ key: 'clean', label: 'Clean and free from hazards' }, { key: 'lighting', label: 'Adequate lighting' }, { key: 'flooring', label: 'Flooring in good condition' }, { key: 'noDamp', label: 'No damp or mould' }, { key: 'windows', label: 'Windows and locks functioning' }, { key: 'wasteDisposal', label: 'Waste disposal area tidy' }] },
  bedrooms: { title: 'Bedrooms (Per Room)', fields: [{ key: 'doorLock', label: 'Door lock functioning' }, { key: 'ventilation', label: 'Adequate ventilation' }, { key: 'heating', label: 'Heating working' }, { key: 'noDamp', label: 'No signs of damp or mould' }, { key: 'furniture', label: 'Furniture in good condition' }, { key: 'sockets', label: 'Electrical sockets safe' }, { key: 'occupancy', label: 'Tenant occupancy confirmed' }] },
  kitchen: { title: 'Kitchen', fields: [{ key: 'appliances', label: 'Cooking appliances working' }, { key: 'extractor', label: 'Extractor fan operational' }, { key: 'sink', label: 'Sinks and taps leak-free' }, { key: 'cupboards', label: 'Worktops & cupboards good' }, { key: 'fridge', label: 'Fridge/freezer functional' }, { key: 'storage', label: 'Adequate food storage' }, { key: 'fireBlanket', label: 'Fire blanket present' }, { key: 'pat', label: 'PAT-tested appliances' }] },
  bathrooms: { title: 'Bathrooms', fields: [{ key: 'toilet', label: 'Toilet flushing correctly' }, { key: 'shower', label: 'Shower/bath working' }, { key: 'extractor', label: 'Extractor fan functioning' }, { key: 'noLeaks', label: 'No leaks or damp' }, { key: 'sealant', label: 'Sealant and grout intact' }, { key: 'hotWater', label: 'Adequate hot water supply' }] },
  utilities: { title: 'Utilities', fields: [{ key: 'boiler', label: 'Boiler functioning and serviced' }, { key: 'radiators', label: 'Radiators heating properly' }, { key: 'thermostats', label: 'Thermostats working' }, { key: 'consumerUnit', label: 'Consumer unit safe/labelled' }, { key: 'gasCert', label: 'Gas safety certificate up to date' }, { key: 'eicr', label: 'EICR valid' }] },
  exterior: { title: 'Exterior', fields: [{ key: 'roof', label: 'Roof and gutters good' }, { key: 'pathways', label: 'Pathways safe and clear' }, { key: 'garden', label: 'Garden/yard maintained' }, { key: 'bins', label: 'Bins accessible' }, { key: 'securityLighting', label: 'Security lighting working' }] },
};

const tenantResponsibilitiesFields = [{ key: 'clean', label: 'Property kept clean' }, { key: 'noOccupants', label: 'No unauthorised occupants' }, { key: 'noPets', label: 'No unauthorised pets' }, { key: 'noSmoking', label: 'No evidence of smoking' }, { key: 'noAlterations', label: 'No unauthorised alterations' }];
const hmoTenantFields = [{ key: 'clean', label: 'Room kept clean' }, { key: 'noSmoking', label: 'No evidence of smoking' }, { key: 'noPets', label: 'No unauthorised pets' }, { key: 'noTampering', label: 'No tampering with fire fire safety equipment' }];
const followUpFields = [{ key: 'repairsRequired', label: 'Repairs Required' }, { key: 'urgentSafetyIssues', label: 'Urgent Safety Issues' }, { key: 'maintenanceScheduled', label: 'Maintenance Scheduled' }];

export const generateInspectionPDF = (inspection: any, property: any) => {
  if (!inspection || !property) return null;

  const doc = new jsPDF();
  const inspectionDate = safeFormatDate(inspection.scheduledDate || inspection.inspectionDate);
  const inspectionType = inspection.type || inspection.inspectionType || 'N/A';
  const pageHeight = doc.internal.pageSize.getHeight();
  const propertyAddress = formatAddress(property.address);
  let finalY = 0;

  // --- HEADER ---
  doc.setFontSize(20);
  doc.setTextColor(33, 114, 249); // Primary color theme
  doc.text('RentSafeUK Inspection Report', 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Asset ID: ${inspection.propertyId}`, 14, 28);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Location: ${propertyAddress}`, 14, 36);
  doc.setLineWidth(0.5);
  doc.setDrawColor(200);
  doc.line(14, 38, 200, 38);

  // --- SUMMARY TABLE ---
  autoTable(doc, {
    startY: 42,
    head: [['Registry Detail', 'Status / Value']],
    body: [
      ['Date conducted', inspectionDate],
      ['Lead Inspector', inspection.inspectorName || 'Not specified'],
      ['Report Category', inspectionType],
      ['Current Status', inspection.status || 'Completed']
    ],
    theme: 'striped',
    headStyles: { fillColor: [33, 114, 249] }
  });

  finalY = (doc as any).lastAutoTable.finalY + 15;

  const addSectionToPdf = (title: string, data: any, fields: {key: string, label: string}[], notesKey: string, concernsNote?: string | null) => {
    if (!data && !concernsNote) return;

    const hasData = data && (fields.some(field => data[field.key] !== undefined && data[field.key] !== false && data[field.key] !== '') || data[notesKey]);
    if (!hasData && !concernsNote) return;

    if (finalY > pageHeight - 60) {
      doc.addPage();
      finalY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(33, 114, 249);
    doc.text(title, 14, finalY);
    finalY += 8;

    if (fields && data) {
      const tableBody = fields.map(field => {
        const checked = data[field.key];
        const status = checked === true ? 'Pass' : (checked === false ? 'Fail' : 'N/A');
        return [field.label, status];
      });

      if (tableBody.some(row => row[1] !== 'N/A')) {
        autoTable(doc, {
          startY: finalY,
          head: [['Requirement Check', 'Compliance Status']],
          body: tableBody.filter(row => row[1] !== 'N/A'),
          theme: 'grid',
          styles: { fontSize: 9 }
        });
        finalY = (doc as any).lastAutoTable.finalY + 5;
      }
    }

    const notes = data?.[notesKey];
    if (notes) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('Auditor Notes:', 14, finalY);
      finalY += 5;
      doc.setTextColor(0);
      const splitNotes = doc.splitTextToSize(notes, 170);
      doc.text(splitNotes, 14, finalY);
      finalY += (splitNotes.length * 5) + 5;
    }
    
    if (concernsNote) {
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Resident's Concerns:", 14, finalY);
      finalY += 5;
      doc.setTextColor(0);
      const splitConcerns = doc.splitTextToSize(concernsNote, 170);
      doc.text(splitConcerns, 14, finalY);
      finalY += (splitConcerns.length * 5) + 5;
    }

    finalY += 5;
  };

  if (inspection.type === 'Single-Let' || inspection.inspectionType) {
    Object.entries(singleLetSections).forEach(([key, { title, fields }]) => {
      addSectionToPdf(title, inspection[key], fields, 'notes');
    });
    addSectionToPdf("Resident Responsibilities", inspection.tenantResponsibilities, tenantResponsibilitiesFields, 'notes', inspection.tenantResponsibilities?.concerns);
    addSectionToPdf("Required Actions", inspection.followUpActions, followUpFields, 'notes');
  } else if (inspection.type === 'HMO') {
    Object.entries(hmoSections).forEach(([key, { title, fields }]) => {
      addSectionToPdf(title, inspection[key], fields, 'notes');
    });
    addSectionToPdf("Resident Responsibilities", inspection.tenantResponsibilities, hmoTenantFields, 'notes', inspection.tenantResponsibilities?.concerns);
    addSectionToPdf("Required Actions", inspection.followUp, followUpFields, 'notes');
  }

  // --- FOOTER ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Official Audit Record - RentSafeUK Portfolio Registry - Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 287);
  }
  
  const safeAddress = propertyAddress.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  doc.save(`Audit-Report-${safeAddress}-${format(new Date(), 'yyyyMMdd')}.pdf`);
  
  return doc;
};
