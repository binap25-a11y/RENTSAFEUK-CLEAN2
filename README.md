# RentSafeUK - Landlord Portfolio Manager

This is a comprehensive property management application built with Next.js and Firebase.

## Getting Started

This application uses Next.js for the frontend and Genkit for AI features. You must run **two separate servers** for all features to work correctly.

### 1. Set Up Your Gemini API Key

This project uses the Google Gemini API for its AI features.

1.  **[Click here to get your Gemini API key from Google AI Studio](https://aistudio.google.com/app/apikey)**. You may need to sign in with your Google account.
2.  Click **"Create API key"** in a new project.
3.  Copy the generated key to your clipboard.
4.  Open the `.env` file located in the root of this project.
5.  You will see a line like `GEMINI_API_KEY="YOUR_API_KEY_HERE"`.
6.  Replace `YOUR_API_KEY_HERE` with the key you just copied from AI Studio.

    **Before:**
    `GEMINI_API_KEY="YOUR_API_KEY_HERE"`

    **After (example):**
    `GEMINI_API_KEY="aIzaSy...your...key...here"`

### 2. Run the AI Server (Genkit)

Open a terminal and run the following command to start the AI service.

```bash
npm run genkit:dev
```

### 3. Run the Web Application

Open a **second, separate terminal** and run the following command to start the main web application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Troubleshooting AI Errors

*   **"AI service is not reachable" / "fetch failed"**: This means the main web app can't connect to the AI server. Make sure you have the Genkit server running in a separate terminal with `npm run genkit:dev`. If you've just updated the code, you may need to stop (Ctrl+C) and restart both the AI server and the web server.

*   **`GenkitError: FAILED_PRECONDITION: Please pass in the API key`**: This error in your `genkit:dev` terminal means the AI server couldn't find your API key. Ensure your `.env` file is in the project's root folder and contains your key.

*   **"API key not valid"**: This error in the browser means your `GEMINI_API_KEY` in the `.env` file is incorrect. Double-check that you copied it correctly from Google AI Studio and restart both servers.

*   **"Failed Precondition" (in browser)**: This error comes directly from Google's servers and usually means one of two things:
    1.  **Billing is not enabled** on the Google Cloud project associated with your API key.
    2.  The **"Generative Language API"** (or sometimes "Vertex AI API") is not enabled for that project.
    
    You must go to your [Google Cloud Console](https://console.cloud.google.com/) to verify that both are active for your project.

---

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
