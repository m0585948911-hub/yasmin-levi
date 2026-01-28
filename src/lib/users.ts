

'use server';

import { collection, addDoc, getDocs, query, doc, updateDoc, deleteDoc, where, limit, writeBatch, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { removeUndefined } from './remove-undefined';

export type UserPermission = 'owner' | 'employee' | 'developer';

export interface EmployeePermissions {
    accessibleCalendars: string[];
    canApproveAppointments: boolean;
    canCancelAppointments: boolean;
    canChangeAppointments: boolean;
    canEditCalendarSettings: boolean;
    canViewClients: boolean;
    canManageClientRecords: boolean;
    canViewClientPhone: boolean;
}

export interface User {
    id: string;
    businessId?: string; // For multi-tenancy
    firstName: string;
    lastName: string;
    idNumber: string;
    email: string;
    phone: string; // Used for login
    password?: string; // Used for login, optional for security
    permission: UserPermission;
    gender: 'male' | 'female';
    isSuperAdmin?: boolean; 
    employeePermissions?: EmployeePermissions | null;
    avatarUrl?: string;
}

const usersCollection = collection(db, 'users');

async function initializeDefaultUsers() {
    const q = query(usersCollection);
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        console.log("No users found, initializing default users...");
        const batch = writeBatch(db);
        const defaultUsers: Omit<User, 'id'>[] = [
            { 
                businessId: 'default',
                firstName: "יסמין", 
                lastName: "לוי", 
                idNumber: "123456789",
                email: "yasmin@example.com",
                phone: "0509234865",
                password: "1",
                permission: 'owner',
                gender: 'female',
                isSuperAdmin: false,
            },
            {
                businessId: 'default',
                firstName: "שרה",
                lastName: "לוי",
                idNumber: "987654321",
                email: "sara@example.com",
                phone: "0521234567",
                password: "1",
                permission: 'employee',
                gender: 'female',
                isSuperAdmin: false,
                employeePermissions: {
                    accessibleCalendars: [],
                    canApproveAppointments: true,
                    canCancelAppointments: false,
                    canChangeAppointments: true,
                    canEditCalendarSettings: false,
                    canViewClients: true,
                    canManageClientRecords: false,
                    canViewClientPhone: false,
                },
            },
            {
                businessId: 'default',
                firstName: "admin",
                lastName: "",
                idNumber: "000000000",
                email: "admin@admin.com",
                phone: "039279898",
                password: "AX039279898",
                permission: 'developer',
                gender: 'male',
                isSuperAdmin: true, 
            }
        ];
        defaultUsers.forEach(user => {
            const docRef = doc(usersCollection);
            batch.set(docRef, user);
        });
        await batch.commit();
        console.log("Default users have been initialized.");
    } else {
        // Ensure admin user exists with correct password if db is not empty
        const adminQ = query(usersCollection, where("phone", "==", "039279898"));
        const adminSnapshot = await getDocs(adminQ);
        if (adminSnapshot.empty) {
            await addDoc(usersCollection, {
                businessId: 'default',
                firstName: "admin",
                lastName: "",
                idNumber: "000000000",
                email: "admin@admin.com",
                phone: "039279898",
                password: "AX039279898",
                permission: 'developer',
                gender: 'male',
                isSuperAdmin: true,
            });
        } else {
            const adminDoc = adminSnapshot.docs[0];
            const adminData = adminDoc.data();
            if (adminData.password !== "AX039279898" || adminData.isSuperAdmin !== true || adminData.permission !== 'developer') {
                await updateDoc(adminDoc.ref, { password: "AX039279898", isSuperAdmin: true, permission: 'developer' });
            }
        }
    }
}


// Server action to get all admin users.
export async function getUsers(): Promise<Omit<User, 'password'>[]> {
    await initializeDefaultUsers();
    const querySnapshot = await getDocs(query(usersCollection));
    return querySnapshot.docs.map(doc => {
        const { password, ...data } = doc.data() as Omit<User, 'id'>;
        return {
            id: doc.id,
            ...data,
        };
    });
}

// Server action to get a single user by ID.
export async function getUserById(id: string): Promise<User | null> {
    const docRef = doc(db, 'users', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return {
            id: docSnap.id,
            ...(docSnap.data() as Omit<User, 'id'>)
        };
    } else {
        return null;
    }
}

// Server action to find a user by phone number for login.
export async function findUserByPhone(phone: string): Promise<User | null> {
    await initializeDefaultUsers();
    const q = query(usersCollection, where("phone", "==", phone), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data() as Omit<User, 'id'>;
    return {
        id: docSnap.id,
        ...data,
    };
}


// Server action to save a user (create or update).
export async function saveUser(userData: Partial<User> & { id?: string }): Promise<User> {
    const { id, ...dataToSave } = userData;
    
    // Ensure a businessId exists, defaulting if necessary
    if (!dataToSave.businessId) {
        dataToSave.businessId = 'default';
    }
    
    // If user is owner, ensure employeePermissions is null/undefined
    if (dataToSave.permission === 'owner' || dataToSave.permission === 'developer' || dataToSave.isSuperAdmin) {
        dataToSave.employeePermissions = null;
    }

    if (id) {
        // Update existing user
        const userRef = doc(db, 'users', id);
        const cleanData = removeUndefined(dataToSave);
        await updateDoc(userRef, cleanData);
        const updatedDoc = await getDoc(userRef);
        return { id, ...(updatedDoc.data() as Omit<User, 'id'>) };
    } else {
        // Create new user
        const docRef = await addDoc(usersCollection, dataToSave);
        return { ...dataToSave, id: docRef.id } as User;
    }
}

// Server action to delete a user.
export async function deleteUser(id: string): Promise<{ success: boolean }> {
    try {
        await deleteDoc(doc(db, 'users', id));
        return { success: true };
    } catch (error) {
        console.error("Error deleting user:", error);
        return { success: false };
    }
}
