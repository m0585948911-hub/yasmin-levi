
'use server';

import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface Reminder {
    reminderAt: Timestamp;
    notificationTime: Timestamp;
    userId: string; // admin user to notify
    clientId: string;
    clientName: string;
    summary: string;
    commLogId: string; // The ID of the communication log this is for
    status: 'pending' | 'sent' | 'error';
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

        const reminderData: Omit<Reminder, 'id'> = {
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
