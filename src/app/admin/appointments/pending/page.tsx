

'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, Check, X, Phone, Calendar, ThumbsUp, FileText, Eye } from 'lucide-react';
import Link from 'next/link';
import { getPendingAppointments, updateAppointmentStatus, Appointment } from '@/lib/appointments';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { createLog } from '@/lib/logs';
import { WhatsAppIcon } from '@/components/whatsapp-icon';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import type { TreatmentFormTemplate, FilledFormInstance } from '@/lib/form-templates';

const SETTINGS_STORAGE_KEY = 'appGeneralSettings';


// Helper to get data from localStorage
const getFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};


const ViewTreatmentHistoryDialog = ({
  isOpen,
  onOpenChange,
  clientName,
  history,
  templates,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  history: FilledFormInstance[];
  templates: TreatmentFormTemplate[];
}) => {

  const [viewingInstance, setViewingInstance] = useState<FilledFormInstance | null>(null);

  const handleViewInstance = (instance: FilledFormInstance) => {
    setViewingInstance(instance);
  }
  
  const getTemplateForInstance = (instance: FilledFormInstance | null) => {
    if (!instance) return null;
    return templates.find(t => t.id === instance.templateId) || null;
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>היסטוריית טיפולים עבור: {clientName}</DialogTitle>
          <DialogDescription>צפייה ברשומות הטיפולים הקודמות של הלקוח.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ScrollArea className="h-96">
            {history.length > 0 ? (
                <div className="space-y-3 pr-4">
                {history.map(instance => (
                    <Card key={instance.instanceId} className="bg-accent/50">
                        <CardHeader className="py-3 px-4">
                            <div className="flex justify-between items-center">
                            <CardTitle className="text-base flex-grow">{getTemplateForInstance(instance)?.name || instance.templateName}</CardTitle>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {instance.filledAt ? new Date(instance.filledAt).toLocaleString('he-IL') : ''}
                                </span>
                                <Button variant="ghost" size="icon" onClick={() => handleViewInstance(instance)}>
                                    <Eye className="w-4 h-4 text-blue-600" />
                                </Button>
                            </div>
                            </div>
                        </CardHeader>
                    </Card>
                ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-8">לא נמצאה היסטוריית טיפולים ללקוח זה.</p>
            )}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Nested Dialog for viewing a single instance */}
     <Dialog open={!!viewingInstance} onOpenChange={() => setViewingInstance(null)}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTemplateForInstance(viewingInstance)?.name}</DialogTitle>
          <DialogDescription>
            פרטי הטיפול מתאריך: {viewingInstance && viewingInstance.filledAt ? new Date(viewingInstance.filledAt).toLocaleString('he-IL') : 'לא זמין'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {viewingInstance && getTemplateForInstance(viewingInstance)?.fields.sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0)).map(field => (
            <div key={field.id} className="flex flex-col gap-1">
              <Label className="font-semibold">{field.label}</Label>
              {field.type === 'image' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {(viewingInstance.data[field.id] as string[] || []).map((imgSrc, idx) => (
                    <div key={idx} className="relative aspect-square w-full">
                      <Image src={imgSrc} alt={`${field.label} ${idx + 1}`} layout="fill" className="object-cover rounded-md border" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2 text-sm bg-accent rounded-md min-h-[36px] border">
                  {typeof viewingInstance.data[field.id] === 'boolean'
                    ? (viewingInstance.data[field.id] ? 'כן' : 'לא')
                    : (viewingInstance.data[field.id] as string || ' - ')}
                </div>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setViewingInstance(null)}>סגירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};


export default function PendingAppointmentsPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, startTransition] = useTransition();
    const { toast } = useToast();
    const [allTemplates, setAllTemplates] = useState<TreatmentFormTemplate[]>([]);
    const [selectedClientHistory, setSelectedClientHistory] = useState<{name: string, history: FilledFormInstance[] } | null>(null);

    const fetchPendingAppointments = async () => {
        setIsLoading(true);
        try {
            const pending = await getPendingAppointments();
            setAppointments(pending.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
        } catch (error) {
            toast({
                variant: "destructive",
                title: "שגיאה",
                description: "לא ניתן היה לטעון את רשימת התורים הממתינים."
            })
        } finally {
            setIsLoading(false);
        }
    }
    
    useEffect(() => {
        setAllTemplates(getFromLocalStorage<TreatmentFormTemplate[]>('treatmentFormTemplates', []));
    }, []);

    useEffect(() => {
        fetchPendingAppointments();
    }, []);
    
    const handleApprove = (id: string) => {
        startTransition(async () => {
            const approvedAppointment = appointments.find(a => a.id === id);
            const result = await updateAppointmentStatus(id, 'scheduled');
            if (result.success) {
                await createLog({
                    action: 'Appointment Approved',
                    details: `Appointment for ${approvedAppointment?.clientName} was approved.`,
                    user: 'Admin'
                });
                
                toast({ title: "הצלחה", description: "התור אושר בהצלחה. הודעה נשלחה ללקוח." });
                fetchPendingAppointments(); // Refresh the list
            } else {
                toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לאשר את התור." });
            }
        });
    };

    const handleReject = (id: string) => {
        startTransition(async () => {
            const rejectedAppointment = appointments.find(a => a.id === id);
            // Change status to 'cancelled' to trigger backend notification
            const result = await updateAppointmentStatus(id, 'cancelled', 'admin');
             if (result.success) {
                await createLog({
                    action: 'Appointment Rejected',
                    details: `Appointment for ${rejectedAppointment?.clientName} was rejected.`,
                    user: 'Admin'
                });
                toast({ title: "הצלחה", description: "התור נדחה והודעה נשלחה ללקוח." });
                fetchPendingAppointments(); // Refresh the list
            } else {
                toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לדחות את התור." });
            }
        });
    };
    
    const formatWhatsAppLink = (phone: string): string => {
        let cleanedPhone = phone.replace(/[^0-9]/g, '');
        if (cleanedPhone.startsWith('0')) {
            return `https://wa.me/972${cleanedPhone.substring(1)}`;
        }
        return `https://wa.me/${cleanedPhone}`;
    }

    const handleViewHistory = (clientId: string | null, clientName: string) => {
        if (!clientId) {
            toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן לאתר את הלקוח." });
            return;
        }
        const history = getFromLocalStorage<FilledFormInstance[]>(`clientTreatmentHistory_${clientId}`, []);
        setSelectedClientHistory({ 
            name: clientName, 
            history: history.sort((a, b) => new Date(b.filledAt || 0).getTime() - new Date(a.filledAt || 0).getTime()) 
        });
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin" passHref>
                    <Button variant="outline">
                        <ArrowLeft className="ml-2" />
                        חזרה
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">רשימת תורים לאישור</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>תורים ממתינים</CardTitle>
                    <CardDescription>אשר או דחה את בקשות התורים הבאות.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-48">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : appointments.length > 0 ? (
                         <TooltipProvider>
                            <ul className="space-y-4">
                                {appointments.map(app => (
                                    <li key={app.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border rounded-md gap-4">
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-lg">{app.clientName}</p>
                                                {app.clientPhone && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <a href={formatWhatsAppLink(app.clientPhone)} target="_blank" rel="noopener noreferrer">
                                                                <Button size="icon" variant="ghost" className="text-green-600 hover:text-green-700 h-8 w-8">
                                                                    <WhatsAppIcon className="h-5 w-5"/>
                                                                </Button>
                                                            </a>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>שלח הודעת וואטסאפ</p></TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                <span>{app.serviceName}</span>
                                                <span className="mx-2">|</span>
                                                <span>{format(new Date(app.start), 'eeee, d MMMM yyyy', { locale: he })}</span>
                                                <span className="mx-2">|</span>
                                                <span>{format(new Date(app.start), 'HH:mm')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-center">
                                            <Button size="icon" variant="outline" className="text-red-500 border-red-500 hover:bg-red-50" onClick={() => handleReject(app.id)} disabled={isProcessing}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Link href={`/admin/calendar?date=${format(new Date(app.start), 'yyyy-MM-dd')}&pendingAppointmentId=${app.id}`} passHref>
                                                <Button size="icon" variant="outline" disabled={isProcessing}>
                                                   <Calendar className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <Button size="icon" variant="outline" onClick={() => handleViewHistory(app.clientId, app.clientName)} disabled={isProcessing}>
                                                <FileText className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="outline" disabled={isProcessing}>
                                                <ThumbsUp className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" className="bg-green-500 hover:bg-green-600" onClick={() => handleApprove(app.id)} disabled={isProcessing}>
                                                {isProcessing ? <Loader2 className="animate-spin" /> : <Check className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </TooltipProvider>
                    ) : (
                        <div className="text-center text-muted-foreground py-16">
                            <p className="text-lg">אין תורים הממתינים לאישור כרגע.</p>
                            <p>כל הכבוד, יישר כוח!</p>
                        </div>
                    )}
                </CardContent>
            </Card>

             {selectedClientHistory && (
                <ViewTreatmentHistoryDialog 
                    isOpen={!!selectedClientHistory}
                    onOpenChange={(isOpen) => !isOpen && setSelectedClientHistory(null)}
                    clientName={selectedClientHistory.name}
                    history={selectedClientHistory.history}
                    templates={allTemplates}
                />
            )}
        </div>
    );
}
