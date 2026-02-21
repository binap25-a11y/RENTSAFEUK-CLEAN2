# RentSafeUK - Landlord Portfolio Manager

This is a comprehensive property management application built with Next.js and Firebase.

## Getting Started

This application uses Next.js for the frontend and Genkit for AI features. You must run **two separate servers** for all features to work correctly.

### 1. Get Your Gemini API Key

This project uses the Google Gemini API for its AI features. Your API key connects the app to your Google account. **You must add your key to the `.env` file.**

1.  **[Click here to go to Google AI Studio](https://aistudio.google.com/app/apikey)**. You may need to sign in with your Google account.

2.  You should see a project named **`rentsafeuk-app-3981`** in the list.

3.  Click **"Create API key"** within that project.

4.  Copy the generated key. It will be a long string of letters and numbers.

5.  Open the `.env` file in your project.

6.  Replace `YOUR_API_KEY_HERE` with the key you just copied.

    **Before:**
    `GEMINI_API_KEY="YOUR_API_KEY_HERE"`

    **After (example):**
    `GEMINI_API_KEY="aIzaSy...your...key...here"`

7.  **Important:** After saving the `.env` file, you must **restart both servers** for the new key to be recognized.

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

---
## Firebase Setup

This app is connected to the Firebase project `rentsafeuk-app-3981`. All data is stored in this project.
