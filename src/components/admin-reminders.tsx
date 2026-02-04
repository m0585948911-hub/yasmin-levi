'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Trash2, CheckCircle, BellRing, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getReminders, updateReminderStatus, deleteReminder, Reminder } from '@/lib/reminders';
import { getUsers, User } from '@/lib/users';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function AdminReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, startMutation] = useTransition();
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedReminders, fetchedUsers] = await Promise.all([
        getReminders(),
        getUsers(),
      ]);
      setReminders(fetchedReminders);
      setUsers(fetchedUsers);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את רשימת התזכורות.' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = (id: string, status: Reminder['status']) => {
    startMutation(async () => {
      const result = await updateReminderStatus(id, status);
      if (result.success) {
        toast({ title: 'הצלחה', description: 'סטטוס התזכורת עודכן.' });
        fetchData();
      } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לעדכן את הסטטוס.' });
      }
    });
  }

  const handleDelete = (id: string) => {
    startMutation(async () => {
      const result = await deleteReminder(id);
      if (result.success) {
        toast({ title: 'הצלחה', description: 'התזכורת נמחקה.' });
        fetchData();
      } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את התזכורת.' });
      }
    });
  }

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : 'לא ידוע';
  }
  
  const getStatusBadge = (status: Reminder['status']) => {
    switch(status) {
        case 'pending': return <Badge variant="outline" className="text-orange-500 border-orange-500">ממתין</Badge>;
        case 'sent': return <Badge variant="secondary" className="text-blue-500">נשלח</Badge>;
        case 'done': return <Badge variant="secondary" className="text-green-500">טופל</Badge>;
        case 'error': return <Badge variant="destructive">שגיאה</Badge>;
        default: return <Badge>{status}</Badge>;
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin" passHref>
            <Button variant="outline">
              <ArrowLeft className="ml-2" />
              חזרה
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">תזכורות</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>רשימת תזכורות</CardTitle>
          <CardDescription>כאן ניתן לראות את כל התזכורות שנוצרו מיומן התקשורת.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח/ה</TableHead>
                <TableHead>תוכן</TableHead>
                <TableHead>תאריך ושעה</TableHead>
                <TableHead>עבור</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : reminders.length > 0 ? (
                reminders.map((reminder) => (
                  <TableRow key={reminder.id} className={cn(reminder.status === 'done' && 'opacity-50')}>
                    <TableCell className="font-medium">
                        <Link href={`/admin/clients/${reminder.clientId}`} className="hover:underline">
                            {reminder.clientName}
                        </Link>
                    </TableCell>
                    <TableCell>{reminder.summary}</TableCell>
                    <TableCell>{format(new Date(reminder.reminderAt), 'd MMM yyyy, HH:mm', { locale: he })}</TableCell>
                    <TableCell>{getUserName(reminder.userId)}</TableCell>
                    <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                    <TableCell className="text-right">
                        {reminder.status !== 'done' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isMutating}>
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>האם לסמן כתזכורת שטופלה?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleUpdateStatus(reminder.id, 'done')}>סמן כטופל</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isMutating}>
                                    <Trash2 className="h-5 w-5 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>האם למחוק את התזכורת?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(reminder.id)}>מחק</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-48">
                    לא נמצאו תזכורות.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
