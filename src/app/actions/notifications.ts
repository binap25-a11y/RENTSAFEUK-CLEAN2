'use server';

import { Resend } from 'resend';

/**
 * @fileOverview Server-side notification actions.
 * Dispatches email notifications using the Resend service.
 * Automatically switches between console logging and live delivery based on API key presence.
 */

// Helper to resolve the Resend client at runtime
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.includes('re_')) {
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
      await resend.emails.send({
        from: 'RentSafeUK <onboarding@resend.dev>', // Note: Replace with verified domain in production
        to: landlordEmail,
        subject: `New Message: ${propertyAddress}`,
        text: `Resident Alert: ${tenantName} has sent a new message regarding the property at ${propertyAddress}.\n\nMessage Content:\n"${messageContent}"\n\nLog in to the RentSafeUK executive dashboard to reply.`
      });
      console.log(`[Resend Success] Message notification dispatched to ${landlordEmail}`);
      return { success: true, provider: 'resend' };
    } catch (error: any) {
      console.error(`[Resend Failure] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Fallback: Simulation mode if API key is missing
  console.log('--- EMAIL SIMULATION (RESEND_API_KEY MISSING) ---');
  console.log(`To: ${landlordEmail}`);
  console.log(`Body: ${messageContent}`);
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
  const timestamp = new Date().toISOString();

  console.log(`[Registry Notification] Initiating repair alert for ${landlordEmail} at ${timestamp}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'RentSafeUK <onboarding@resend.dev>',
        to: landlordEmail,
        subject: `Repair Request: ${propertyAddress}`,
        text: `Maintenance Alert: ${tenantName} has reported a new ${maintenanceCategory} issue regarding ${propertyAddress}.\n\nIssue: ${maintenanceTitle}\n\nReview the details and assign a contractor via your RentSafeUK dashboard.`
      });
      console.log(`[Resend Success] Maintenance notification dispatched to ${landlordEmail}`);
      return { success: true, provider: 'resend' };
    } catch (error: any) {
      console.error(`[Resend Failure] ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Fallback: Simulation mode
  console.log('--- MAINTENANCE SIMULATION (RESEND_API_KEY MISSING) ---');
  console.log(`To: ${landlordEmail}`);
  console.log(`Issue: ${maintenanceTitle} (${maintenanceCategory})`);
  return { success: true, provider: 'console' };
}
