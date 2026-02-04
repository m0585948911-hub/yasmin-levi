

'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, ArrowLeft, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { getLogs, Log, clearLogs, deleteLog } from '@/lib/logs';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
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
import { useToast } from '@/hooks/use-toast';

export function AdminActivity() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isDeletingSingle, startSingleDeleteTransition] = useTransition();
  const { toast } = useToast();

  const fetchLogs = async () => {
    setIsLoading(true);
    const fetchedLogs = await getLogs();
    const sortedLogs = fetchedLogs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp)
    })).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
    setLogs(sortedLogs);
    setIsLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => logs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term) ||
      log.user.toLowerCase().includes(term)
    );
  }), [logs, searchTerm]);

  const handleClearLogs = () => {
    startDeleteTransition(async () => {
        const result = await clearLogs();
        if(result.success) {
            toast({
                title: "הצלחה!",
                description: "כל הלוגים נמחקו בהצלחה."
            });
            fetchLogs(); // Refresh the list
        } else {
             toast({
                variant: "destructive",
                title: "שגיאה",
                description: result.error || "לא ניתן היה למחוק את הלוגים."
            });
        }
    });
  }

  const handleDeleteLog = (logId: string) => {
    startSingleDeleteTransition(async () => {
        const result = await deleteLog(logId);
        if(result.success) {
            toast({
                title: "הצלחה!",
                description: "הרשומה נמחקה."
            });
            fetchLogs();
        } else {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: result.error || "לא ניתן היה למחוק את הרשומה."
            });
        }
    });
  };

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
                <h1 className="text-2xl font-bold">מעקב פעילות</h1>
            </div>
             <div className="flex items-center gap-2">
                <div className="relative">
                    <Input
                        placeholder="חיפוש בלוגים..."
                        className="pr-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                     {searchTerm && (
                        <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-2" onClick={() => setSearchTerm('')}>
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <Button variant="outline" size="icon"><Search className="h-5 w-5"/></Button>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon"><Trash2 className="h-5 w-5"/></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
                        <AlertDialogDescription>
                            פעולה זו תמחק את כל היסטוריית הפעילות לצמיתות. לא ניתן לשחזר את הפעולה.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearLogs} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="animate-spin" /> : 'מחק הכל'}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>

      <Card>
        <CardHeader>
            <CardTitle>היסטוריית פעולות</CardTitle>
            <CardDescription>כאן ניתן לראות את כל הפעולות שבוצעו במערכת.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>פעולה</TableHead>
                  <TableHead>פרטים</TableHead>
                  <TableHead>משתמש</TableHead>
                  <TableHead>תאריך ושעה</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-48">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>{log.details}</TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(log.timestamp, 'd MMM, yyyy HH:mm:ss', { locale: he })}
                      </TableCell>
                       <TableCell className="text-right">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>האם למחוק רשומה זו?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        הפעולה תמחק את הרשומה לצמיתות. לא ניתן לשחזר.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteLog(log.id)} disabled={isDeletingSingle}>
                                        {isDeletingSingle ? <Loader2 className="animate-spin" /> : 'מחק'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-48">
                      לא נמצאו רשומות פעילות.
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
