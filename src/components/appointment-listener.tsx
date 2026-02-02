'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Appointment } from '@/lib/appointments';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';

interface AppNotification {
  id: string;
  title: string;
  content: string;
  expiresAt: Date;
  createdAt: Date;
}

const LinkifiedText = ({ text }: { text: string }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return (
        <p className="whitespace-pre-wrap">
            {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                    return (
                        <a
                            key={index}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 underline hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()} // Prevent dialog from closing if inside a trigger
                        >
                            {part}
                        </a>
                    );
                }
                return part;
            })}
        </p>
    );
};

export function AppointmentListener({ clientId }: { clientId: string }) {
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInitialLoad = useRef(true);

  // This effect for real-time appointment updates (e.g., from family members) remains.
  // The polling effect for general notifications is removed.
  // Real push notifications will be handled by PushNotificationHandler (foreground) 
  // and the service worker (background).

  // Effect for appointments created by other users (e.g. family member)
  useEffect(() => {
    if (!clientId) return;

    const notifiedAppointmentsKey = `notifiedAppointments_${clientId}`;
    const getNotifiedIds = () => {
        try {
            return JSON.parse(localStorage.getItem(notifiedAppointmentsKey) || '[]');
        } catch {
            return [];
        }
    };
    const addNotifiedId = (id: string) => {
        const ids = getNotifiedIds();
        if (!ids.includes(id)) {
            localStorage.setItem(notifiedAppointmentsKey, JSON.stringify([...ids, id]));
        }
    };

    const q = query(collection(db, 'appointments'), where('clientId', '==', clientId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      // On initial load, populate seen IDs to avoid old notifications
      if (isInitialLoad.current) {
        querySnapshot.forEach(doc => addNotifiedId(doc.id));
        isInitialLoad.current = false;
        return;
      }
      
      querySnapshot.docChanges().forEach((change) => {
        const appointmentId = change.doc.id;
        const notifiedIds = getNotifiedIds();
        
        if (change.type === 'added' && !notifiedIds.includes(appointmentId)) {
            const data = change.doc.data();
            const appointmentStart = (data.start as Timestamp).toDate();

            if (appointmentStart > new Date() && data.status === 'scheduled') {
                setNotification({
                  id: `new-appt-${appointmentId}`,
                  title: "לידיעתך, נקבע עבורך תור חדש",
                  content: `שירות: ${data.serviceName}\nבתאריך: ${format(appointmentStart, 'eeee, d MMMM yyyy', { locale: he })}\nבשעה: ${format(appointmentStart, 'HH:mm')}`,
                  expiresAt: appointmentStart, // The notification expires when the appointment starts
                  createdAt: new Date(),
                });
                setIsOpen(true);
                audioRef.current?.play().catch(e => console.error("Audio play failed", e));
                addNotifiedId(appointmentId);
            }
        }
      });
    });

    return () => unsubscribe();
  }, [clientId]);

  const handleConfirm = () => {
    // Only redirect if the notification is about an appointment status change
    const shouldRedirect = notification?.title.includes("אשר") || notification?.title.includes("נקבע");
    if (shouldRedirect) {
        const params = new URLSearchParams(searchParams.toString());
        router.push(`/my-appointments?${params.toString()}`);
    }
    setIsOpen(false);
    setNotification(null);
  };
  

  return (
    <>
      <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf" preload="auto" />
      {notification && (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                setIsOpen(false);
                setNotification(null);
            }
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{notification.title}</DialogTitle>
                    <DialogDescription asChild>
                         <div className="space-y-2 mt-4 text-center">
                            <LinkifiedText text={notification.content} />
                         </div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={handleConfirm}>
                        {notification.title.includes("אשר") || notification.title.includes("נקבע") ? "צפה בתורים שלי" : "הבנתי"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </>
  );
}
