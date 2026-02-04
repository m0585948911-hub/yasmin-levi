
'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Trash2, Check, X, Phone, User, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { getWaitingListRequests, updateWaitingListRequestStatus, deleteWaitingListRequest, WaitingListRequest } from '@/lib/waiting-list';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { WhatsAppIcon } from './whatsapp-icon';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { getClientById } from '@/lib/clients';

export function AdminWaitingList() {
  const [requests, setRequests] = useState<WaitingListRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, startMutation] = useTransition();
  const { toast } = useToast();

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
        const fetchedRequests = await getWaitingListRequests();
        const requestsWithDetails = await Promise.all(fetchedRequests.map(async (req) => {
            const client = await getClientById(req.clientId);
            return {
                ...req,
                clientName: client ? `${client.firstName} ${client.lastName}` : 'לקוח לא ידוע',
                clientPhone: client?.phone,
                createdAt: new Date(req.createdAt),
            };
        }));
        
        setRequests(requestsWithDetails.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));

    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את רשימת ההמתנה.' });
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = (id: string, status: WaitingListRequest['status']) => {
      startMutation(async () => {
          const result = await updateWaitingListRequestStatus(id, status);
          if (result.success) {
              toast({ title: 'הצלחה', description: 'סטטוס הבקשה עודכן.' });
              fetchRequests();
          } else {
              toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לעדכן את הסטטוס.' });
          }
      });
  }

  const handleDelete = (id: string) => {
      startMutation(async () => {
          const result = await deleteWaitingListRequest(id);
          if (result.success) {
              toast({ title: 'הצלחה', description: 'הבקשה נמחקה.' });
              fetchRequests();
          } else {
              toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את הבקשה.' });
          }
      });
  }
  
  const formatWhatsAppLink = (phone?: string): string => {
    if (!phone) return '#';
    let cleanedPhone = phone.replace(/[^0-9]/g, '');
    if (cleanedPhone.startsWith('0')) {
        return `https://wa.me/972${cleanedPhone.substring(1)}`;
    }
    return `https://wa.me/${cleanedPhone}`;
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
                <h1 className="text-2xl font-bold">רשימת המתנה</h1>
            </div>
        </div>

      <Card>
        <CardHeader>
            <CardTitle>בקשות ממתינות</CardTitle>
            <CardDescription>כאן ניתן לראות בקשות של לקוחות שלא מצאו תור פנוי.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>לקוח/ה</TableHead>
                  <TableHead>שירותים מבוקשים</TableHead>
                  <TableHead>הודעה</TableHead>
                  <TableHead>תאריך בקשה</TableHead>
                  <TableHead className="text-center">סטטוס ופעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-48">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : requests.length > 0 ? (
                  requests.map((req) => (
                    <TableRow key={req.id} className={req.status !== 'new' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                          <div className='flex items-center gap-2'>
                              <User className="h-4 w-4 text-muted-foreground"/>
                               {req.clientName}
                          </div>
                          {req.clientPhone && (
                              <div className='flex items-center gap-2 text-sm text-muted-foreground mt-1'>
                                  <Phone className="h-4 w-4"/>
                                  <a href={`tel:${req.clientPhone}`} className="hover:underline">{req.clientPhone}</a>
                              </div>
                          )}
                      </TableCell>
                      <TableCell>{req.selectedServices.map(s => s.name).join(', ')}</TableCell>
                      <TableCell className='max-w-xs'>
                        <Tooltip>
                            <TooltipTrigger>
                                <p className="truncate">{req.message}</p>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="start">
                                <p className="max-w-xs whitespace-pre-wrap">{req.message}</p>
                            </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(req.createdAt, 'dd/MM/yy HH:mm', { locale: he })}
                      </TableCell>
                      <TableCell>
                          <div className="flex items-center justify-center gap-2">
                             {req.status === 'new' && (
                                 <>
                                    <Button size="icon" variant="outline" className="text-green-600 border-green-600 hover:bg-green-100" onClick={() => handleUpdateStatus(req.id, 'contacted')} disabled={isMutating}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <a href={formatWhatsAppLink(req.clientPhone)} target="_blank" rel="noopener noreferrer">
                                        <Button size="icon" variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-100">
                                            <MessageCircle className="h-4 w-4"/>
                                        </Button>
                                    </a>
                                 </>
                             )}
                              {req.status === 'contacted' && (
                                 <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(req.id, 'resolved')} disabled={isMutating}>
                                    טופל
                                </Button>
                             )}
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(req.id)} disabled={isMutating}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-48">
                      רשימת ההמתנה ריקה.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
           </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}
