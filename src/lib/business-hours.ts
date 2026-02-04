'use server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface BusinessHoursRule {
    id: number;
    name?: string; // Optional name for the rule (e.g., "Lunch Break")
    startTime: string;
    endTime: string;
    days: string[];
    dateRange: {
        from?: string; // ISO string
        to?: string;   // ISO string
    };
}

interface BusinessHours {
    opening: BusinessHoursRule[];
    closing: BusinessHoursRule[];
}

const SETTINGS_DOC_ID = 'businessHours';
const SETTINGS_COLLECTION = 'settings';

// Server action to get all business hours rules.
export async function getBusinessHours(): Promise<BusinessHours> {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        // Ensure name property exists for closing rules for backward compatibility
        const closingRules = (data.closing || []).map((rule: any) => ({
            ...rule,
            name: rule.name || ''
        }));
        return { opening: data.opening || [], closing: closingRules };
    } else {
        // Return default empty state if no settings are found
        return { opening: [], closing: [] };
    }
}

// Server action to save all business hours rules.
export async function saveBusinessHours(newRules: BusinessHours) {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    try {
        await setDoc(docRef, JSON.parse(JSON.stringify(newRules)));
        console.log('Business hours saved to Firestore');
        return { success: true };
    } catch (error) {
        console.error('Error saving business hours to Firestore:', error);
        return { success: false };
    }
}
