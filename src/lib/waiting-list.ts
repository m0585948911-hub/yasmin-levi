
'use server';

import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface WaitingListRequest {
    id: string;
    clientId: string;
    clientName?: string; // For admin display
    clientPhone?: string; // For admin display
    selectedServices: {id: string, name: string}[];
    message: string;
    createdAt: Date;
    status: 'new' | 'contacted' | 'resolved';
}

export interface WaitingListRequestData {
    clientId: string;
    selectedServices: {id: string, name: string}[];
    message: string;
    createdAt: Timestamp;
    status: 'new' | 'contacted' | 'resolved';
}

const waitingListCollection = collection(db, 'waitingList');

// Server action to create a new waiting list request.
export async function createWaitingListRequest(requestData: Omit<WaitingListRequest, 'id' | 'createdAt' | 'status'>) {
    try {
        const newRequest = {
            ...requestData,
            createdAt: Timestamp.now(),
            status: 'new' as const,
        };
        await addDoc(waitingListCollection, newRequest);
        return { success: true };
    } catch (error) {
        console.error("Error creating waiting list request:", error);
        return { success: false, error: "Failed to add to waiting list." };
    }
}

// Server action for admin to get all waiting list requests.
export async function getWaitingListRequests(): Promise<WaitingListRequest[]> {
    const q = query(waitingListCollection, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as WaitingListRequestData;
        return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt.toDate(),
        };
    });
}

// Server action to update the status of a request.
export async function updateWaitingListRequestStatus(id: string, status: WaitingListRequest['status']): Promise<{ success: boolean }> {
    try {
        const requestRef = doc(db, 'waitingList', id);
        await updateDoc(requestRef, { status });
        return { success: true };
    } catch (error) {
        console.error("Error updating request status:", error);
        return { success: false };
    }
}

// Server action to delete a request.
export async function deleteWaitingListRequest(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'waitingList', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting request:", error);
        return { success: false };
    }
}
