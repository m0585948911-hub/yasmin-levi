
'use server';

import { redirect } from 'next/navigation';
import { createLog } from '@/lib/logs';
import { findClientByPhone, saveClient, Client, getClientById } from '@/lib/clients';
import { revalidatePath } from 'next/cache';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAppointmentById, saveAppointment } from '@/lib/appointments';

export async function login(formData: FormData) {
  const phoneInput = formData.get('phone') as string;

  if (!phoneInput) {
    return { success: false, error: 'Phone number is missing.' };
  }
  
  const sanitizedPhone = phoneInput.replace(/\D/g, '');

  const existingUser = await findClientByPhone(sanitizedPhone);
  
  if (existingUser) {
    await createLog({
        action: 'User Login',
        details: `User ${existingUser.firstName} ${existingUser.lastName} logged in.`,
        user: `${existingUser.firstName} ${existingUser.lastName}`
    });
    
    const params = new URLSearchParams();
    params.append('firstName', existingUser.firstName);
    params.append('lastName', existingUser.lastName);
    params.append('gender', existingUser.gender);
    params.append('id', existingUser.id);
    params.append('phone', existingUser.phone);
    return { success: true, redirectUrl: `/dashboard?${params.toString()}` };

  } else {
    // User does not exist, signal to the client to open registration dialog
    return { success: false, reason: 'not_found', phone: sanitizedPhone };
  }
}

export async function register(formData: FormData) {
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;
  const birthDate = formData.get('birthDate') as string;
  const gender = formData.get('gender') as 'male' | 'female';
  
  const sanitizedPhone = phone.replace(/\D/g, '');
  
  const newClientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
    businessId: 'default',
    firstName,
    lastName,
    phone: sanitizedPhone,
    gender,
    isBlocked: false,
    receivesSms: true,
  };

  if (email) {
    (newClientData as Partial<Client>).email = email;
  }
  
  if (birthDate) {
    (newClientData as Partial<Client>).birthDate = birthDate;
  }

  const newUser = await saveClient(newClientData);

  await createLog({
    action: 'New Client Registration',
    details: `New client created: ${newUser.firstName} ${newUser.lastName}`,
    user: `${newUser.firstName} ${newUser.lastName}`
  });

  const params = new URLSearchParams();
  params.append('firstName', newUser.firstName);
  params.append('lastName', newUser.lastName);
  params.append('gender', newUser.gender);
  params.append('id', newUser.id);
  params.append('phone', newUser.phone);
  return { success: true, redirectUrl: `/dashboard?${params.toString()}` };
}

export async function updateProfile(formData: FormData) {
  const clientId = formData.get('clientId') as string;
  if (!clientId) {
    return { error: 'Client ID is missing.' };
  }

  const currentClient = await getClientById(clientId);
  if (!currentClient) {
     return { error: 'Client not found.' };
  }

  const dataToUpdate: Partial<Omit<Client, 'id' | 'createdAt' | 'updatedAt'>> = {
    firstName: formData.get('firstName') as string,
    lastName: formData.get('lastName') as string,
    email: formData.get('email') as string,
    gender: formData.get('gender') as 'male' | 'female',
  };
  
  const birthDate = formData.get('birthDate') as string;
  if (birthDate) {
    dataToUpdate.birthDate = birthDate;
  }


  const avatarUrl = formData.get('avatarUrl');
  if (avatarUrl) {
    (dataToUpdate as any).avatarUrl = avatarUrl as string;
  }
  
  try {
    const updatedClient = await saveClient({ ...currentClient, ...dataToUpdate, id: clientId });
    
    revalidatePath('/dashboard');
    revalidatePath('/profile');
    
    const params = new URLSearchParams();
    params.append('id', updatedClient.id);
    params.append('firstName', updatedClient.firstName);
    params.append('lastName', updatedClient.lastName);
    params.append('gender', updatedClient.gender);
    params.append('phone', updatedClient.phone);

    return { success: true, newParams: params.toString() };

  } catch (error: any) {
    console.error("Error updating profile:", error);
    return { error: error.message || 'Failed to update profile.' };
  }
}

export async function confirmArrival(appointmentId: string): Promise<{ success: boolean; error?: string }> {
    if (!appointmentId) {
        return { success: false, error: 'Appointment ID is missing.' };
    }

    try {
        const appointmentRef = doc(db, 'appointments', appointmentId);
        await updateDoc(appointmentRef, { arrivalConfirmed: true });

        const appointment = await getAppointmentById(appointmentId);
        if (appointment) {
             await createLog({
                action: 'Arrival Confirmed by Client',
                details: `Client ${appointment.clientName} confirmed arrival for appointment on ${new Date(appointment.start).toLocaleString()}.`,
                user: appointment.clientName
            });
        }
        
        revalidatePath('/my-appointments');
        revalidatePath('/admin/calendar');
        return { success: true };
    } catch (error: any) {
        console.error("Error confirming arrival:", error);
        return { success: false, error: error.message || 'Failed to confirm arrival.' };
    }
}
