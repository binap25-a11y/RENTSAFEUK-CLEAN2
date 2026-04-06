
'use server';

import { Resend } from 'resend';

/**
 * @fileOverview Server-side notification actions.
 * Dispatches email notifications using the Resend service.
 * Supports attachments for legal briefings and information sheets.
 */

// Helper to resolve the Resend client at runtime
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.startsWith('re_')) {
    return new Resend(apiKey);
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

  console.log(`[Registry Notification] Initiating message alert for ${landlordEmail} at ${timestamp}`);

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
        return { success: false, error: error.message };
      }
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      console.error(`[Resend Exception] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

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
        to: tenantEmail,
        subject: `Repair Request: ${propertyAddress}`,
        text: `Maintenance Alert: ${tenantName} has reported a new ${maintenanceCategory} issue regarding ${propertyAddress}.\n\nIssue: ${maintenanceTitle}\n\nReview the details and assign a contractor via your RentSafeUK dashboard.`
      });
      if (error) return { success: false, error: error.message };
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
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

  console.log(`[Law Update Notification] Notifying ${tenantEmail} at ${timestamp}`);

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
      console.log(`[Resend Success] Law update sent to ${tenantEmail}`, data);
      return { success: true, provider: 'resend', id: data?.id };
    } catch (error: any) {
      console.error(`[Resend Exception] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  console.log('--- LAW UPDATE EMAIL SIMULATION (RESEND_API_KEY MISSING OR INVALID) ---');
  console.log(`To: ${tenantEmail}`);
  console.log(`Attachment Included: ${!!attachmentBase64}`);
  return { success: true, provider: 'console' };
}
