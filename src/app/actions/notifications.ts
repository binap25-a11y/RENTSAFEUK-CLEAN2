'use server';

/**
 * @fileOverview Server-side notification actions.
 * Dispatches email notifications to users within the portfolio registry.
 */

export async function notifyLandlordOfMessage(
  landlordEmail: string, 
  tenantName: string, 
  messageContent: string, 
  propertyAddress: string
) {
  // LOGGING (Production Audit Simulation)
  console.log('--- EMAIL NOTIFICATION TRIGGERED (MESSAGE) ---');
  console.log(`To: ${landlordEmail}`);
  console.log(`Subject: New Message from ${tenantName} regarding ${propertyAddress}`);
  console.log(`Content: ${messageContent}`);
  console.log('------------------------------------');

  /**
   * PRODUCTION NOTE: 
   * To enable real email delivery, configure an API key for a service like Resend.
   * Example:
   * 
   * const resend = new Resend(process.env.RESEND_API_KEY);
   * await resend.emails.send({
   *   from: 'RentSafeUK <alerts@rentsafeuk.com>',
   *   to: landlordEmail,
   *   subject: `Message from Resident: ${propertyAddress}`,
   *   text: `${tenantName} has sent a new message regarding ${propertyAddress}:\n\n"${messageContent}"\n\nView and reply in your dashboard.`
   * });
   */

  return { success: true };
}

export async function notifyLandlordOfMaintenance(
  landlordEmail: string,
  tenantName: string,
  maintenanceTitle: string,
  maintenanceCategory: string,
  propertyAddress: string
) {
  // LOGGING (Production Audit Simulation)
  console.log('--- EMAIL NOTIFICATION TRIGGERED (MAINTENANCE) ---');
  console.log(`To: ${landlordEmail}`);
  console.log(`Subject: New Repair Request from ${tenantName} regarding ${propertyAddress}`);
  console.log(`Issue: ${maintenanceTitle}`);
  console.log(`Category: ${maintenanceCategory}`);
  console.log('------------------------------------');

  /**
   * PRODUCTION NOTE: 
   * To enable real email delivery, configure an API key for a service like Resend.
   */

  return { success: true };
}
