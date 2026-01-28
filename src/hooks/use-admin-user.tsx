

'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { User, EmployeePermissions } from '@/lib/users';
import { Loader2 } from 'lucide-react';
import { registerPushToken } from '@/lib/push';


type AdminUserContextType = {
    user: User | null;
    permissions: EmployeePermissions;
    isLoading: boolean;
    setUser: (user: User | null) => void;
};

const AdminUserContext = createContext<AdminUserContextType | null>(null);

const defaultPermissions: EmployeePermissions = {
    accessibleCalendars: [],
    canApproveAppointments: false,
    canCancelAppointments: false,
    canChangeAppointments: false,
    canEditCalendarSettings: false,
    canManageClientRecords: false,
    canViewClients: false,
    canViewClientPhone: false,
};

const ownerPermissions: EmployeePermissions = {
    accessibleCalendars: ['*'], // Special value for all
    canApproveAppointments: true,
    canCancelAppointments: true,
    canChangeAppointments: true,
    canEditCalendarSettings: true,
    canManageClientRecords: true,
    canViewClients: true,
    canViewClientPhone: true,
};

export const AdminUserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUserState] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const setUser = (user: User | null) => {
        setUserState(user);
        if (user) {
            localStorage.setItem('adminUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('adminUser');
        }
    }
    
    const setupAdminPushNotifications = useCallback(async (currentUser: User) => {
        if (!currentUser?.id) return;
        
        try {
            // Use the centralized registration function
            await registerPushToken(currentUser.id, 'users');
            console.log('Admin push notification setup initiated.');
        } catch (error) {
          console.error('An error occurred while setting up admin push notifications.', error);
        }
    }, []);

    useEffect(() => {
        const userJson = localStorage.getItem('adminUser');
        if (userJson) {
            try {
                const parsedUser = JSON.parse(userJson);
                setUserState(parsedUser);
                // After user is loaded, try to set up push notifications
                setupAdminPushNotifications(parsedUser);
            } catch (e) {
                console.error("Failed to parse user from localStorage", e);
                setUserState(null);
            }
        } else if (pathname !== '/admin/login') {
             // If no user and not on login page, redirect
             router.push('/admin/login');
        }
        setIsLoading(false);
    }, [pathname, router, setupAdminPushNotifications]);

    const permissions = useMemo(() => {
        if (!user) return defaultPermissions;
        if (user.isSuperAdmin || user.permission === 'developer' || user.permission === 'owner') return ownerPermissions;
        return user.employeePermissions || defaultPermissions;
    }, [user]);
    
    // For owner, ensure accessibleCalendars is all calendars
    if(permissions.accessibleCalendars[0] === '*') {
        // In a real app with dynamic calendars, we'd fetch them here.
        // For now, we assume this is handled where needed.
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
     if (!user && pathname !== '/admin/login') {
        // Render loading while redirecting
        return (
             <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <AdminUserContext.Provider value={{ user, permissions, isLoading, setUser }}>
            {children}
        </AdminUserContext.Provider>
    );
};

export const useAdminUser = () => {
    const context = useContext(AdminUserContext);
    if (!context) {
        throw new Error('useAdminUser must be used within an AdminUserProvider');
    }
    return context;
};
