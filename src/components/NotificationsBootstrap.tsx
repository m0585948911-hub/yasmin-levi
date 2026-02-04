'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AppointmentListener } from '@/components/appointment-listener';
import { registerPushToken } from '@/lib/push';

const LS_CLIENT_ID = 'current_client_id';

/**
 * Client-side bootstrap:
 * 1) Persist clientId (from URL ?id=...) into localStorage
 * 2) Register push token for the client
 * 3) Mount AppointmentListener globally to show in-app dialog + sound (foreground)
 */
export default function NotificationsBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ We only run this for the CLIENT side, not admin routes
  const isAdminRoute = pathname.startsWith('/admin');

  const [clientId, setClientId] = useState<string | null>(null);

  // 1) Load/persist clientId
  useEffect(() => {
    if (isAdminRoute) return;

    const idFromUrl = searchParams.get('id');
    if (idFromUrl) {
      localStorage.setItem(LS_CLIENT_ID, idFromUrl);
      setClientId(idFromUrl);
      return;
    }

    const saved = localStorage.getItem(LS_CLIENT_ID);
    if (saved) {
      setClientId(saved);
    }
  }, [isAdminRoute, searchParams]);

  // 2) Register token whenever we have clientId
  useEffect(() => {
    if (isAdminRoute) return;
    if (!clientId) return;

    registerPushToken(clientId, 'clients').catch((e) => {
      console.error('[NotificationsBootstrap] registerPushToken failed:', e);
    });
  }, [isAdminRoute, clientId]);

  // 3) Mount in-app listener (Dialog + sound)
  if (isAdminRoute) return null;
  if (!clientId) return null;

  return <AppointmentListener clientId={clientId} />;
}
