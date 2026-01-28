
'use client';

import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export function AdminAppointmentNotifier() {
  const { toast } = useToast();
  const router = useRouter();
  const isInitialLoad = useRef(true);
  const notifiedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = new Date();
    // This query now works because a composite index has been created in Firestore.
    const q = query(
        collection(db, 'appointments'), 
        where('status', '==', 'pending'),
        where('start', '>=', now)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // On initial load, populate the notified IDs set to prevent old notifications
      if (isInitialLoad.current) {
        querySnapshot.forEach(doc => notifiedIds.current.add(doc.id));
        isInitialLoad.current = false;
        return;
      }

      querySnapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !notifiedIds.current.has(change.doc.id)) {
            const data = change.doc.data();
            const start = (data.start as Timestamp).toDate();
            toast({
                title: "בקשת תור חדשה",
                description: `מאת: ${data.clientName} לתאריך ${format(start, 'dd/MM/yyyy HH:mm', { locale: he })}`,
                action: (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => router.push('/admin/appointments/pending')}
                    >
                        צפה בבקשות
                    </Button>
                ),
                duration: 10000,
            });
            notifiedIds.current.add(change.doc.id);
        }
      });
    });

    return () => unsubscribe();
  }, [toast, router]);

  return null; // This component doesn't render anything itself
}
