
'use server';

import { Resend } from 'resend';

/**
 * @fileOverview Server-side notification actions.
 * Dispatches email notifications to users within the portfolio registry.
 * Uses the Resend service if an API key is provided in .env.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function notifyLandlordOfMessage(
  landlordEmail: string, 
  tenantName: string, 
  messageContent: string, 
  propertyAddress: string
) {
  // LOGGING (Production Audit)
  console.log('--- EMAIL NOTIFICATION TRIGGERED (MESSAGE) ---');
  console.log(`To: ${landlordEmail}`);
  console.log(`Subject: New Message from ${tenantName} regarding ${propertyAddress}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'RentSafeUK <onboarding@resend.dev>', // Update to your verified domain in production
        to: landlordEmail,
        subject: `Message from Resident: ${propertyAddress}`,
        text: `${tenantName} has sent a new message regarding ${propertyAddress}:\n\n"${messageContent}"\n\nView and reply in your dashboard.`
      });
      console.log('Resend: Message notification sent successfully.');
    } catch (error) {
      console.error('Resend Failure:', error);
    }
  } else {
    console.log('Resend: API Key missing in .env. Notification logged to console only.');
  }

  return { success: true };
}

export async function notifyLandlordOfMaintenance(
  landlordEmail: string,
  tenantName: string,
  maintenanceTitle: string,
  maintenanceCategory: string,
  propertyAddress: string
) {
  // LOGGING (Production Audit)
  console.log('--- EMAIL NOTIFICATION TRIGGERED (MAINTENANCE) ---');
  console.log(`To: ${landlordEmail}`);
  console.log(`Issue: ${maintenanceTitle}`);

  if (resend) {
    try {
      await resend.emails.send({
        from: 'RentSafeUK <onboarding@resend.dev>', // Update to your verified domain in production
        to: landlordEmail,
        subject: `New Repair Request: ${propertyAddress}`,
        text: `${tenantName} has reported a new maintenance issue regarding ${propertyAddress}:\n\nIssue: ${maintenanceTitle}\nCategory: ${maintenanceCategory}\n\nView and manage this request in your dashboard.`
      });
      console.log('Resend: Maintenance notification sent successfully.');
    } catch (error) {
      console.error('Resend Failure:', error);
    }
  } else {
    console.log('Resend: API Key missing in .env. Notification logged to console only.');
  }

  return { success: true };
}
