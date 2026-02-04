
'use server';

import { adminDb as db } from './firebase-admin';
import type { AllSettings } from './settings-types';


const SETTINGS_DOC_ID = 'appGeneralSettings';
const SETTINGS_COLLECTION = 'settings';
const LOGO_DOC_ID = 'businessLogo';


export async function saveAllSettings(settings: AllSettings): Promise<{ success: boolean; error?: string }> {
    try {
        const docRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
        // Firestore doesn't like undefined values. We need to clean the object.
        const cleanSettings = JSON.parse(JSON.stringify(settings));
        await docRef.set(cleanSettings);
        return { success: true };
    } catch (error) {
        console.error("Error saving settings to Firestore:", error);
        return { success: false, error: "Failed to save settings." };
    }
}

export async function saveLogo(logoDataUrl: string): Promise<{ success: boolean; error?: string }> {
     try {
        const docRef = db.collection(SETTINGS_COLLECTION).doc(LOGO_DOC_ID);
        await docRef.set({ url: logoDataUrl });
        return { success: true };
    } catch (error) {
        console.error("Error saving logo to Firestore:", error);
        return { success: false, error: "Failed to save logo." };
    }
}

export async function getLogo(): Promise<string | null> {
    try {
        const docRef = db.collection(SETTINGS_COLLECTION).doc(LOGO_DOC_ID);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            return docSnap.data()?.url;
        }
        return null;
    } catch (error) {
        console.error("Error fetching logo:", error);
        return null;
    }
}


export async function getSettingsForClient(): Promise<AllSettings> {
    const docRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
    const docSnap = await docRef.get();

    const defaultSettings: AllSettings = {
       businessDetails: {
            businessName: 'Yasmin Beauty Diary', firstName: 'יסמין', lastName: 'לוי', gender: 'female', email: 'yasmin@example.com', street: 'האומן', houseNumber: '12', city: 'תל אביב', phone: '0501234567'
        },
        appLinks: { facebook: 'https://facebook.com', instagram: 'https://instagram.com', tiktok: 'https://tiktok.com', website: '' },
        appTheme: {
            primary: '#E11D48',
            background: '#FFFFFF',
            foreground: '#000000',
            accent: '#FCE7F3',
        },
        calendarSettings: { checkInterval: 15, recheckInterval: 5, adhesionDuration: 0, isFlexible: false },
        limitationSettings: { newAppointmentDaysLimit: 0, newAppointmentHoursLimit: 2, editAppointmentHoursLimit: 24, cancelAppointmentHoursLimit: 6, requireApprovalOnLimit: false },
        blockedClientSettings: { blockingMethod: 'login' },
        registrationSettings: { requireBirthDate: false, requireEmail: true, requirePrepayment: false },
        generalAppSettings: { 
            isArrivalConfirmationActive: true, isWaitingListActive: false, showPrice: true, showDuration: true, restrictToIsraeliNumbers: true, hideGraySlots: false,
            noPriorityCalendar: false, allowMultiServiceSelection: true, allowEditAppointment: true, allowCancelAppointment: true, requireTermsSignature: false, termsAndConditions: 'תקנון לדוגמה',
            appointmentApproval: 'all'
         },
         appointmentNotifications: {
            newAppointment: { enabled: true, content: "✨התור שלך נקבע בהצלחה!✨ שמחנו לאשר את #שם_השירות# לתאריך #תאריך# בשעה #שעה#, יום #יום#. 🔔 לאישור הגעה: #אישור הגעה# 📲להורדת האפליקציה: https://yasmin.tormahir.co.il/d 📍יסמין - לגלות את היופי שבך רחוב ברנר 7, רחובות 💬מדיניות ביטול תורים בהתאם לתקנון" },
            dayBefore: { enabled: false, content: "" },
            timeToLeave: { enabled: false, content: "" },
            afterAppointment: { enabled: false, content: "" },
            rejection: { enabled: true, content: "לצערנו, לא ניתן היה לאשר את התור שביקשת." },
         }
    };
    
    if (docSnap.exists) {
        // Here we could merge with defaults to ensure all keys exist, but for now we'll just return what's in the DB
        return docSnap.data() as AllSettings;
    } else {
        // If no settings exist in DB, save the default ones for next time
        await docRef.set(defaultSettings);
        return defaultSettings;
    }
}

// Deprecated, use getSettingsForClient
export async function getAllSettings(): Promise<AllSettings | null> {
    return getSettingsForClient();
}
