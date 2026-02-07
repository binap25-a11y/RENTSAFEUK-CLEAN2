# Firebase Studio

This is a Next.js starter project bootstrapped in Firebase Studio.

## Getting Started

To run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the main page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Firebase Setup Guide

This project is pre-configured to connect to Firebase services. Here's a quick guide to how it works and how to manage it.

### Configuration File

Your project's Firebase configuration is stored in:
`src/firebase/config.ts`

This configuration is public and safe to keep in your source code. It is used to initialize the Firebase SDK on the client-side.

### Connection and Providers

The application handles Firebase initialization and provides services (like Auth and Firestore) to all components through a set of React Context Providers.

-   **`src/firebase/client-provider.tsx`**: This is the main client-side entry point. It ensures Firebase is initialized only once.
-   **`src/firebase/provider.tsx`**: This component manages the user's authentication state and provides access to all Firebase services through custom hooks (`useAuth`, `useFirestore`, `useUser`, etc.).

You typically don't need to modify these files, but they are commented to explain the workflow.

### **Important: One-Time Setup for Firebase Storage Uploads**

To allow file uploads from your application to Firebase Storage, you need to apply a Cross-Origin Resource Sharing (CORS) policy to your storage bucket. This is a one-time setup that you must run from your local terminal.

**1. Locate your CORS file:**
   A pre-configured `cors.json` file is included in the root of this project.

**2. Run the `gcloud` command:**
   Open your terminal, navigate to the root of this project, and run the following command. This will apply the `cors.json` policy to your project's default storage bucket.

   ```bash
   gcloud storage buckets update gs://studio-7375290328-5d091.appspot.com --cors-file=cors.json
   ```

   > **Note:** You must have the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and be authenticated (`gcloud auth login`) for this command to work.

After running this command, file uploads from your web application should work correctly. You only need to do this once for your project.
