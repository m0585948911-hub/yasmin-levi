'use server';

import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, where, Timestamp, getDoc, limit, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { removeUndefined } from './remove-undefined';

export type Relationship = "son" | "daughter" | "father" | "mother" | "brother" | "sister";
export interface FamilyRelation {
  memberId: string;
  relation: Relationship;
}

export interface ClientFlag {
    type: 'allergy' | 'meds' | 'keloid' | 'pregnancy' | 'skinCondition' | 'pihRisk' | 'diabetes' | 'priorReaction' | 'operational';
    reason: string;
    severity: 'low' | 'medium' | 'high';
    active: boolean;
    createdAtIso: string;
    lastChangedAtIso: string;
    source: 'client_form' | 'clinician' | 'system';
}


export interface Client {
    id: string;
    businessId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    gender: 'male' | 'female';
    birthDate?: string | null;
    receivesSms?: boolean;
    isBlocked?: boolean;
    isSmsOptOut?: boolean;
    preferredCalendarId?: string | null;
    createdAt: string;
    updatedAt?: string | null;
    notes?: string;
    avatarUrl?: string;
    showHebrewDate?: boolean;
    idNumber?: string;
    street?: string;
    city?: string;
    houseNumber?: string;
    status?: 'active' | 'vip' | 'at-risk' | 'blocked' | 'new';
    sourceOfArrival?: string;
    skinType?: string;
    stickyNote?: string;
    flagsSummary?: ClientFlag[];
    familyRelations?: FamilyRelation[];
}

export interface ClientData {
    id: string;
    businessId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    gender: 'male' | 'female';
    birthDate?: Timestamp | string;
    receivesSms?: boolean;
    isBlocked?: boolean;
    isSmsOptOut?: boolean;
    preferredCalendarId?: string | null;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
    notes?: string;
    avatarUrl?: string;
    showHebrewDate?: boolean;
    idNumber?: string;
    street?: string;
    city?: string;
    houseNumber?: string;
    status?: 'active' | 'vip' | 'at-risk' | 'blocked' | 'new';
    sourceOfArrival?: string;
    skinType?: string;
    stickyNote?: string;
    flagsSummary?: ClientFlag[];
    familyRelations?: FamilyRelation[];
}

function toIso(date: any): string | null {
    if (!date) return null;
    if (date instanceof Timestamp) {
        return date.toDate().toISOString();
    }
    if (date instanceof Date) {
        return date.toISOString();
    }
    if (typeof date === 'string') {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
            return d.toISOString();
        }
    }
    return null;
}

function toClient(id: string, data: any): Client {
  return {
    id,
    businessId: data.businessId ?? 'default',
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    phone: data.phone ?? '',
    email: data.email ?? undefined,
    gender: data.gender ?? 'female',

    receivesSms: data.receivesSms ?? undefined,
    isBlocked: data.isBlocked ?? undefined,
    isSmsOptOut: data.isSmsOptOut ?? undefined,
    preferredCalendarId: data.preferredCalendarId ?? null,
    notes: data.notes ?? undefined,
    avatarUrl: data.avatarUrl ?? undefined,

    showHebrewDate: data.showHebrewDate ?? undefined,
    idNumber: data.idNumber ?? undefined,
    street: data.street ?? undefined,
    city: data.city ?? undefined,
    houseNumber: data.houseNumber ?? undefined,
    status: data.status ?? 'active',
    sourceOfArrival: data.sourceOfArrival ?? undefined,
    skinType: data.skinType ?? undefined,
    stickyNote: data.stickyNote ?? undefined,
    flagsSummary: Array.isArray(data.flagsSummary) ? data.flagsSummary : [],
    familyRelations: Array.isArray(data.familyRelations) ? data.familyRelations : [],


    // ✅ תמיד plain
    createdAt: toIso(data.createdAt)!,
    updatedAt: toIso(data.updatedAt),
    birthDate: toIso(data.birthDate),
  };
}


const clientsCollection = collection(db, 'clients');

// Server action to get all clients for a specific business.
export async function getClients(businessId: string = 'default'): Promise<Client[]> {
    const querySnapshot = await getDocs(clientsCollection);
    const allClients = querySnapshot.docs.map(doc => toClient(doc.id, doc.data()));
    // Filter client-side to include legacy clients without a businessId
    return allClients.filter(client => client.businessId === businessId || !client.businessId);
}

// Server action to get a single client by ID.
export async function getClientById(id: string): Promise<Client | null> {
    const docRef = doc(db, 'clients', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return toClient(docSnap.id, docSnap.data());
    } else {
        return null;
    }
}


// Server action to save a client (create or update).
export async function saveClient(clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Client> {
    const { id, ...dataToSave } = clientData;
    
    // Sanitize and normalize phone number before saving
    let sanitizedPhone = dataToSave.phone.replace(/\D/g, '');
    if (sanitizedPhone.startsWith('0')) {
        sanitizedPhone = `972${sanitizedPhone.substring(1)}`;
    }
    
    const businessId = dataToSave.businessId || 'default';

    const { birthDate, createdAt, updatedAt, ...restData } = dataToSave as any;
    
    const processedData: Partial<ClientData> = {
        ...restData,
        phone: sanitizedPhone,
        businessId: businessId,
        updatedAt: Timestamp.now(),
        familyRelations: dataToSave.familyRelations || [],
    };

    if (birthDate) {
        // Ensure birthDate is a Date object before converting to Timestamp
        const date = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
        if (date instanceof Date && !isNaN(date.getTime())) {
            processedData.birthDate = Timestamp.fromDate(date);
        }
    }


    if (id) {
        // Update existing
        const clientRef = doc(db, 'clients', id);
        
        const cleanData = removeUndefined(processedData);
        await updateDoc(clientRef, cleanData);
        
        const updatedClientSnap = await getDoc(clientRef);
        return toClient(id, updatedClientSnap.data());

    } else {
        // Create new
        const existingUser = await findClientByPhone(sanitizedPhone, businessId);
        if(existingUser) {
             throw new Error(`Client with phone number ${sanitizedPhone} already exists in this business.`);
        }

        const newClientData = {
            ...processedData,
            createdAt: Timestamp.now(),
            status: 'new'
        };
        const docRef = await addDoc(clientsCollection, newClientData);
        return toClient(docRef.id, newClientData);
    }
}

// Server action to delete a client.
export async function deleteClient(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'clients', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting client:", error);
        return { success: false };
    }
}

// Server action to find a client by phone number within a specific business.
export async function findClientByPhone(phone: string, businessId: string = 'default'): Promise<Client | null> {
    let sanitizedPhone = phone.replace(/\D/g, '');
    // Normalize to 972... format if it starts with 0
    if (sanitizedPhone.startsWith('0')) {
        sanitizedPhone = `972${sanitizedPhone.substring(1)}`;
    }

    // Query 1: Find by phone and businessId (perfect match)
    const q1 = query(clientsCollection, where("phone", "==", sanitizedPhone), where("businessId", "==", businessId), limit(1));
    const snapshot1 = await getDocs(q1);

    if (!snapshot1.empty) {
        const docSnap = snapshot1.docs[0];
        return toClient(docSnap.id, docSnap.data());
    }

    // Query 2: Find legacy clients by phone (where businessId is missing)
    const q2 = query(clientsCollection, where("phone", "==", sanitizedPhone), limit(5));
    const snapshot2 = await getDocs(q2);

    if (!snapshot2.empty) {
        // Find a doc that does NOT have a businessId. This is our legacy client.
        const legacyDoc = snapshot2.docs.find(doc => !doc.data().businessId);
        if (legacyDoc) {
            return toClient(legacyDoc.id, legacyDoc.data());
        }
    }
    
    // No suitable client found
    return null;
}


export async function updateFamilyRelations(clientId: string, newRelations: FamilyRelation[], allClients: Client[]): Promise<{ success: boolean }> {
    const batch = writeBatch(db);
    const mainClientRef = doc(db, 'clients', clientId);

    // Get old relations to clean up inverse relations
    const mainClientSnap = await getDoc(mainClientRef);
    if (!mainClientSnap.exists()) {
        throw new Error("Main client not found");
    }
    const mainClient = toClient(mainClientSnap.id, mainClientSnap.data());
    const oldRelations = mainClient.familyRelations || [];

    // 1. Update the main client's relations
    batch.update(mainClientRef, { familyRelations: newRelations });

    const allRelationMemberIds = new Set([...oldRelations.map(r => r.memberId), ...newRelations.map(r => r.memberId)]);

    for (const memberId of allRelationMemberIds) {
        if (memberId === clientId) continue;

        const memberClient = allClients.find(c => c.id === memberId);
        if (!memberClient) continue;

        let memberRelations = memberClient.familyRelations || [];
        
        // Remove old inverse relation
        memberRelations = memberRelations.filter(r => r.memberId !== clientId);

        // Add new inverse relation if it exists
        const newRelationToThisMember = newRelations.find(r => r.memberId === memberId);
        if (newRelationToThisMember) {
            let inverseRel: Relationship | undefined;
            if (newRelationToThisMember.relation === 'brother') inverseRel = memberClient.gender === 'male' ? 'brother' : 'sister';
            else if (newRelationToThisMember.relation === 'sister') inverseRel = memberClient.gender === 'male' ? 'brother' : 'sister';
            else if (newRelationToThisMember.relation === 'son') inverseRel = mainClient.gender === 'male' ? 'father' : 'mother';
            else if (newRelationToThisMember.relation === 'daughter') inverseRel = mainClient.gender === 'male' ? 'father' : 'mother';
            else if (newRelationToThisMember.relation === 'father') inverseRel = mainClient.gender === 'male' ? 'son' : 'daughter';
            else if (newRelationToThisMember.relation === 'mother') inverseRel = mainClient.gender === 'male' ? 'son' : 'daughter';

            if (inverseRel) {
                 memberRelations.push({ memberId: clientId, relation: inverseRel });
            }
        }
        
        const memberRef = doc(db, 'clients', memberId);
        batch.update(memberRef, { familyRelations: memberRelations });
    }

    try {
        await batch.commit();
        return { success: true };
    } catch (error) {
        console.error("Error updating family relations:", error);
        return { success: false };
    }
}
