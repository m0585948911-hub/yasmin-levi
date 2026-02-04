'use server';

import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, orderBy, where } from 'firebase/firestore';
import { db } from './firebase';

export interface ServiceOperatingHours {
    days: ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[];
    startTime: string; // "HH:mm"
    endTime: string;   // "HH:mm"
}

export interface Service {
    id: string;
    name: string;
    description?: string;
    duration: number; // in minutes
    price?: number;
    categoryId: string;

    // New Fields
    isPublic?: boolean; // Display to clients
    breakTime?: number; // Minutes of break after service
    imageUrl?: string; // Service specific image
    allowPayments?: boolean; // Can be paid in installments
    maxPayments?: number; // Max number of installments
    dailyBookingLimit?: number; // How many times a client can book this per day (0 for unlimited)
    repeatBookingLimitDays?: number; // How many days until a client can book this service again (0 for unlimited)
    recommendedRepeatDays?: number; // Recommended days for next appointment (for reminders)
    preferredCalendarId?: string | null; // Preferred calendar for this service
    requiredFormId?: string | null; // Form required for this service
    allowMultiPurchase?: boolean; // Can be purchased in bulk
    isPromoted?: boolean; // Should this service be promoted
    isPremium?: boolean; // Is this a premium service
    specificHours?: ServiceOperatingHours[]; // Specific hours for this service
    visibleToClients?: string[]; // List of client IDs who can see this service even if not public
    hasPreTreatmentInstructions?: boolean;
    preTreatmentInstructions?: string;
    
    sortOrder?: number; // To sort services within a category
    displayColor?: string; // To color the appointment in the calendar
}

const servicesCollection = collection(db, 'services');

// Server action to get all services, optionally filtered by category
export async function getServices(categoryId?: string): Promise<Service[]> {
    let q;
    const order = orderBy("sortOrder", "asc");

    if (categoryId) {
        q = query(servicesCollection, where("categoryId", "==", categoryId), order);
    } else {
        q = query(servicesCollection, order);
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Service, 'id'>)
    }));
}

// Server action to save a service (create or update).
export async function saveService(serviceData: Omit<Service, 'id'> & { id?: string }): Promise<Service> {
    const { id, ...dataToSave } = serviceData;
    
    if (id) {
        // Update existing
        const serviceRef = doc(db, 'services', id);
        await updateDoc(serviceRef, dataToSave);
        return { ...dataToSave, id };
    } else {
        // Create new
        const docRef = await addDoc(servicesCollection, dataToSave);
        return { ...dataToSave, id: docRef.id };
    }
}

// Server action to delete a service.
export async function deleteService(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'services', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting service:", error);
        return { success: false };
    }
}