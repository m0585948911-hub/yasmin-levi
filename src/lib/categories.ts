'use server';

import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export interface Category {
    id: string;
    name: string;
    sortOrder: number;
    imageUrl?: string;
}

const categoriesCollection = collection(db, 'categories');

// Server action to get all categories, ordered by sortOrder.
export async function getCategories(): Promise<Category[]> {
    const q = query(categoriesCollection, orderBy("sortOrder"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Category, 'id'>)
    }));
}

// Server action to save a category (create or update).
export async function saveCategory(categoryData: Omit<Category, 'id'> & { id?: string }): Promise<Category> {
    const { id, ...dataToSave } = categoryData;
    
    if (id) {
        // Update existing
        const categoryRef = doc(db, 'categories', id);
        await updateDoc(categoryRef, dataToSave);
        return { ...dataToSave, id };
    } else {
        // Create new
        const docRef = await addDoc(categoriesCollection, dataToSave);
        return { ...dataToSave, id: docRef.id };
    }
}

// Server action to delete a category.
export async function deleteCategory(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'categories', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting category:", error);
        return { success: false };
    }
}
