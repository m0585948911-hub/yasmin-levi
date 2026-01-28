
'use server';

import { collection, addDoc, Timestamp, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export interface ReminderData {
    reminderAt: Timestamp;
    notificationTime: Timestamp;
    userId: string; 
    clientId: string;
    clientName: string;
    summary: string;
    commLogId: string; 
    status: 'pending' | 'sent' | 'error' | 'done';
}

export interface Reminder {
    id: string;
    reminderAt: string; // ISO string
    notificationTime: string; // ISO string
    userId: string;
    clientId: string;
    clientName: string;
    summary: string;
    commLogId: string;
    status: 'pending' | 'sent' | 'error' | 'done';
}


export async function createReminder(data: {
    reminderAt: string;
    userId: string;
    clientId: string;
    clientName: string;
    summary: string;
    commLogId: string;
}) {
    try {
        const reminderDate = new Date(data.reminderAt);
        const notificationDate = new Date(reminderDate.getTime() - 5 * 60 * 1000); // 5 minutes before

        const reminderData: ReminderData = {
            reminderAt: Timestamp.fromDate(reminderDate),
            notificationTime: Timestamp.fromDate(notificationDate),
            userId: data.userId,
            clientId: data.clientId,
            clientName: data.clientName,
            summary: data.summary,
            commLogId: data.commLogId,
            status: 'pending',
        };

        await addDoc(collection(db, 'reminders'), reminderData);
        return { success: true };
    } catch (error) {
        console.error('Error creating reminder:', error);
        return { success: false, error: 'Failed to create reminder.' };
    }
}

export async function getReminders(status?: Reminder['status'][]): Promise<Reminder[]> {
    const remindersCol = collection(db, 'reminders');
    const constraints = [];
    if (status && status.length > 0) {
        constraints.push(where('status', 'in', status));
    }
    constraints.push(orderBy('reminderAt', 'asc'));

    const q = query(remindersCol, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data() as ReminderData;
        return {
            id: doc.id,
            ...data,
            reminderAt: data.reminderAt.toDate().toISOString(),
            notificationTime: data.notificationTime.toDate().toISOString(),
        }
    });
}

export async function updateReminderStatus(id: string, status: Reminder['status']): Promise<{ success: boolean }> {
    try {
        const reminderRef = doc(db, 'reminders', id);
        await updateDoc(reminderRef, { status });
        return { success: true };
    } catch (error) {
        console.error("Error updating reminder status:", error);
        return { success: false };
    }
}

export async function deleteReminder(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'reminders', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting reminder:", error);
        return { success: false };
    }
}
