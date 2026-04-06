
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
  
  // PROTOTYPE HANDSHAKE:
  // We only initialize if the key looks like a real Resend key (starts with 're_')
  // and is not a common placeholder value.
  const isPlaceholder = !apiKey || apiKey.includes('YOUR_API_KEY') || apiKey.length < 10;
  
  if (apiKey && apiKey.startsWith('re_') && !isPlaceholder) {
    try {
      return new Resend(apiKey);
    } catch (e) {
      console.warn('[Notification Registry] Failed to initialize Resend client:', e);
      return null;
    }
  }
  return null;
};

export async function notifyLandlordOfMessage(
  landlordEmail: string, 
  tenantName: string, 
  messageContent: string, 
  propertyAddress: string
) {
  const resend = getResendClient();
  const timestamp = new Date().toISOString();

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'RentSafeUK <onboarding@resend.dev>',
        to: landlordEmail,
        subject: `New Message: ${propertyAddress}`,
        text: `Resident Alert: ${tenantName} has sent a new message regarding the property at ${propertyAddress}.\n\nMessage Content:\n"${messageContent}"\n\nLog in to the RentSafeUK executive dashboard to reply.`
      });
      if (error) {
        console.error(`[Resend API Error] ${error.message}`);
        // If the key is specifically invalid, we don't treat it as a success
        return { success: false, error: error.message };
      }
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      console.error(`[Resend Exception] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // FALLBACK: Simulation Mode
  console.log('--- EMAIL SIMULATION (RESEND_API_KEY MISSING OR INVALID) ---');
  console.log(`Type: Landlord Message Alert`);
  console.log(`To: ${landlordEmail}`);
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
        from: 'RentSafeUK <onboarding@resend.dev>',
        to: tenantEmail,
        subject: `New Message from Landlord: ${propertyAddress}`,
        text: `Management Alert: ${landlordName} has sent you a new message regarding ${propertyAddress}.\n\nMessage Content:\n"${messageContent}"\n\nLog in to your RentSafeUK Resident Hub to reply.`
      });
      if (error) return { success: false, error: error.message };
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  console.log('--- EMAIL SIMULATION ---');
  console.log(`Type: Tenant Message Alert`);
  console.log(`To: ${tenantEmail}`);
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
        from: 'RentSafeUK <onboarding@resend.dev>',
        to: landlordEmail,
        subject: `Repair Request: ${propertyAddress}`,
        text: `Maintenance Alert: ${tenantName} has reported a new ${maintenanceCategory} issue regarding ${propertyAddress}.\n\nIssue: ${maintenanceTitle}\n\nReview the details and assign a contractor via your RentSafeUK dashboard.`
      });
      if (error) return { success: false, error: error.message };
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  console.log('--- EMAIL SIMULATION ---');
  console.log(`Type: Maintenance Alert`);
  console.log(`To: ${landlordEmail}`);
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
        from: 'RentSafeUK <onboarding@resend.dev>',
        to: tenantEmail,
        subject: `Legal Update for Residents: ${updateTitle}`,
        text: `Important Management Briefing:\n\n${updateBrief}\n\nPlease find the attached professional information sheet for full details on how this may affect your tenancy.`,
        attachments: attachmentBase64 ? [
          {
            filename: 'Renters-Rights-Act-Information-Sheet.pdf',
            content: attachmentBase64,
          }
        ] : []
      });
      if (error) {
        console.error(`[Resend API Error] ${error.message}`);
        return { success: false, error: error.message };
      }
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      console.error(`[Resend Exception] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // DEFINITIVE FALLBACK: Log to terminal for developer verification
  console.log('--- LAW UPDATE EMAIL SIMULATION (RESEND_API_KEY MISSING OR INVALID) ---');
  console.log(`Recipient: ${tenantEmail}`);
  console.log(`Title: ${updateTitle}`);
  console.log(`Attachment Provided: ${!!attachmentBase64}`);
  console.log(`Timestamp: ${timestamp}`);
  return { success: true, provider: 'console' };
}
