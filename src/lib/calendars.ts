'use server';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy, query, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export interface Calendar {
    id: string;
    name: string;
    slotDuration: number;
    sortOrder: number;
}

const calendarsCollection = collection(db, 'calendars');

async function initializeDefaultCalendars() {
    const q = query(calendarsCollection);
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.log("No calendars found, initializing default calendars...");
        const batch = writeBatch(db);
        const defaultCalendars: Omit<Calendar, 'id'>[] = [
            { name: "יומן יסמין", slotDuration: 15, sortOrder: 1 },
            { name: "יומן מכשור", slotDuration: 30, sortOrder: 2 },
        ];
        defaultCalendars.forEach(calendar => {
            const docRef = doc(calendarsCollection);
            batch.set(docRef, calendar);
        });
        await batch.commit();
        console.log("Default calendars have been initialized.");
    }
}


// Server action to get all calendars.
export async function getCalendars(): Promise<Calendar[]> {
    await initializeDefaultCalendars();
    const q = query(calendarsCollection, orderBy("sortOrder"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Calendar, 'id'>)
    }));
}

// Server action to save a calendar (create or update).
export async function saveCalendar(calendarData: Omit<Calendar, 'id'> & { id?: string }): Promise<Calendar> {
    if (calendarData.id) {
        // Update existing
        const { id, ...dataToUpdate } = calendarData;
        const calendarRef = doc(db, 'calendars', id);
        await updateDoc(calendarRef, dataToUpdate);
        return calendarData as Calendar;
    } else {
        // Create new
        const docRef = await addDoc(calendarsCollection, calendarData);
        return { ...calendarData, id: docRef.id };
    }
}

// Server action to delete a calendar
export async function deleteCalendar(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'calendars', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting calendar:", error);
        return { success: false };
    }
}
