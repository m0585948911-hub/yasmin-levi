
'use server';

import { redirect } from 'next/navigation';
import { createNotification } from '@/lib/notifications';
import { createLog } from '@/lib/logs';
import { findUserByPhone, User, saveUser, getUserById } from '@/lib/users';


export async function adminLogin(formData: FormData) {
  const phone = formData.get('phone') as string;
  const password = formData.get('password') as string;

  const user = await findUserByPhone(phone);
  
  if (user && user.password === password) {
    await createLog({
        action: 'Admin Login',
        details: `Administrator ${user.firstName} ${user.lastName} logged in.`,
        user: `${user.firstName} ${user.lastName}`
    });
    const { password: _, ...userToStore } = user;
    return { success: true, user: userToStore };
  } else {
    return { error: 'מספר טלפון או סיסמה שגויים' };
  }
}

export async function sendNotification(formData: FormData) {
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const expiresAt = formData.get('expiresAt') as string;

    if (!title || !content || !expiresAt) {
        return { error: 'יש למלא את כל השדות' };
    }

    const result = await createNotification(title, content, new Date(expiresAt));
    
    if (result.success) {
        await createLog({
            action: 'Notification Sent',
            details: `Sent notification: "${title}"`,
            user: 'Admin (Yasmine Levi)'
        });
    }

    return result;
}

export async function updateAdminProfile(formData: FormData) {
    const userId = formData.get('userId') as string;
    if (!userId) {
        return { error: 'מזהה משתמש חסר.' };
    }

    const currentUser = await getUserById(userId);
    if (!currentUser) {
        return { error: 'משתמש לא נמצא.' };
    }
    
    const dataToUpdate: Partial<Omit<User, 'id'>> = {
        firstName: formData.get('firstName') as string,
        lastName: formData.get('lastName') as string,
    };

    const newPassword = formData.get('password') as string;
    if (newPassword) {
        dataToUpdate.password = newPassword;
    }

    const avatarUrl = formData.get('avatarUrl');
    if (avatarUrl) {
        (dataToUpdate as any).avatarUrl = avatarUrl as string;
    }
    
    try {
        const updatedUser = await saveUser({ id: userId, ...dataToUpdate });
        const { password: _, ...userToStore } = updatedUser;
        return { success: true, user: userToStore };

    } catch (error: any) {
        console.error("Error updating admin profile:", error);
        return { error: error.message || 'Failed to update profile.' };
    }
}
