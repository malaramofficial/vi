'use server';
import { initializeApp, getApps, App } from 'firebase-admin/app';

let adminApp: App;

export function initializeAdminApp() {
    if (getApps().length > 0) {
        // Return the existing initialized app if it's there.
        // This is important for Next.js's hot-reloading feature.
        adminApp = getApps()[0];
        return adminApp;
    }

    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    try {
        adminApp = initializeApp();
    } catch (e: any) {
        console.error('Automatic admin initialization failed. Make sure GOOGLE_APPLICATION_CREDENTIALS is set.');
        throw e;
    }
    
    return adminApp;
}
