
'use server';

import { collection, addDoc, getDocs, query, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export type FormFieldType = "text" | "textarea" | "select" | "checkbox" | "image" | "title" | "subtitle" | "personalDetails" | "contentWithConsent" | "signature";

export interface FormField {
    id: string;
    label: string;
    type: FormFieldType;
    options: string[];
    sortOrder: number;
    imageCount: number;
    required: boolean;
}

export interface TreatmentFormTemplate {
  id: string;
  name: string;
  fields: FormField[];
  serviceIds?: string[];
  type: 'treatment' | 'summary';
}

export interface SignatureDetails {
  signatureImageStoragePath: string;
  signedByName: string;
  signedAt: string; // ISO String
  userAgent: string;
  ipHash: string;
  dataHash: string;
}

export interface FilledFormInstance {
  instanceId: string;
  templateId: string;
  templateName: string;
  status: 'draft' | 'completed' | 'signed' | 'pending_client_fill';
  assignedAt: string;
  filledAt?: string; // ISO date string
  appointmentId?: string;
  data: {
    [fieldId: string]: string | boolean | string[];
  };
  signatureDetails?: SignatureDetails;
  clientId: string;
}


const templatesCollection = collection(db, 'formTemplates');

export async function getFormTemplates(): Promise<TreatmentFormTemplate[]> {
    const q = query(templatesCollection, orderBy("name"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<TreatmentFormTemplate, 'id'>)
    }));
}

export async function saveFormTemplate(templateData: Omit<TreatmentFormTemplate, 'id'> & { id?: string }): Promise<TreatmentFormTemplate> {
    const { id, ...dataToSave } = templateData;
    
    if (id) {
        // Update existing or create new with a specific ID (upsert)
        const templateRef = doc(db, 'formTemplates', id);
        await setDoc(templateRef, dataToSave, { merge: true });
        return { ...dataToSave, id };
    } else {
        // Create new with a Firestore-generated ID
        const docRef = await addDoc(templatesCollection, dataToSave);
        return { ...dataToSave, id: docRef.id };
    }
}

export async function deleteFormTemplate(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'formTemplates', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting form template:", error);
        return { success: false };
    }
}

export async function deleteFormInstance(instanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await deleteDoc(doc(db, 'formInstances', instanceId));
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting form instance:", error);
        return { success: false, error: error.message };
    }
}
