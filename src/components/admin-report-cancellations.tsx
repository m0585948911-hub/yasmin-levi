
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Ban } from 'lucide-react';
import Link from 'next/link';
import { getAppointments, Appointment } from '@/lib/appointments';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export function AdminCancellationsReport() {
  const [cancellations, setCancellations] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCancellations = async () => {
      setIsLoading(true);
      try {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const fetchedCancellations = await getAppointments(monthStart, monthEnd, undefined, undefined, ['cancelled'], 'desc', undefined, 'client');
        setCancellations(fetchedCancellations);
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את רשימת הביטולים.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCancellations();
  }, [toast]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" passHref>
            <Button variant="outline">
              <ArrowLeft className="ml-2" />
              חזרה ללוח הבקרה
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">דוח ביטולים</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ביטולים על ידי לקוחות החודש ({format(new Date(), 'MMMM yyyy', { locale: he })})</CardTitle>
          <CardDescription>רשימת כל התורים שבוטלו על ידי לקוחות בחודש הנוכחי.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח/ה</TableHead>
                <TableHead>שירות</TableHead>
                <TableHead>תאריך התור המקורי</TableHead>
                <TableHead>הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-48">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : cancellations.length > 0 ? (
                cancellations.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.clientName}</TableCell>
                    <TableCell>{app.serviceName}</TableCell>
                    <TableCell>{format(new Date(app.start), 'd MMM, yyyy HH:mm', { locale: he })}</TableCell>
                    <TableCell>{app.notes}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-48">
                    לא נמצאו ביטולים על ידי לקוחות בחודש הנוכחי.
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
