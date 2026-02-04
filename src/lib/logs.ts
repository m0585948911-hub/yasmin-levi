

'use server';

import { collection, addDoc, getDocs, query, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Timestamp } from 'firebase/firestore';

export interface Log {
    id: string;
    action: string;
    details: string;
    user: string; // Could be client name or 'Admin'
    timestamp: Date;
}

export interface LogData {
    action: string;
    details: string;
    user: string;
    timestamp: Timestamp;
}


const logsCollection = collection(db, 'logs');

// Server action to create a new log entry.
export async function createLog(logData: Omit<Log, 'id' | 'timestamp'>) {
    try {
        const newLog = {
            ...logData,
            timestamp: Timestamp.now(),
        };
        await addDoc(logsCollection, newLog);
        console.log('New log created:', newLog);
        return { success: true };
    } catch (error) {
        console.error("Error creating log:", error);
        return { success: false, error: "Failed to create log." };
    }
}

// Server action to get all logs.
export async function getLogs(): Promise<Log[]> {
    const querySnapshot = await getDocs(logsCollection);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as LogData;
        return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp.toDate(),
        };
    });
}

// Server action to clear all logs
export async function clearLogs(): Promise<{success: boolean, error?: string}> {
    try {
        const querySnapshot = await getDocs(logsCollection);
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Error clearing logs:", error);
        return { success: false, error: "An error occurred while clearing logs." };
    }
}

// Server action to delete a single log entry.
export async function deleteLog(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await deleteDoc(doc(db, 'logs', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting log:", error);
        return { success: false, error: "Failed to delete log." };
    }
}
