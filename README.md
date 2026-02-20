# RentSafeUK - Landlord Portfolio Manager

This is a comprehensive property management application built with Next.js and Firebase.

## Getting Started

To run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Firebase Setup Guide

### 1. Authorized Domains
If you see "Google error of access" during sign-in or workstation use, ensure your current domain is added to the Firebase Console:
1. Go to **Authentication** > **Settings** > **Authorized domains**.
2. Add your workstation domain (e.g., `*.cloudworkstations.dev`).

## Mobile Testing Troubleshooting

If you scan the QR code and see "401" or "Workstation does not exist":
*   **Authentication:** Workstations are private. You must be logged into the **same Google account** in your mobile browser that owns the workstation.
*   **Recommended Solution:** Deploy the app to **Firebase App Hosting**. This provides a public URL that works seamlessly on any mobile device without proxy authentication.

## Key Features
*   **AI Property Description:** Generate professional listings using Gemini.
*   **AI Maintenance Assistant:** Diagnose household issues and troubleshooting steps.
*   **Compliance Tracking:** Automated reminders for EPC, Gas Safety, and EICR.
*   **Financial Reporting:** Track income/expenses and export annual PDF statements.
*   **Tenant Screening:** Detailed pre-tenancy background checks.
