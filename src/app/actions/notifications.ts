
'use server';

import { Resend } from 'resend';

/**
 * @fileOverview Server-side notification actions.
 * Dispatches email notifications using the Resend service.
 * Supports attachments for legal briefings and information sheets.
 * Includes a robust fallback to console logging for prototyping environments.
 */

// Helper to resolve the Resend client at runtime
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  
  // Handshake verification: Ensure key exists and follows Resend format
  if (apiKey && apiKey.startsWith('re_') && apiKey.length > 20) {
    try {
      return new Resend(apiKey);
    } catch (e) {
      console.warn('[Notification Registry] Failed to initialize Resend client:', e);
      return null;
    }
  }
  return null;
};

// SENDER IDENTITY: Updated to user's verified address
const SENDER_EMAIL = 'RentSafeUK <binap25@googlemail.com>';

export async function notifyLandlordOfMessage(
  landlordEmail: string, 
  tenantName: string, 
  messageContent: string, 
  propertyAddress: string
) {
  const resend = getResendClient();

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: landlordEmail.trim().toLowerCase(),
        subject: `New Message: ${propertyAddress}`,
        text: `Resident Alert: ${tenantName} has sent a new message regarding the property at ${propertyAddress}.\n\nMessage Content:\n"${messageContent}"\n\nLog in to the RentSafeUK executive dashboard to reply.`
      });
      
      if (!error) return { success: true, provider: 'resend', id: data?.id };
      
      console.warn(`[Resend API Error] ${error.message}. Falling back to simulation.`);
    } catch (error: any) {
      console.warn(`[Resend Exception] ${error.message}. Falling back to simulation.`);
    }
  }

  // FALLBACK: Simulation Mode
  console.log('--- EMAIL SIMULATION ---');
  console.log(`Type: Landlord Message Alert`);
  console.log(`To: ${landlordEmail}`);
  console.log(`From: ${SENDER_EMAIL}`);
  console.log(`Content: ${messageContent}`);
  return { success: true, provider: 'console' };
}

export async function notifyTenantOfMessage(
  tenantEmail: string,
  landlordName: string,
  messageContent: string,
  propertyAddress: string
) {
  const resend = getResendClient();
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: tenantEmail.trim().toLowerCase(),
        subject: `New Message from Landlord: ${propertyAddress}`,
        text: `Management Alert: ${landlordName} has sent you a new message regarding ${propertyAddress}.\n\nMessage Content:\n"${messageContent}"\n\nLog in to your RentSafeUK Resident Hub to reply.`
      });
      if (!error) return { success: true, provider: 'resend', id: data?.id };
      
      console.warn(`[Resend API Error] ${error.message}. Falling back to simulation.`);
    } catch (error: any) {
        console.warn(`[Resend Exception] ${error.message}. Falling back to simulation.`);
    }
  }
  
  console.log('--- EMAIL SIMULATION ---');
  console.log(`Type: Tenant Message Alert`);
  console.log(`To: ${tenantEmail}`);
  console.log(`From: ${SENDER_EMAIL}`);
  return { success: true, provider: 'console' };
}

export async function notifyLandlordOfMaintenance(
  landlordEmail: string,
  tenantName: string,
  maintenanceTitle: string,
  maintenanceCategory: string,
  propertyAddress: string
) {
  const resend = getResendClient();
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: landlordEmail.trim().toLowerCase(),
        subject: `Repair Request: ${propertyAddress}`,
        text: `Maintenance Alert: ${tenantName} has reported a new ${maintenanceCategory} issue regarding ${propertyAddress}.\n\nIssue: ${maintenanceTitle}\n\nReview the details and assign a contractor via your RentSafeUK dashboard.`
      });
      if (!error) return { success: true, provider: 'resend', id: data?.id };
      
      console.warn(`[Resend API Error] ${error.message}. Falling back to simulation.`);
    } catch (error: any) {
        console.warn(`[Resend Exception] ${error.message}. Falling back to simulation.`);
    }
  }
  
  console.log('--- EMAIL SIMULATION ---');
  console.log(`Type: Maintenance Alert`);
  console.log(`To: ${landlordEmail}`);
  console.log(`From: ${SENDER_EMAIL}`);
  return { success: true, provider: 'console' };
}

export async function notifyTenantOfLawUpdate(
  tenantEmail: string,
  updateTitle: string,
  updateBrief: string,
  attachmentBase64?: string
) {
  const resend = getResendClient();
  const timestamp = new Date().toISOString();

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: tenantEmail.trim().toLowerCase(),
        subject: `Legal Update for Residents: ${updateTitle}`,
        text: `Important Management Briefing:\n\n${updateBrief}\n\nPlease find the attached professional information sheet for full details on how this may affect your tenancy.`,
        attachments: attachmentBase64 ? [
          {
            filename: 'Renters-Rights-Act-Information-Sheet.pdf',
            content: attachmentBase64,
          }
        ] : []
      });
      
      if (!error) return { success: true, provider: 'resend', id: data?.id };
      
      console.warn(`[Resend API Error] ${error.message}. Falling back to simulation.`);
    } catch (error: any) {
      console.warn(`[Resend Exception] ${error.message}. Falling back to simulation.`);
    }
  }

  // DEFINITIVE FALLBACK: Log to terminal for developer verification
  console.log('--- LAW UPDATE EMAIL SIMULATION ---');
  console.log(`Recipient: ${tenantEmail}`);
  console.log(`From: ${SENDER_EMAIL}`);
  console.log(`Title: ${updateTitle}`);
  console.log(`Attachment Provided: ${!!attachmentBase64}`);
  console.log(`Timestamp: ${timestamp}`);
  return { success: true, provider: 'console' };
}
