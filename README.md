# RentSafeUK - Landlord Portfolio Manager

This is a comprehensive property management application built with Next.js and Firebase.

## Getting Started

To run the web application, open a terminal and run the following command:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---
## Firebase & AI Setup

This app is connected to a Firebase project. All AI features are powered by the Google AI (Gemini) API.

**Action Required: Add Your Gemini API Key**

1.  Go to the [Google AI Studio](https://aistudio.google.com/app/apikey) to get your API key.
2.  Create a new file named `.env` in the root of the project.
3.  Add the following line to the `.env` file, replacing `YOUR_API_KEY` with the key you just copied:

```
GEMINI_API_KEY=YOUR_API_KEY
```

The application will automatically use this key for all AI features.
