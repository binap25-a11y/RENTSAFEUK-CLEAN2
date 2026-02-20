# RentSafeUK - Landlord Portfolio Manager

This is a comprehensive property management application built with Next.js and Firebase.

## Getting Started

To run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Firebase Setup Guide

### 1. **CRITICAL STEP**: Enable File Uploads

File uploads will fail until you run a one-time command in your terminal. This is a required security step.

**Instructions:**

1.  **Open a NEW Terminal Tab.** In your code editor, look for a `+` icon next to your existing terminal tabs. Click it to open a new, clean terminal prompt.
2.  **Copy the Command Below.** Click the copy icon or highlight the entire command and copy it. Make sure you get it exactly right.

    ```bash
    gcloud storage buckets update gs://studio-7375290328-5d091.appspot.com --cors-file=cors.json
    ```

3.  **Paste and Run.** Paste the command into your **new** terminal and press `Enter`.

Wait for the command to finish. You should see a confirmation message. After this, file uploads will work correctly in your app. **You only need to do this once.**


### 2. Authorized Domains
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
