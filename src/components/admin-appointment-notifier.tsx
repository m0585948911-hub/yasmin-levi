'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle, BellRing } from 'lucide-react';


interface AppNotification {
    clientName: string;
    date: string;
}

export function AdminAppointmentNotifier() {
  const router = useRouter();
  const isInitialLoad = useRef(true);
  const notifiedIds = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [newAppointment, setNewAppointment] = useState<AppNotification | null>(null);
  const [cancellationRequest, setCancellationRequest] = useState<AppNotification | null>(null);

  useEffect(() => {
    const now = new Date();
    // Listen for both pending appointments and cancellation requests
    const q = query(
        collection(db, 'appointments'), 
        where('status', 'in', ['pending', 'pending_cancellation']),
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
        const docId = change.doc.id;
        const data = change.doc.data();
        
        // This logic handles both new docs and modified docs that we haven't notified about yet.
        if (notifiedIds.current.has(docId) && change.type !== 'modified') {
             // If we've seen it and it's not a modification, skip.
             // We allow modified to pass for the cancellation request case.
             return;
        }

        const start = (data.start as Timestamp).toDate();
        const notificationPayload: AppNotification = {
            clientName: data.clientName,
            date: format(start, 'dd/MM/yyyy HH:mm', { locale: he }),
        };

        // A new appointment was created with 'pending' status
        if (change.type === 'added' && data.status === 'pending') {
            audioRef.current?.play().catch(e => console.error("Audio play failed", e));
            setNewAppointment(notificationPayload);
            notifiedIds.current.add(docId);
        }
        // An existing appointment's status was changed to 'pending_cancellation'
        else if (change.type === 'modified' && data.status === 'pending_cancellation') {
             audioRef.current?.play().catch(e => console.error("Audio play failed", e));
             setCancellationRequest(notificationPayload);
             notifiedIds.current.add(docId);
        }
      });
    });

    return () => unsubscribe();
  }, []);
  
  const handleViewRequest = () => {
    setNewAppointment(null);
    setCancellationRequest(null);
    router.push('/admin/appointments/pending');
  };

  return (
    <>
        <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf" preload="auto" />
        
        {/* Dialog for New Appointment Request */}
        <Dialog open={!!newAppointment} onOpenChange={() => setNewAppointment(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BellRing className="h-6 w-6 text-primary"/>
                        בקשת תור חדשה
                    </DialogTitle>
                    <DialogDescription>
                        התקבלה בקשה חדשה לתור מ: <span className="font-bold">{newAppointment?.clientName}</span>
                        <br />
                        לתאריך: {newAppointment?.date}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setNewAppointment(null)}>סגור</Button>
                    <Button onClick={handleViewRequest}>צפה בבקשות</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
         {/* Dialog for Cancellation Request */}
        <Dialog open={!!cancellationRequest} onOpenChange={() => setCancellationRequest(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-yellow-500"/>
                        בקשה לביטול תור
                    </DialogTitle>
                    <DialogDescription>
                        התקבלה בקשה לביטול תור מ: <span className="font-bold">{cancellationRequest?.clientName}</span>
                        <br />
                        עבור התאריך: {cancellationRequest?.date}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setCancellationRequest(null)}>סגור</Button>
                    <Button onClick={handleViewRequest}>צפה בבקשות</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  );
}
