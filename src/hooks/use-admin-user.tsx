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

  const setUser = (nextUser: User | null) => {
    setUserState(nextUser);
    if (nextUser) {
      localStorage.setItem('adminUser', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('adminUser');
    }
  };

  const setupAdminPushNotifications = useCallback(async (currentUser: User) => {
    if (!currentUser?.id) return;
    try {
      await registerPushToken(currentUser.id, 'users');
      console.log('[useAdminUser] Admin push notification setup initiated.');
    } catch (error) {
      console.error('[useAdminUser] An error occurred while setting up admin push notifications.', error);
    }
  }, []);

  useEffect(() => {
    const userJson = localStorage.getItem('adminUser');

    if (userJson) {
      try {
        const parsedUser: User = JSON.parse(userJson);
        setUserState(parsedUser);

        // After user is loaded, try to set up push notifications
        setupAdminPushNotifications(parsedUser);
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
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
    );
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
