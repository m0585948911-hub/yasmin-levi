'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useAdminUser } from '@/hooks/use-admin-user';
import { getReminders, updateReminderStatus, updateReminderTime, Reminder } from '@/lib/reminders';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { format, addMinutes } from 'date-fns';
import { he } from 'date-fns/locale';
import { BellRing, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export function AdminReminderNotifier() {
    const { user } = useAdminUser();
    const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [newReminderTime, setNewReminderTime] = useState('');
    const [isMutating, startMutation] = useTransition();
    const router = useRouter();
    const { toast } = useToast();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const checkedReminders = useRef(new Set<string>());

    useEffect(() => {
        if (!user?.id) return;

        const checkReminders = async () => {
            // Don't interrupt if a dialog is already open or tab is not visible
            if (activeReminder || isRescheduleOpen || document.hidden) return;
            
            const now = new Date();
            const pendingReminders = await getReminders(['pending'], undefined, undefined, user.id);
            
            for (const reminder of pendingReminders) {
                if (new Date(reminder.notificationTime) <= now && !checkedReminders.current.has(reminder.id)) {
                    setActiveReminder(reminder);
                    audioRef.current?.play().catch(console.error);
                    // Mark as checked for this session to avoid repeated popups for the same reminder
                    checkedReminders.current.add(reminder.id);
                    break; // Show one at a time
                }
            }
        };

        const intervalId = setInterval(checkReminders, 20000); // check every 20 seconds
        checkReminders(); // Initial check

        return () => clearInterval(intervalId);
    }, [user, activeReminder, isRescheduleOpen]);

    const closeMainDialog = () => {
        setActiveReminder(null);
    };

    const handleDismiss = () => {
        if (!activeReminder) return;
        startMutation(async () => {
            await updateReminderStatus(activeReminder.id, 'done');
            toast({ title: 'התזכורת טופלה' });
            closeMainDialog();
        });
    };

    const handleHandleNow = () => {
        if (!activeReminder) return;
        startMutation(async () => {
            await updateReminderStatus(activeReminder.id, 'done');
            router.push(`/admin/clients/${activeReminder.clientId}`);
            closeMainDialog();
        });
    };

    const handleSnooze = () => {
        if (!activeReminder) return;
        startMutation(async () => {
            const newTime = addMinutes(new Date(), 15).toISOString();
            await updateReminderTime(activeReminder.id, newTime);
            toast({ title: 'התזכורת נדחתה', description: 'תקבל תזכורת נוספת בעוד 15 דקות.' });
            closeMainDialog();
        });
    };

    const handleOpenReschedule = () => {
        if (!activeReminder) return;
        const now = new Date();
        const reminderDate = new Date(activeReminder.reminderAt);
        // Set default to current reminder time if it's in the future, otherwise now + 1 hour
        const defaultTime = reminderDate > now ? reminderDate : addMinutes(now, 60);
        setNewReminderTime(format(defaultTime, "yyyy-MM-dd'T'HH:mm"));
        setIsRescheduleOpen(true);
    };
    
    const handleSaveReschedule = () => {
        if (!activeReminder || !newReminderTime) return;
        startMutation(async () => {
            await updateReminderTime(activeReminder.id, newReminderTime);
            toast({ title: 'התזכורת תוזמנה מחדש' });
            setIsRescheduleOpen(false);
            closeMainDialog();
        });
    };

    return (
        <>
            <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/MP3%2Fsound-email-received.mp3?alt=media&token=ba9b57a8-bfa9-4fb0-98a5-6290616479cf" preload="auto" />
            
            <Dialog open={!!activeReminder} onOpenChange={(isOpen) => !isOpen && closeMainDialog()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <BellRing className="h-6 w-6 text-primary" />
                            תזכורת לטיפול
                        </DialogTitle>
                        <DialogDescription>
                            בתאריך {activeReminder && format(new Date(activeReminder.reminderAt), 'd MMMM, HH:mm', { locale: he })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <p><strong>לקוח/ה:</strong> <Link href={`/admin/clients/${activeReminder?.clientId}`} className="text-primary hover:underline">{activeReminder?.clientName}</Link></p>
                        <p className="font-semibold">פרטי התזכורת:</p>
                        <p className="p-2 bg-accent rounded-md border text-sm">{activeReminder?.summary}</p>
                    </div>
                    <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-between">
                         <Button variant="outline" onClick={handleDismiss} disabled={isMutating}>
                            טופל
                        </Button>
                        <div className="flex justify-end gap-2 col-span-2 sm:col-span-1">
                            <Button variant="secondary" onClick={handleOpenReschedule} disabled={isMutating}>שנה מועד</Button>
                            <Button variant="secondary" onClick={handleSnooze} disabled={isMutating}>אטפל בהמשך</Button>
                            <Button onClick={handleHandleNow} disabled={isMutating}>טפל עכשיו</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>תזמון מחדש</DialogTitle>
                        <DialogDescription>בחר מועד חדש לתזכורת.</DialogDescription>
                    </DialogHeader>
                     <div className="py-4 space-y-2">
                        <Label htmlFor="new-reminder-time">תאריך ושעה חדשים</Label>
                        <Input 
                            id="new-reminder-time" 
                            type="datetime-local" 
                            value={newReminderTime}
                            onChange={(e) => setNewReminderTime(e.target.value)} 
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRescheduleOpen(false)}>ביטול</Button>
                        <Button onClick={handleSaveReschedule} disabled={isMutating}>
                            {isMutating ? <Loader2 className="animate-spin" /> : 'שמור מועד חדש'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
