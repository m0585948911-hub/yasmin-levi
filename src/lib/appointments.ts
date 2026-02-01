
'use server';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, deleteDoc, Timestamp, writeBatch, getDoc, orderBy, limit as firestoreLimit, QueryConstraint } from 'firebase/firestore';
import { db } from './firebase';
import { getClientById } from './clients';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'no-show' | 'completed' | 'pending' | 'pending_cancellation';
export type NotificationType = 'newAppointment' | 'dayBefore' | 'timeToLeave' | 'afterAppointment' | 'rejection';


export interface Appointment {
    id: string;
    businessId: string;
    calendarId: string;
    clientId: string | null;
    clientName: string;
    clientPhone?: string;
    serviceId: string;
    serviceName: string;
    start: string;
    end: string;
    status: AppointmentStatus;
    notes?: string;
    arrivalConfirmed?: boolean;
    amount?: number;
    paid?: number;
    sentNotifications?: Partial<Record<NotificationType, boolean>>;
    cancelledBy?: 'client' | 'admin' | 'system';
}

export interface AppointmentData {
    id: string;
    businessId: string;
    calendarId: string;
    clientId: string | null;
    clientName: string;
    clientPhone?: string;
    serviceId: string;
    serviceName: string;
    start: Timestamp;
    end: Timestamp;
    status: AppointmentStatus;
    notes?: string;
    arrivalConfirmed?: boolean;
    amount?: number;
    paid?: number;
    sentNotifications?: Partial<Record<NotificationType, boolean>>;
    cancelledBy?: 'client' | 'admin' | 'system';
}

const toAppointment = (docSnap: import('firebase/firestore').DocumentSnapshot): Appointment => {
    const data = docSnap.data() as AppointmentData;
    return {
        ...data,
        id: docSnap.id,
        businessId: data.businessId ?? 'default',
        start: data.start.toDate().toISOString(),
        end: data.end.toDate().toISOString(),
        cancelledBy: data.cancelledBy,
    };
};

export async function getAppointmentById(id: string): Promise<Appointment | null> {
    const docRef = doc(db, 'appointments', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return toAppointment(docSnap);
    }
    return null;
}


// Server action to get appointments within a date range for a specific business.
export async function getAppointments(
    startDate?: Date, 
    endDate?: Date, 
    businessId: string = 'default',
    clientId?: string,
    statuses?: AppointmentStatus[],
    order: 'asc' | 'desc' = 'asc',
    limit?: number,
    cancelledBy?: 'client' | 'admin' | 'system'
): Promise<Appointment[]> {
    const appointmentsCol = collection(db, 'appointments');
    const queries: QueryConstraint[] = [where('businessId', '==', businessId)];
    
    if (startDate) {
        queries.push(where('start', '>=', Timestamp.fromDate(startDate)));
    }
    if (endDate) {
        queries.push(where('start', '<', Timestamp.fromDate(endDate)));
    }
    if (clientId) {
        queries.push(where('clientId', '==', clientId));
    }
    
    // To avoid needing a composite index for 'desc' order, we handle it differently.
    if (order === 'asc') {
        queries.push(orderBy('start', 'asc'));
        if (limit) {
            queries.push(firestoreLimit(limit));
        }
    } else { // 'desc'
        // For descending order, we fetch ascending and reverse in code.
        queries.push(orderBy('start', 'asc'));
    }

    const q = query(appointmentsCol, ...queries);
    const querySnapshot = await getDocs(q);
    let appointments = querySnapshot.docs.map(toAppointment);

    // Apply filters now
    if (statuses && statuses.length > 0) {
        appointments = appointments.filter(app => statuses.includes(app.status));
    }
    if (cancelledBy) {
        appointments = appointments.filter(app => app.cancelledBy === cancelledBy);
    }

    // Handle descending order post-fetch
    if (order === 'desc') {
        appointments.reverse();
        if (limit) {
            appointments = appointments.slice(0, limit);
        }
    }

    return appointments;
}

// Get all appointments with a 'pending' status for a specific business
export async function getPendingAppointments(businessId: string = 'default'): Promise<Appointment[]> {
    const appointmentsCol = collection(db, 'appointments');
    const q = query(appointmentsCol, where('status', '==', 'pending'), where('businessId', '==', businessId));
    
    const querySnapshot = await getDocs(q);
    const now = new Date();
    
    const pendingAppointments = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const appointment = toAppointment(doc);
        
        let clientPhone: string | undefined = undefined;
        if(appointment.clientId){
            const client = await getClientById(appointment.clientId);
            clientPhone = client?.phone;
        }

        return {
            ...appointment,
            clientPhone: clientPhone,
        };
    }));

    // Filter out appointments in the past
    return pendingAppointments.filter(app => new Date(app.start) >= now);
}


// Server action to save an appointment (create or update) using a batched write.
export async function saveAppointment(appointmentData: Omit<Appointment, 'id'> & { id?: string }): Promise<Appointment> {
    const { id, ...dataToSave } = appointmentData;
    const businessId = dataToSave.businessId || 'default';
    
    const dataWithPhone: Partial<AppointmentData> = { ...dataToSave } as any;
     // Ensure clientPhone is included
    if (dataToSave.clientId && !dataToSave.clientPhone) {
        const client = await getClientById(dataToSave.clientId);
        if (client) {
            dataWithPhone.clientPhone = client.phone;
        }
    }

    const processedData = {
        ...dataWithPhone,
        businessId: businessId,
        start: Timestamp.fromDate(new Date(dataToSave.start)),
        end: Timestamp.fromDate(new Date(dataToSave.end)),
        sentNotifications: dataToSave.sentNotifications || {},
        arrivalConfirmed: dataToSave.arrivalConfirmed || false,
    }

    const batch = writeBatch(db);
    let newId = id;

    if (id) {
        // Update existing
        const appointmentRef = doc(db, 'appointments', id);
        batch.set(appointmentRef, processedData, { merge: true });
    } else {
        // Create new
        const appointmentRef = doc(collection(db, 'appointments'));
        batch.set(appointmentRef, processedData);
        newId = appointmentRef.id;
    }

    // Here you can add more operations to the batch in the future
    // e.g., batch.set(doc(db, 'formInstances', 'some_id'), { ... });

    await batch.commit();
    
    return { ...dataToSave, id: newId! } as Appointment;
}


// Server action to delete an appointment.
export async function deleteAppointment(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'appointments', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting appointment:", error);
        return { success: false };
    }
}

// Server action to update an appointment's status
export async function updateAppointmentStatus(id: string, status: AppointmentStatus, cancelledBy?: 'client' | 'admin' | 'system'): Promise<{ success: boolean }> {
    try {
        const appointmentRef = doc(db, 'appointments', id);
        const dataToUpdate: Partial<AppointmentData> = { status };
        if ((status === 'cancelled' || status === 'pending_cancellation') && cancelledBy) {
            dataToUpdate.cancelledBy = cancelledBy;
        }
        await updateDoc(appointmentRef, dataToUpdate as any);
        return { success: true };
    } catch (error) {
        console.error("Error updating appointment status:", error);
        return { success: false };
    }
}

// Server action to update the sentNotifications field
export async function markNotificationAsSent(appointmentId: string, type: NotificationType): Promise<void> {
    const appointmentRef = doc(db, 'appointments', appointmentId);
    const fieldToUpdate = `sentNotifications.${type}`;
    await updateDoc(appointmentRef, { [fieldToUpdate]: true });
}
