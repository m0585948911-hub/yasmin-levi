

'use client';

import React from 'react';

import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  X,
  FileText,
  PlusCircle,
  Trash2,
  Pencil,
  Eye,
  CheckCircle2,
  UserPlus,
  Calendar as CalendarIcon,
  Info,
  Send,
  Upload,
  File,
  Camera,
  Loader2,
  Save,
  Tablet,
  Printer,
  FileSignature,
  Download,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect, useTransition, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Client, saveClient, ClientFlag, getClientById, getClients, Relationship, FamilyRelation, updateFamilyRelations } from '@/lib/clients';
import { Appointment, getAppointments } from '@/lib/appointments';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { useAdminUser } from '@/hooks/use-admin-user';
import type { AllSettings } from '@/lib/settings-types';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFormTemplates, deleteFormInstance, type TreatmentFormTemplate, type FormField, type FilledFormInstance, type SignatureDetails } from '@/lib/form-templates';
import { BirthDateSelector } from './birth-date-selector';
import { SignaturePad } from './signature-pad';
import { User, getUsers } from '@/lib/users';
import { createReminder } from '@/lib/reminders';


interface ClientImage {
    src: string;
    sourceType: 'treatment' | 'summary' | 'manual';
    sourceName: string; // e.g., form name or "Manual Upload"
    date: string; // ISO string
    instanceId?: string; // for form/summary images
    manualId?: string; // for manual images
}

interface CommunicationLog {
  id: string;
  timestamp: string; // ISO string
  type: 'phone' | 'sms' | 'whatsapp' | 'email' | 'other';
  summary: string;
  reminderAt?: string | null;
  reminderForUserId?: string | null;
}


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

const setInLocalStorage = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
};

const getAge = (birthDate?: string | null): number | null => {
  if (!birthDate) return null;
  try {
    return new Date().getFullYear() - new Date(birthDate).getFullYear();
  } catch {
    return null;
  }
};

const statusMap: { [key: string]: { text: string; className: string } } = {
  active: { text: "פעיל", className: "bg-green-100 text-green-800" },
  vip: { text: "VIP", className: "bg-yellow-100 text-yellow-800" },
  'at-risk': { text: "בסיכון", className: "bg-orange-100 text-orange-800" },
  blocked: { text: "חסום", className: "bg-red-100 text-red-800" },
  new: { text: "חדש", className: "bg-blue-100 text-blue-800" },
};

const flagSeverityColors: { [key: string]: string } = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

const PrintableSummary = React.forwardRef<HTMLDivElement, {
    instance: FilledFormInstance,
    template: TreatmentFormTemplate,
    client: Client,
    adminUserName: string,
    settings: AllSettings | null,
    logoUrl: string | null,
}>(({ instance, template, client, adminUserName, settings, logoUrl }, ref) => {
    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans" style={{ width: '210mm' }}>
            <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-800">{settings?.businessDetails?.businessName || 'קליניקה'}</h1>
                    <p className="text-sm text-gray-500">{settings?.businessDetails?.street} {settings?.businessDetails?.houseNumber}, {settings?.businessDetails?.city}</p>
                    <p className="text-sm text-gray-500">טלפון: {settings?.businessDetails?.phone} | אימייל: {settings?.businessDetails?.email}</p>
                </div>
                {logoUrl && (
                    <div className="w-24 h-24 relative">
                        <img src={logoUrl} alt="Logo" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                    </div>
                )}
            </header>

            <main className="mt-8">
                <h2 className="text-2xl font-semibold text-center mb-6">סיכום טיפול - {template.name}</h2>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6 p-4 bg-gray-50 rounded-lg">
                    <div><span className="font-semibold">שם הלקוח/ה:</span> {client.firstName} {client.lastName}</div>
                    <div><span className="font-semibold">שם המטפל/ת:</span> {adminUserName}</div>
                    <div><span className="font-semibold">תאריך הטיפול:</span> {instance.filledAt ? new Date(instance.filledAt).toLocaleDateString('he-IL') : ''}</div>
                    <div><span className="font-semibold">שעת הטיפול:</span> {instance.filledAt ? new Date(instance.filledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>

                <div className="space-y-4">
                    {template.fields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(field => {
                        if (field.type === 'title') {
                            return <h3 key={field.id} className="text-lg font-semibold pt-4 border-b pb-1 mb-2">{field.label}</h3>;
                        }
                        if (field.type === 'subtitle') {
                            return <h4 key={field.id} className="text-md font-medium text-gray-600 pt-2">{field.label}</h4>;
                        }

                        const value = instance.data[field.id];
                        let displayValue: React.ReactNode = '-';
                        
                        if (field.type === 'signature') {
                            displayValue = value ? (
                                <div className="border p-1 mt-1 bg-white inline-block">
                                    <img src={value as string} alt="חתימה" style={{ width: '200px', height: '100px', objectFit: 'contain' }} />
                                </div>
                            ) : '-';
                        } else if (field.type === 'image') {
                           displayValue = (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {(value as string[] || []).map((imgSrc, idx) => (
                                        <div key={idx} className="w-32 h-32 relative border rounded">
                                            <img src={imgSrc} alt={`${field.label} ${idx + 1}`} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                                        </div>
                                    ))}
                                </div>
                           );
                        } else if (typeof value === 'boolean') {
                            displayValue = value ? 'כן' : 'לא';
                        } else if (Array.isArray(value)) {
                            displayValue = value.join(', ');
                        } else if (value) {
                             displayValue = <p className="whitespace-pre-wrap">{String(value)}</p>;
                        }

                        return (
                            <div key={field.id} className="grid grid-cols-3 gap-2 py-1 items-start">
                                <div className="font-semibold col-span-1">{field.label}:</div>
                                <div className="col-span-2">{displayValue}</div>
                            </div>
                        );
                    })}
                </div>
            </main>

            <footer className="mt-12 pt-4 border-t text-center text-xs text-gray-500 space-y-1">
                <p>
                    הופק על ידי {adminUserName} בתאריך {new Date().toLocaleDateString('he-IL')} בשעה {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p>מסמך זה הופק באמצעות מערכת הניהול של {settings?.businessDetails?.businessName || 'הקליניקה'}</p>
            </footer>
        </div>
    );
});
PrintableSummary.displayName = 'PrintableSummary';

const PrintableSignedForm = React.forwardRef<HTMLDivElement, {
    instance: FilledFormInstance,
    template: TreatmentFormTemplate,
    client: Client,
    settings: AllSettings | null,
    logoUrl: string | null,
}>(({ instance, template, client, settings, logoUrl }, ref) => {
    const PersonalDetailsSection = (
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6 p-4 bg-gray-50 rounded-lg">
            <div><span className="font-semibold">שם הלקוח/ה:</span> {client.firstName} {client.lastName}</div>
            <div><span className="font-semibold">תאריך מילוי:</span> {instance.filledAt ? new Date(instance.filledAt).toLocaleDateString('he-IL') : ''}</div>
            {client.phone && <div><span className="font-semibold">טלפון:</span> {client.phone}</div>}
            {client.email && <div><span className="font-semibold">אימייל:</span> {client.email}</div>}
        </div>
    );
    
    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans" style={{ width: '210mm' }}>
            <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-800">{settings?.businessDetails?.businessName || 'קליניקה'}</h1>
                    <p className="text-sm text-gray-500">{settings?.businessDetails?.street} {settings?.businessDetails?.houseNumber}, {settings?.businessDetails?.city}</p>
                    <p className="text-sm text-gray-500">טלפון: {settings?.businessDetails?.phone} | אימייל: {settings?.businessDetails?.email}</p>
                </div>
                {logoUrl && (
                    <div className="w-24 h-24 relative">
                        <img src={logoUrl} alt="Logo" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                    </div>
                )}
            </header>

            <main className="mt-8">
                <h2 className="text-2xl font-semibold text-center mb-6">{template.name}</h2>
                
                <div className="space-y-4">
                    {template.fields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(field => {
                        if (field.type === 'personalDetails') {
                            return <div key={field.id}>{PersonalDetailsSection}</div>;
                        }
                        if (field.type === 'title') {
                            return <h3 key={field.id} className="text-lg font-semibold pt-4 border-b pb-1 mb-2">{field.label}</h3>;
                        }
                        if (field.type === 'subtitle') {
                            return <h4 key={field.id} className="text-md font-medium text-gray-600 pt-2">{field.label}</h4>;
                        }

                        const value = instance.data[field.id];
                        let displayValue: React.ReactNode = '-';
                        
                        if (field.type === 'signature') {
                            displayValue = value ? (
                                <div className="border p-1 mt-1 bg-white inline-block">
                                    <img src={value as string} alt="חתימה" style={{ width: '200px', height: '100px', objectFit: 'contain' }} />
                                </div>
                            ) : '-';
                        } else if (typeof value === 'boolean') {
                            displayValue = value ? 'כן' : 'לא';
                        } else if (Array.isArray(value)) {
                            displayValue = value.join(', ');
                        } else if (value) {
                             displayValue = <p className="whitespace-pre-wrap">{String(value)}</p>;
                        }

                        return (
                            <div key={field.id} className="grid grid-cols-3 gap-2 py-1 items-start">
                                <div className="font-semibold col-span-1">{field.label}:</div>
                                <div className="col-span-2">{displayValue}</div>
                            </div>
                        );
                    })}
                </div>
            </main>

            <footer className="mt-12 pt-4 border-t text-center text-xs text-gray-500 space-y-1">
                 {instance.signatureDetails?.signedAt && (
                    <p>המסמך נחתם דיגיטלית בתאריך {new Date(instance.signatureDetails.signedAt).toLocaleDateString('he-IL')} בשעה {new Date(instance.signatureDetails.signedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
                 )}
                 <p>הופק באמצעות מערכת הניהול של {settings?.businessDetails?.businessName || 'הקליניקה'}</p>
            </footer>
        </div>
    );
});
PrintableSignedForm.displayName = 'PrintableSignedForm';


const ViewTreatmentInstanceDialog = ({ isOpen, onOpenChange, instance, template, client, adminUserName }: {
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  instance: FilledFormInstance | null,
  template: TreatmentFormTemplate | null,
  client: Client,
  adminUserName: string
}) => {
  const printableContentRef = useRef<HTMLDivElement>(null);
  const [isPrinting, startPrinting] = useTransition();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
        const s = getFromLocalStorage<AllSettings | null>('appGeneralSettings', null);
        setSettings(s);
        const l = localStorage.getItem('businessLogoUrl');
        setLogoUrl(l);
    }
  }, [isOpen]);

  const handlePrint = () => {
    startPrinting(async () => {
        const input = printableContentRef.current;
        if (!input) {
             toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה להכין את המסמך להדפסה.' });
             return;
        };

        try {
            const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
                import('jspdf'),
                import('html2canvas')
            ]);
            
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const imgProps= pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
              heightLeft -= pdfHeight;
            }
            
            pdf.save(`סיכום - ${client.firstName} - ${instance!.filledAt ? new Date(instance!.filledAt).toLocaleDateString('he-IL') : ''}.pdf`);

        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ variant: 'destructive', title: 'שגיאה בהדפסה', description: 'אירעה שגיאה בעת יצירת קובץ ה-PDF.' });
        }
    });
};

  if (!instance || !template) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            פרטי הטיפול מתאריך: {instance.filledAt ? new Date(instance.filledAt).toLocaleString('he-IL') : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {template.fields.sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0)).map(field => {
             if (field.type === 'title') {
                return <h3 key={field.id} className="text-lg font-semibold pt-4">{field.label}</h3>;
            }
            if (field.type === 'subtitle') {
                return <h4 key={field.id} className="text-md font-medium text-muted-foreground">{field.label}</h4>;
            }
            return (
                <div key={field.id} className="flex flex-col gap-1">
                    <Label className="font-semibold">{field.label}</Label>
                    {field.type === 'image' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {(instance.data[field.id] as string[] || []).map((imgSrc, idx) => (
                            <div key={idx} className="relative aspect-square w-full">
                            <Image src={imgSrc} alt={`${field.label} ${idx + 1}`} layout="fill" className="object-cover rounded-md border" />
                            </div>
                        ))}
                        </div>
                    ) : field.type === 'signature' ? (
                         <div className="p-2 border rounded-md bg-white">
                            {instance.data[field.id] ? (
                                <Image src={instance.data[field.id] as string} alt="חתימה" width={300} height={150} className="mx-auto object-contain" />
                            ) : (
                                <p className="text-muted-foreground text-center">לא נחתם</p>
                            )}
                        </div>
                    ) : (
                        <div className="p-2 text-sm bg-accent rounded-md min-h-[36px] border">
                        {typeof instance.data[field.id] === 'boolean'
                            ? (instance.data[field.id] ? 'כן' : 'לא')
                            : (instance.data[field.id] as string || ' - ')}
                        </div>
                    )}
                </div>
            )
          })}
        </div>
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
              {isPrinting ? <Loader2 className="animate-spin" /> : <Printer className="mr-2" />}
              הדפסה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     <div className="absolute left-[-9999px] top-0">
        <PrintableSummary 
            ref={printableContentRef}
            instance={instance}
            template={template}
            client={client}
            adminUserName={adminUserName}
            settings={settings}
            logoUrl={logoUrl}
        />
    </div>
    </>
  );
}

const ViewSignedFormDialog = ({ isOpen, onOpenChange, instance, template, client }: {
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  instance: FilledFormInstance | null,
  template: TreatmentFormTemplate | null,
  client: Client,
}) => {
  const printableContentRef = useRef<HTMLDivElement>(null);
  const [isPrinting, startPrinting] = useTransition();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
        const s = getFromLocalStorage<AllSettings | null>('appGeneralSettings', null);
        setSettings(s);
        const l = localStorage.getItem('businessLogoUrl');
        setLogoUrl(l);
    }
  }, [isOpen]);

  const handlePrint = () => {
    startPrinting(async () => {
        const input = printableContentRef.current;
        if (!input) {
             toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה להכין את המסמך להדפסה.' });
             return;
        };

        try {
            const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([ import('jspdf'), import('html2canvas') ]);
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps= pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
              heightLeft -= pdfHeight;
            }
            pdf.save(`טופס חתום - ${client.firstName} - ${instance!.filledAt ? new Date(instance!.filledAt).toLocaleDateString('he-IL') : ''}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ variant: 'destructive', title: 'שגיאה בהדפסה', description: 'אירעה שגיאה בעת יצירת קובץ ה-PDF.' });
        }
    });
};

  if (!instance || !template) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            נחתם דיגיטלית על ידי {instance.signatureDetails?.signedByName} בתאריך: {instance.signatureDetails?.signedAt ? new Date(instance.signatureDetails.signedAt).toLocaleString('he-IL') : 'לא ידוע'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {template.fields.sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0)).map(field => {
             if (field.type === 'title') {
                return <h3 key={field.id} className="text-lg font-semibold pt-4">{field.label}</h3>;
            }
            if (field.type === 'subtitle') {
                return <h4 key={field.id} className="text-md font-medium text-muted-foreground">{field.label}</h4>;
            }
            return (
                <div key={field.id} className="flex flex-col gap-1">
                    <Label className="font-semibold">{field.label}</Label>
                    {field.type === 'signature' ? (
                         <div className="p-2 border rounded-md bg-white">
                            {instance.data[field.id] ? (
                                <Image src={instance.data[field.id] as string} alt="חתימה" width={300} height={150} className="mx-auto object-contain" />
                            ) : (
                                <p className="text-muted-foreground text-center">לא נחתם</p>
                            )}
                        </div>
                    ) : (
                        <div className="p-2 text-sm bg-accent rounded-md min-h-[36px] border">
                        {typeof instance.data[field.id] === 'boolean'
                            ? (instance.data[field.id] ? 'כן' : 'לא')
                            : (instance.data[field.id] as string || ' - ')}
                        </div>
                    )}
                </div>
            )
          })}
        </div>
        <DialogFooter className="justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
              {isPrinting ? <Loader2 className="animate-spin" /> : <Printer className="mr-2" />}
              הדפסה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
     <div className="absolute left-[-9999px] top-0">
        <PrintableSignedForm 
            ref={printableContentRef}
            instance={instance}
            template={template}
            client={client}
            settings={settings}
            logoUrl={logoUrl}
        />
    </div>
    </>
  );
}


const CameraCaptureDialog = ({ isOpen, onOpenChange, onCapture }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onCapture: (dataUrl: string) => void }) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const getCameraPermission = async () => {
            if (isOpen) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (error) {
                    console.error('Error accessing camera:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Camera Access Denied',
                        description: 'Please enable camera permissions in your browser settings.',
                    });
                    onOpenChange(false);
                }
            }
        };

        getCameraPermission();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [isOpen, onOpenChange, toast]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            onCapture(dataUrl);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>צלם תמונה</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-md" />
                    <canvas ref={canvasRef} className="hidden" />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleCapture}>צלם תמונה</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const FillTreatmentForm = ({
  template,
  onSave,
  onCancel,
  appointment,
  client,
  adminUserName,
  isSaving,
  initialInstance,
}: {
  template: TreatmentFormTemplate,
  onSave: (instance: FilledFormInstance, clientUpdate?: Partial<Client>) => void,
  onCancel: () => void,
  appointment: Appointment,
  client: Client,
  adminUserName: string,
  isSaving: boolean,
  initialInstance: FilledFormInstance | null,
}) => {
  const [formData, setFormData] = useState<{ [fieldId: string]: string | boolean | string[] }>({});
  
  const [editableClientDetails, setEditableClientDetails] = useState({
      firstName: client.firstName,
      lastName: client.lastName,
      birthDate: client.birthDate ? new Date(client.birthDate) : null,
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturingForFieldId, setCapturingForFieldId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setFormData(initialInstance?.data || {});
  }, [initialInstance]);

  const openCamera = (fieldId: string) => {
    setCapturingForFieldId(fieldId);
    setIsCameraOpen(true);
  };

  const handleCaptureImage = (dataUrl: string) => {
    if (capturingForFieldId) {
        const fieldDef = template.fields.find(f => f.id === capturingForFieldId);
        if (!fieldDef) return;

        const maxImages = fieldDef.imageCount || 1;
        const existingImages = (formData[capturingForFieldId] as string[] || []);

        if (existingImages.length >= maxImages) {
            alert(`ניתן להעלות עד ${maxImages} תמונות לשדה זה.`);
            return;
        }
        
        setFormData(prev => {
            const currentImages = (prev[capturingForFieldId] as string[] || []);
            return { ...prev, [capturingForFieldId]: [...currentImages, dataUrl] };
        });
    }
  };


  const handleClientDetailsChange = (field: keyof typeof editableClientDetails, value: any) => {
    setEditableClientDetails(prev => ({...prev, [field]: value}));
  };

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
    const files = Array.from(e.target.files || []);
    const fieldDef = template.fields.find(f => f.id === fieldId);
    if (!files.length || !fieldDef) return;

    const maxImages = fieldDef.imageCount || 1;
    const existingImages = (formData[fieldId] as string[] || []);

    if (existingImages.length + files.length > maxImages) {
      alert(`ניתן להעלות עד ${maxImages} תמונות לשדה זה.`);
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFormData(prev => {
          const currentImages = (prev[fieldId] as string[] || []);
          return { ...prev, [fieldId]: [...currentImages, result] };
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (fieldId: string, index: number) => {
    setFormData(prev => {
      const currentImages = (prev[fieldId] as string[] || []);
      const newImages = currentImages.filter((_, i) => i !== index);
      return { ...prev, [fieldId]: newImages };
    });
  };
  
  const handleSave = (status: 'draft' | 'completed') => {
    if (status === 'completed') {
        const errors: string[] = [];
        template.fields.forEach(field => {
            if (field.required && !['title', 'subtitle', 'personalDetails'].includes(field.type)) {
                const value = formData[field.id];
                let isFieldInvalid = false;
                
                if (field.type === 'checkbox' || field.type === 'contentWithConsent' || field.type === 'signature') {
                    if (!value) {
                        isFieldInvalid = true;
                    }
                } else if (
                    value === undefined ||
                    value === null ||
                    value === '' ||
                    (Array.isArray(value) && value.length === 0)
                ) {
                    isFieldInvalid = true;
                }

                if (isFieldInvalid) {
                    errors.push(`השדה "${field.label || 'ללא שם'}" הוא שדה חובה.`);
                }
            }
        });

        if (errors.length > 0) {
          toast({
            variant: "destructive",
            title: "לא ניתן לשמור, יש למלא שדות חובה:",
            description: (
              <ul className="mt-2 list-disc pr-4 space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            ),
          });
          return;
        }
    }

    const newInstance: FilledFormInstance = {
      instanceId: initialInstance?.instanceId || crypto.randomUUID(),
      templateId: template.id,
      templateName: template.name,
      status: status,
      assignedAt: initialInstance?.assignedAt || new Date().toISOString(),
      filledAt: new Date().toISOString(),
      appointmentId: appointment.id,
      data: formData,
      clientId: client.id,
    };
    
    const clientUpdate: Partial<Client> = {};
    if (editableClientDetails.firstName.trim() && editableClientDetails.firstName.trim() !== client.firstName) {
        clientUpdate.firstName = editableClientDetails.firstName.trim();
    }
    if (editableClientDetails.lastName.trim() && editableClientDetails.lastName.trim() !== client.lastName) {
        clientUpdate.lastName = editableClientDetails.lastName.trim();
    }
    const newBirthDateISO = editableClientDetails.birthDate ? editableClientDetails.birthDate.toISOString() : null;
    if (newBirthDateISO !== client.birthDate) {
        clientUpdate.birthDate = newBirthDateISO;
    }
    
    onSave(newInstance, Object.keys(clientUpdate).length > 0 ? clientUpdate : undefined);
  };
  
  const PersonalDetailsSection = (
    <div className="space-y-3 mb-6 p-4 border rounded-lg bg-accent/20">
        <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                    <Label className="text-muted-foreground">שם המטפל/ת</Label>
                    <Input value={adminUserName} disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground" htmlFor="client-firstname">שם פרטי</Label>
                    <Input id="client-firstname" value={editableClientDetails.firstName} onChange={(e) => handleClientDetailsChange('firstName', e.target.value)} />
                </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground" htmlFor="client-lastname">שם משפחה</Label>
                    <Input id="client-lastname" value={editableClientDetails.lastName} onChange={(e) => handleClientDetailsChange('lastName', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">טלפון</Label>
                <Input value={client.phone} disabled />
            </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">תאריך לידה</Label>
                  <BirthDateSelector
                    value={editableClientDetails.birthDate}
                    onChange={(date) => handleClientDetailsChange('birthDate', date)}
                />
            </div>
        </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{template.name}</span>
          <div className="text-sm font-normal text-muted-foreground text-right">
            <p>{client.firstName} {client.lastName}</p>
            <p>{format(new Date(appointment.start), 'd MMM yyyy, HH:mm', { locale: he })}</p>
          </div>
        </CardTitle>
        <CardDescription>מילוי סיכום טיפול.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {template.fields
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map(field => {
            if (field.type === 'title') {
              return <h3 key={field.id} className="text-xl font-bold pt-4 border-b pb-2">{field.label}</h3>;
            }
            if (field.type === 'subtitle') {
              return <h4 key={field.id} className="text-lg font-semibold text-muted-foreground pt-2">{field.label}</h4>;
            }
             if (field.type === 'personalDetails') {
              return <div key={field.id}>{PersonalDetailsSection}</div>;
            }
            if (field.type === 'contentWithConsent') {
                const isRequired = field.required;
                return (
                    <div key={field.id} className="space-y-2">
                        <Card>
                            <CardContent className="p-4">
                                <ScrollArea className="h-24 w-full rounded-md border p-2">
                                    <pre className="text-sm whitespace-pre-wrap font-sans">
                                        {field.label}
                                    </pre>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <div className="flex items-center space-x-2 space-x-reverse pt-2">
                            <Checkbox
                              id={field.id}
                              checked={(formData[field.id] as boolean) || false}
                              onCheckedChange={checked => handleFieldChange(field.id, !!checked)}
                            />
                            <Label htmlFor={field.id} className={cn(isRequired && "font-bold after:content-['*'] after:ml-0.5 after:text-red-500")}>
                                קראתי, הבנתי ואני מאשר/ת את התוכן
                            </Label>
                        </div>
                    </div>
                )
            }


            const isRequired = field.required;
            return (
              <div key={field.id} className="space-y-2">
                <Label
                  htmlFor={field.id}
                  className={cn(isRequired && "font-bold after:content-['*'] after:ml-0.5 after:text-red-500")}
                >
                  {field.label}
                </Label>

                {field.type === 'text' && (
                  <Input
                    id={field.id}
                    value={(formData[field.id] as string) || ''}
                    onChange={e => handleFieldChange(field.id, e.target.value)}
                  />
                )}

                {field.type === 'textarea' && (
                  <Textarea
                    id={field.id}
                    value={(formData[field.id] as string) || ''}
                    onChange={e => handleFieldChange(field.id, e.target.value)}
                  />
                )}

                {field.type === 'checkbox' && (
                  <div className="flex items-center pt-2">
                    <Checkbox
                      id={field.id}
                      checked={(formData[field.id] as boolean) || false}
                      onCheckedChange={checked => handleFieldChange(field.id, !!checked)}
                    />
                  </div>
                )}

                {field.type === 'select' && (
                  <Select
                    onValueChange={value => handleFieldChange(field.id, value)}
                    value={(formData[field.id] as string) || ''}
                  >
                    <SelectTrigger id={field.id}><SelectValue placeholder="בחר..." /></SelectTrigger>
                    <SelectContent>
                      {field.options.map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                
                {field.type === 'signature' && (
                    <div className="space-y-2">
                        <SignaturePad
                            dataUrl={formData[field.id] as string | undefined}
                            onEnd={dataUrl => handleFieldChange(field.id, dataUrl)}
                            onClear={() => handleFieldChange(field.id, '')}
                        />
                        {isRequired && !formData[field.id] && (
                            <p className="text-sm font-medium text-destructive">
                                חתימה היא שדה חובה.
                            </p>
                        )}
                    </div>
                )}

                {field.type === 'image' && (
                  <div>
                    <div className="flex gap-2">
                        <Input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={e => handleImageUpload(e, field.id)}
                            className="mb-2 flex-grow"
                        />
                         <Button type="button" variant="outline" onClick={() => openCamera(field.id)}>
                            <Camera className="mr-2" />
                            צלם
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(formData[field.id] as string[] || []).map((imgSrc, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={imgSrc}
                            alt="Uploaded preview"
                            className="rounded-md object-cover w-full aspect-square"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(field.id, idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        <CameraCaptureDialog 
            isOpen={isCameraOpen}
            onOpenChange={setIsCameraOpen}
            onCapture={handleCaptureImage}
        />
      </CardContent>

      <CardFooter className="justify-between items-center">
        <span className="text-xs text-muted-foreground">
            {initialInstance?.filledAt ? `נשמר לאחרונה: ${format(new Date(initialInstance.filledAt), 'dd/MM/yyyy, HH:mm')}` : `נוצר בתאריך: ${format(new Date(), 'dd/MM/yyyy, HH:mm')}`}
        </span>
        <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>ביטול</Button>
            <Button variant="secondary" onClick={() => handleSave('draft')} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Save className="mr-2" />}שמור כטיוטה
            </Button>
            <Button onClick={() => handleSave('completed')} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : 'שמור סיכום סופי'}
            </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

const ViewImageDialog = ({ image, onClose, onDelete }: { image: ClientImage | null; onClose: () => void; onDelete: (manualId: string) => void; }) => {
    if (!image) return null;

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = image.src;
        // Use a generic name with a timestamp to avoid issues
        link.download = `image_${new Date(image.date).getTime()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>תמונה מתוך: {image.sourceName}</DialogTitle>
                    <DialogDescription>
                        צולם בתאריך: {new Date(image.date).toLocaleString('he-IL')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow relative my-4">
                    <Image src={image.src} alt="Full size" layout="fill" className="object-contain" />
                </div>
                <DialogFooter className="justify-between">
                    <div>
                        {image.sourceType === 'manual' && image.manualId && (
                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    <Trash2 className="mr-2" /> מחק
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>האם למחוק את התמונה?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogDescription>פעולה זו היא סופית ולא ניתן לשחזר אותה.</AlertDialogDescription>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(image.manualId!)}>מחק תמונה</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                           </AlertDialog>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>סגור</Button>
                        <Button onClick={handleDownload}>
                            <Download className="mr-2" /> הורדה
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const flagTypes: { value: ClientFlag['type']; label: string }[] = [
  { value: 'allergy', label: 'אלרגיה' },
  { value: 'meds', label: 'תרופות' },
  { value: 'keloid', label: 'נטייה לקלואידים' },
  { value: 'pregnancy', label: 'הריון / הנקה' },
  { value: 'skinCondition', label: 'מצב עור מיוחד' },
  { value: 'pihRisk', label: 'סיכון ל-PIH' },
  { value: 'diabetes', label: 'סכרת' },
  { value: 'priorReaction', label: 'תגובה קודמת' },
  { value: 'operational', label: 'תפעולי' },
];

const severityLevels: { value: ClientFlag['severity']; label: string }[] = [
  { value: 'low', label: 'נמוכה' },
  { value: 'medium', label: 'בינונית' },
  { value: 'high', label: 'גבוהה' },
];


const FlagDialog = ({ onSave, onOpenChange, isOpen, flagToEdit }: {
    onSave: (flag: ClientFlag) => void;
    onOpenChange: (isOpen: boolean) => void;
    isOpen: boolean;
    flagToEdit: ClientFlag | null;
}) => {
    const [type, setType] = useState<ClientFlag['type']>('operational');
    const [reason, setReason] = useState('');
    const [severity, setSeverity] = useState<ClientFlag['severity']>('low');
    const { toast } = useToast();

    useEffect(() => {
        if (flagToEdit) {
            setType(flagToEdit.type);
            setReason(flagToEdit.reason);
            setSeverity(flagToEdit.severity);
        } else {
            // Reset for new flag
            setType('operational');
            setReason('');
            setSeverity('low');
        }
    }, [flagToEdit, isOpen]);

    const handleSave = () => {
        if (!reason.trim()) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'יש להזין סיבה לדגל.' });
            return;
        }

        const flagData: ClientFlag = {
            type,
            reason,
            severity,
            active: true,
            createdAtIso: flagToEdit?.createdAtIso || new Date().toISOString(),
            lastChangedAtIso: new Date().toISOString(),
            source: 'clinician',
        };

        onSave(flagData);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{flagToEdit ? 'עריכת דגל' : 'הוספת דגל חדש'}</DialogTitle>
                    <DialogDescription>
                        דגלים עוזרים לך לזכור מידע חשוב על הלקוח/ה.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="flag-type">סוג הדגל</Label>
                        <Select value={type} onValueChange={(v) => setType(v as ClientFlag['type'])}>
                            <SelectTrigger id="flag-type">
                                <SelectValue placeholder="בחר סוג..." />
                            </SelectTrigger>
                            <SelectContent>
                                {flagTypes.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="flag-reason">סיבה / פירוט</Label>
                        <Textarea id="flag-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="לדוגמה: אלרגיה לפניצילין, לקוחה שמאחרת תמיד..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="flag-severity">רמת חומרה</Label>
                        <Select value={severity} onValueChange={(v) => setSeverity(v as ClientFlag['severity'])}>
                             <SelectTrigger id="flag-severity">
                                <SelectValue placeholder="בחר רמת חומרה..." />
                            </SelectTrigger>
                            <SelectContent>
                                {severityLevels.map(sl => <SelectItem key={sl.value} value={sl.value}>{sl.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמור דגל</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SendFormsDialog = ({
    isOpen,
    onOpenChange,
    clientId,
    onSend
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    onSend: () => void;
}) => {
    const { toast } = useToast();
    const [isSending, startSendingTransition] = useTransition();
    const [allTemplates, setAllTemplates] = useState<TreatmentFormTemplate[]>([]);
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    
    useEffect(() => {
        if (isOpen) {
            getFormTemplates().then(templates => {
                // Only show forms that are meant to be filled by the client
                const clientFillableTemplates = templates.filter(t => t.type === 'treatment');
                setAllTemplates(clientFillableTemplates);
            })
            setSelectedTemplates([]);
        }
    }, [isOpen]);

    const handleSend = () => {
        startSendingTransition(async () => {
             if (selectedTemplates.length === 0) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'יש לבחור לפחות טופס אחד.' });
                return;
            }

            const batch = writeBatch(db);
            const formInstancesCollection = collection(db, "formInstances");

            allTemplates
                .filter(t => selectedTemplates.includes(t.id))
                .forEach(template => {
                    const newInstance = {
                        clientId: clientId,
                        templateId: template.id,
                        templateName: template.name,
                        status: 'pending_client_fill' as const,
                        assignedAt: new Date().toISOString(),
                        data: {},
                    };
                    const docRef = doc(formInstancesCollection);
                    batch.set(docRef, newInstance);
                });
            
            try {
                await batch.commit();
                toast({ title: 'הצלחה!', description: 'הטפסים נשלחו ללקוח למילוי.' });
                onSend();
                onOpenChange(false);
            } catch (error) {
                 console.error("Error sending forms:", error);
                toast({ variant: 'destructive', title: 'שגיאה', description: 'אירעה שגיאה בשליחת הטפסים.' });
            }
        });
    }

    const handleSelectionChange = (templateId: string) => {
        setSelectedTemplates(prev => 
            prev.includes(templateId)
            ? prev.filter(id => id !== templateId)
            : [...prev, templateId]
        );
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>שליחת טפסים למילוי</DialogTitle>
                    <DialogDescription>בחר את הטפסים שברצונך לשלוח ללקוח למילוי וחתימה.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ScrollArea className="h-72 border rounded-md">
                        <div className="p-2 space-y-1">
                            {allTemplates.length > 0 ? (
                                allTemplates.map(template => (
                                    <div key={template.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent">
                                        <Checkbox
                                            id={`template-${template.id}`}
                                            checked={selectedTemplates.includes(template.id)}
                                            onCheckedChange={() => handleSelectionChange(template.id)}
                                        />
                                        <Label htmlFor={`template-${template.id}`} className="flex-grow cursor-pointer">
                                            {template.name}
                                        </Label>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-center text-muted-foreground p-4">
                                    לא נמצאו תבניות טפסים. ניתן ליצור תבניות חדשות דרך הגדרות לקוח.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSend} disabled={isSending || selectedTemplates.length === 0}>
                        {isSending ? <Loader2 className="animate-spin" /> : <Send className="mr-2" />}
                        שלח למילוי וחתימה
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AddFamilyMemberDialog = ({ onAdd, isChecking }: { onAdd: (phone: string) => void, isChecking: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [phone, setPhone] = useState('');

    const handleAddClick = () => {
        onAdd(phone);
        // Do not close the dialog here, let the parent component handle it
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="w-full mt-4">
                    <PlusCircle className="ml-2" />
                    הוסף בן משפחה
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>הוספת בן משפחה</DialogTitle>
                    <DialogDescription>
                        הקלד את מספר הטלפון של בן המשפחה שברצונך להוסיף.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="phone">מספר טלפון</Label>
                    <Input
                        id="phone"
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="05X-XXXXXXX"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>ביטול</Button>
                    <Button onClick={handleAddClick} disabled={isChecking}>
                        {isChecking ? <Loader2 className="animate-spin" /> : 'המשך'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const NewFamilyMemberRegistrationDialog = ({
    isOpen,
    onOpenChange,
    phone,
    onRegister
}: {
    isOpen: boolean,
    onOpenChange: (open: boolean) => void,
    phone: string,
    onRegister: (newClientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, relation: Relationship) => void;
}) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('female');
    const [relation, setRelation] = useState<Relationship>('daughter');
    const [isRegistering, startRegistration] = useTransition();

    const handleRegister = () => {
        if (!firstName.trim() || !lastName.trim()) {
            alert('נא למלא שם פרטי ושם משפחה.');
            return;
        }
        startRegistration(async () => {
            await onRegister({
                businessId: 'default',
                firstName,
                lastName,
                phone,
                gender,
                isBlocked: false,
                receivesSms: true
            }, relation);
        });
    }

    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>רישום בן משפחה חדש</DialogTitle>
                    <DialogDescription>
                        מלא את הפרטים של בן המשפחה. מספר הטלפון שהזנת הוא: {phone}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">שם פרטי</Label>
                        <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="lastName">שם משפחה</Label>
                        <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                    </div>
                     <div className="space-y-2">
                        <Label>מין</Label>
                        <RadioGroup value={gender} onValueChange={(v: 'male' | 'female') => setGender(v)} className="flex gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="female" id="reg-female" />
                                <Label htmlFor="reg-female">נקבה</Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="male" id="reg-male" />
                                <Label htmlFor="reg-male">זכר</Label>
                            </div>
                        </RadioGroup>
                    </div>
                     <div className="space-y-2">
                        <Label>קרבה</Label>
                         <Select value={relation} onValueChange={(v: Relationship) => setRelation(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר קרבה..."/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="son">בן</SelectItem>
                                <SelectItem value="daughter">בת</SelectItem>
                                <SelectItem value="mother">אמא</SelectItem>
                                <SelectItem value="father">אבא</SelectItem>
                                <SelectItem value="brother">אח</SelectItem>
                                <SelectItem value="sister">אחות</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleRegister} disabled={isRegistering}>
                        {isRegistering ? <Loader2 className="animate-spin" /> : 'שמור וקשר'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const FamilyManagementDialog = ({
  isOpen,
  onOpenChange,
  client,
  allClients,
  onUpdate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  allClients: Client[];
  onUpdate: () => void;
}) => {
    const { toast } = useToast();
    const [isCheckingPhone, startPhoneCheck] = useTransition();
    const [isSaving, startSaving] = useTransition();
    const [currentRelations, setCurrentRelations] = useState<FamilyRelation[]>([]);
    const [confirmClient, setConfirmClient] = useState<Client | null>(null);
    const [clientToAdd, setClientToAdd] = useState<Client | null>(null);
    const [isRegisteringNewMember, setIsRegisteringNewMember] = useState(false);
    const [phoneForRegistration, setPhoneForRegistration] = useState('');
    const [selectedRelation, setSelectedRelation] = useState<Relationship>('daughter');

    useEffect(() => {
        if(isOpen) {
            setCurrentRelations(client.familyRelations || []);
        }
    }, [isOpen, client.familyRelations]);

    const handleSaveAllRelations = async (relations: FamilyRelation[]) => {
      startSaving(async () => {
        const result = await updateFamilyRelations(client.id, relations, allClients);
        if (result.success) {
          toast({ title: 'הצלחה!', description: 'קשרי המשפחה עודכנו.' });
          onUpdate(); // Refetch data in parent
        } else {
          toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לעדכן את קשרי המשפחה.' });
        }
      });
    };
    
    const handleAddMember = (phone: string) => {
        if (!phone.trim()) {
            toast({ variant: "destructive", title: "שגיאה", description: "יש להזין מספר טלפון." });
            return;
        }
        if (phone.trim() === client.phone) {
            toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן להוסיף את הלקוח לעצמו." });
            return;
        }
        startPhoneCheck(async () => {
            const foundClient = allClients.find(c => c.phone.endsWith(phone.trim().slice(-9)));
            if (foundClient) {
                if (currentRelations.some(rel => rel.memberId === foundClient.id)) {
                    toast({ title: "מידע", description: "הלקוח כבר מקושר לחשבונך." });
                    return;
                }
                setConfirmClient(foundClient);
            } else {
                setPhoneForRegistration(phone.trim());
                setIsRegisteringNewMember(true);
            }
        });
    };

    const handleConfirmYes = () => {
        if (confirmClient) {
            setClientToAdd(confirmClient);
            setConfirmClient(null);
        }
    };
    
    const handleRelationSave = () => {
        if (clientToAdd) {
            const newRelation: FamilyRelation = { memberId: clientToAdd.id, relation: selectedRelation };
            const updatedRelations = [...currentRelations, newRelation];
            setCurrentRelations(updatedRelations);
            handleSaveAllRelations(updatedRelations);
            setClientToAdd(null);
        }
    };

    const handleDeleteRelation = (memberId: string) => {
        const updatedRelations = currentRelations.filter(rel => rel.memberId !== memberId);
        setCurrentRelations(updatedRelations);
        handleSaveAllRelations(updatedRelations);
    };

    const handleRegisterAndLink = async (newClientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, relation: Relationship) => {
        startSaving(async () => {
            const newClient = await saveClient(newClientData);
            onUpdate(); // This will refetch all clients, including the new one
            
            const newRelation: FamilyRelation = { memberId: newClient.id, relation };
            const updatedRelations = [...currentRelations, newRelation];
            setCurrentRelations(updatedRelations);
            await handleSaveAllRelations(updatedRelations);

            toast({ title: 'הצלחה!', description: `${newClient.firstName} נוסף למשפחה בהצלחה.`});
            setIsRegisteringNewMember(false);
        });
    };
    
    const getRelationName = (relation: Relationship) => {
        const map: Record<Relationship, string> = {
          mother: "אמא", father: "אבא", son: "בן", daughter: "בת", sister: "אחות", brother: "אח"
        };
        return map[relation] || "";
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={(open) => {
             if (!open) {
                setClientToAdd(null);
                setConfirmClient(null);
                setIsRegisteringNewMember(false);
                onOpenChange(false);
             } else {
                 onOpenChange(true);
             }
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>ניהול בני משפחה עבור {client.firstName}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <h4 className="font-semibold mb-2">בני משפחה מקושרים:</h4>
                    {currentRelations.length > 0 ? (
                        <ScrollArea className="h-48">
                            <div className="space-y-2 pr-4">
                                {currentRelations.map(rel => {
                                    const member = allClients.find(c => c.id === rel.memberId);
                                    return (
                                        <div key={rel.memberId} className="flex items-center justify-between p-2 border rounded-md">
                                            <div>
                                                <Link href={`/admin/clients/${rel.memberId}`}>
                                                    <span className="hover:underline">{member ? `${member.firstName} ${member.lastName}` : 'לקוח לא ידוע'}</span>
                                                </Link>
                                                <span className="text-sm text-primary mx-2">({getRelationName(rel.relation)})</span>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRelation(rel.memberId)} disabled={isSaving}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">
                            אין כרגע בני משפחה מקושרים.
                        </p>
                    )}
                    <AddFamilyMemberDialog onAdd={handleAddMember} isChecking={isCheckingPhone} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmClient} onOpenChange={() => setConfirmClient(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>אישור בן משפחה</AlertDialogTitle>
                    <AlertDialogDescription>
                        האם {confirmClient?.firstName} {confirmClient?.lastName} הוא בן המשפחה אותו תרצה/י להוסיף?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmClient(null)}>לא</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmYes}>כן, זהו בן המשפחה</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!clientToAdd} onOpenChange={() => setClientToAdd(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>הגדרת קרבה משפחתית</DialogTitle>
                    <DialogDescription>
                        בחר את הקרבה של {client.firstName} ל{clientToAdd?.firstName} {clientToAdd?.lastName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     <Select value={selectedRelation} onValueChange={(v: Relationship) => setSelectedRelation(v)}>
                        <SelectTrigger><SelectValue placeholder="בחר קרבה..."/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="son">הוא הבן של</SelectItem>
                            <SelectItem value="daughter">היא הבת של</SelectItem>
                            <SelectItem value="mother">היא האמא של</SelectItem>
                            <SelectItem value="father">הוא האבא של</SelectItem>
                            <SelectItem value="brother">הוא האח של</SelectItem>
                            <SelectItem value="sister">היא האחות של</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setClientToAdd(null)}>ביטול</Button>
                    <Button onClick={handleRelationSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin"/> : 'שמור קשר'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <NewFamilyMemberRegistrationDialog 
            isOpen={isRegisteringNewMember}
            onOpenChange={setIsRegisteringNewMember}
            phone={phoneForRegistration}
            onRegister={handleRegisterAndLink}
        />
        </>
    );
};

const CommunicationLogDialog = ({
    isOpen,
    onOpenChange,
    onSave,
    logToEdit,
    adminUsers
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (log: Omit<CommunicationLog, 'id'>) => void;
    logToEdit: CommunicationLog | null;
    adminUsers: User[];
}) => {
    const [type, setType] = useState<CommunicationLog['type']>('phone');
    const [summary, setSummary] = useState('');
    const [timestamp, setTimestamp] = useState(new Date());
    const [addReminder, setAddReminder] = useState(false);
    const [reminderAt, setReminderAt] = useState('');
    const [reminderForUserId, setReminderForUserId] = useState('');

    useEffect(() => {
        if (logToEdit) {
            setType(logToEdit.type);
            setSummary(logToEdit.summary);
            setTimestamp(new Date(logToEdit.timestamp));
            setAddReminder(!!logToEdit.reminderAt);
            setReminderAt(logToEdit.reminderAt ? format(new Date(logToEdit.reminderAt), "yyyy-MM-dd'T'HH:mm") : '');
            setReminderForUserId(logToEdit.reminderForUserId || '');
        } else {
            setType('phone');
            setSummary('');
            setTimestamp(new Date());
            setAddReminder(false);
            setReminderAt('');
            setReminderForUserId('');
        }
    }, [logToEdit, isOpen]);

    const handleSave = () => {
        if (!summary.trim()) {
            alert('יש למלא את סיכום השיחה.');
            return;
        }
        if (addReminder && (!reminderAt || !reminderForUserId)) {
            alert('כדי להוסיף תזכורת, יש למלא תאריך, שעה, ולבחור מנהל.');
            return;
        }
        onSave({
            timestamp: timestamp.toISOString(),
            type,
            summary,
            reminderAt: addReminder ? new Date(reminderAt).toISOString() : null,
            reminderForUserId: addReminder ? reminderForUserId : null,
        });
        onOpenChange(false);
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{logToEdit ? 'עריכת רישום תקשורת' : 'רישום שיחה חדשה'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>תאריך ושעה</Label>
                        <Input type="datetime-local" value={format(timestamp, "yyyy-MM-dd'T'HH:mm")} onChange={(e) => setTimestamp(new Date(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label>ערוץ תקשורת</Label>
                        <Select value={type} onValueChange={(v) => setType(v as CommunicationLog['type'])}>
                            <SelectTrigger>
                                <SelectValue placeholder="בחר ערוץ..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="phone">שיחת טלפון</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="email">אימייל</SelectItem>
                                <SelectItem value="other">אחר</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <Label>סיכום</Label>
                        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="סכם את תוכן השיחה או ההודעה..." rows={5} />
                    </div>
                    <Separator />
                     <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Switch id="add-reminder-switch" checked={addReminder} onCheckedChange={setAddReminder} />
                            <Label htmlFor="add-reminder-switch">הוסף תזכורת</Label>
                        </div>
                        {addReminder && (
                            <div className="pl-6 space-y-4 border-r-2 border-primary/50 pr-4">
                                <div className="space-y-2">
                                    <Label>תאריך ושעת תזכורת</Label>
                                    <Input type="datetime-local" value={reminderAt} onChange={e => setReminderAt(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>תזכורת עבור</Label>
                                     <Select value={reminderForUserId} onValueChange={setReminderForUserId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר מנהל..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {adminUsers.map(user => (
                                                <SelectItem key={user.id} value={user.id}>{user.firstName} {user.lastName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמור רישום</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export function AdminClientDetails({ initialClient }: { initialClient: Client }) {
  const { user } = useAdminUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [client, setClient] = useState<Client>(initialClient);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [lastAppointment, setLastAppointment] = useState<Appointment | null>(null);
  const [allClientAppointments, setAllClientAppointments] = useState<Appointment[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, startMutation] = useTransition();
  const [isSavingNote, startSavingNote] = useTransition();
  const [isDeletingForm, startDeletingForm] = useTransition();
  const [activeTab, setActiveTab] = useState("overview");

  const [isFillingNote, setIsFillingNote] = useState(false);
  const [noteForAppointment, setNoteForAppointment] = useState<Appointment | null>(null);
  const [editingNote, setEditingNote] = useState<FilledFormInstance | null>(null);
  const [summaryTemplates, setSummaryTemplates] = useState<TreatmentFormTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<TreatmentFormTemplate[]>([]);
  const [clientFormHistory, setClientFormHistory] = useState<FilledFormInstance[]>([]);
  const [viewingInstance, setViewingInstance] = useState<FilledFormInstance | null>(null);
  const [editingFlag, setEditingFlag] = useState<ClientFlag | null>(null);
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false);
  const [viewingSignedInstance, setViewingSignedInstance] = useState<FilledFormInstance | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  const [manualImages, setManualImages] = useState<any[]>([]);
  const [viewingImage, setViewingImage] = useState<ClientImage | null>(null);

  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  const [isCommLogDialogOpen, setIsCommLogDialogOpen] = useState(false);
  const [editingCommLog, setEditingCommLog] = useState<CommunicationLog | null>(null);


  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [isSignDocModalOpen, setIsSignDocModalOpen] = useState(false);
  const [isSendFormsDialogOpen, setIsSendFormsDialogOpen] = useState(false);
  const [signDialogMode, setSignDialogMode] = useState<'upload' | 'select'>('upload');

  const { toast } = useToast();

  const fetchData = async (clientId: string, businessId: string) => {
    setIsLoading(true);
    const now = new Date();
    
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(now.getFullYear() - 5);
    const oneYearInFuture = new Date();
    oneYearInFuture.setFullYear(now.getFullYear() + 1);


    const [refreshedClient, allAppointments, fetchedTemplates, allClientsData, formInstancesSnapshot, fetchedAdminUsers] = await Promise.all([
      getClientById(clientId),
      getAppointments(fiveYearsAgo, oneYearInFuture, businessId, clientId),
      getFormTemplates(),
      getClients(businessId),
      getDocs(query(collection(db, "formInstances"), where("clientId", "==", clientId))),
      getUsers(),
    ]);

    if (refreshedClient) {
      setClient(refreshedClient);
    }

    const sortedAppointments = allAppointments.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    setAllClientAppointments(sortedAppointments);

    const futureApps = sortedAppointments.filter(a => new Date(a.start) >= now && ['scheduled', 'confirmed', 'pending'].includes(a.status));
    const pastApps = sortedAppointments.filter(a => new Date(a.start) < now);

    setNextAppointment(futureApps[0] || null);
    setLastAppointment(pastApps[pastApps.length - 1] || null);

    setAllTemplates(fetchedTemplates);
    setSummaryTemplates(fetchedTemplates.filter(t => t.type === 'summary'));
    setAllClients(allClientsData);
    setAdminUsers(fetchedAdminUsers);

    const history = formInstancesSnapshot.docs.map(doc => ({
        ...doc.data(),
        instanceId: doc.id,
        assignedAt: doc.data().assignedAt?.toDate ? doc.data().assignedAt.toDate().toISOString() : doc.data().assignedAt,
        filledAt: doc.data().filledAt?.toDate ? doc.data().filledAt.toDate().toISOString() : doc.data().filledAt,
    })) as FilledFormInstance[];
    
    setClientFormHistory(history);

    const docs = getFromLocalStorage<any[]>(`client_docs_${clientId}`, []);
    setUploadedDocs(docs);

    const manual = getFromLocalStorage<any[]>(`client_manual_images_${clientId}`, []);
    setManualImages(manual);
    
    const commLogs = getFromLocalStorage<CommunicationLog[]>(`client_comm_logs_${clientId}`, []);
    setCommunicationLogs(commLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));


    setIsLoading(false);
  };

  useEffect(() => {
    const clientId = client.id;
    const businessId = client.businessId;
    if (clientId && businessId) {
      fetchData(clientId, businessId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id, client.businessId]);

  const handleSaveClientDetails = async (editedClient: Client) => {
    startMutation(async () => {
      const result = await saveClient(editedClient);
      setClient(result);
      setIsEditModalOpen(false);
      toast({ title: 'הצלחה!', description: 'פרטי הלקוח עודכנו.' });
    });
  };

  const handleStickyNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setClient(prev => ({ ...prev, stickyNote: e.target.value }));
  };

  const handleSaveStickyNote = () => {
    startMutation(async () => {
      await saveClient(client);
    });
  };

  const handleSaveFlag = (newOrUpdatedFlag: ClientFlag) => {
    startMutation(async () => {
      let updatedFlags;
      const isEditing = client.flagsSummary?.some(f => f.createdAtIso === newOrUpdatedFlag.createdAtIso);

      if (isEditing) {
        updatedFlags = client.flagsSummary?.map(f =>
          f.createdAtIso === newOrUpdatedFlag.createdAtIso ? newOrUpdatedFlag : f
        );
      } else {
        updatedFlags = [...(client.flagsSummary || []), newOrUpdatedFlag];
      }

      const updatedClient = { ...client, flagsSummary: updatedFlags };
      await saveClient(updatedClient);
      setClient(updatedClient);
      toast({ title: 'הצלחה!', description: 'הדגל נשמר.' });
    });
  };

  const handleDeleteFlag = (flagToDelete: ClientFlag) => {
    startMutation(async () => {
      const updatedFlags = client.flagsSummary?.filter(f => f.createdAtIso !== flagToDelete.createdAtIso);
      const updatedClient = { ...client, flagsSummary: updatedFlags };
      await saveClient(updatedClient);
      setClient(updatedClient);
      toast({ title: 'הצלחה!', description: 'הדגל נמחק.' });
    });
  };

  const handleOpenFlagDialog = (flag: ClientFlag | null) => {
    setEditingFlag(flag);
    setIsFlagDialogOpen(true);
  };

  const handleDeleteUploadedDoc = (docId: string) => {
    startMutation(async () => {
      const updatedDocs = uploadedDocs.filter(d => d.id !== docId);
      setInLocalStorage(`client_docs_${client.id}`, updatedDocs);
      setUploadedDocs(updatedDocs);
      toast({ title: "הצלחה!", description: "המסמך נמחק." });
    });
  };
  
    const handleDeletePendingForm = (instanceId: string) => {
    startDeletingForm(async () => {
        const result = await deleteFormInstance(instanceId);
        if (result.success) {
            toast({ title: 'הצלחה!', description: `הטופס נמחק בהצלחה.` });
            fetchData(client.id, client.businessId);
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: result.error || 'לא ניתן היה למחוק את הטופס.' });
        }
    });
};


  const age = getAge(client.birthDate);

  const getStatusText = (app: Appointment): string => {
    const isPast = new Date(app.start) < new Date();
    if (isPast && (app.status === 'scheduled' || app.status === 'confirmed')) {
        return 'הושלם';
    }
    switch (app.status) {
      case 'completed': return 'הושלם';
      case 'no-show': return 'לא הופיע/ה';
      case 'cancelled': return 'בוטל';
      case 'scheduled': return 'מתוכנן';
      case 'pending': return 'ממתין לאישור';
      case 'confirmed': return 'מאושר';
      default: return app.status;
    }
  };

  const getStatusClass = (app: Appointment): string => {
      const isPast = new Date(app.start) < new Date();
      const displayStatus = (isPast && (app.status === 'scheduled' || app.status === 'confirmed')) ? 'completed' : app.status;
      switch (displayStatus) {
        case 'completed':
        case 'scheduled':
        case 'confirmed':
            return 'bg-green-100 text-green-800';
        case 'cancelled':
        case 'no-show':
            return 'bg-red-100 text-red-800';
        case 'pending':
            return 'bg-orange-100 text-orange-800';
        default:
            return 'bg-gray-100 text-gray-800';
      }
  };

  const getSummaryTemplateForService = (serviceId: string): TreatmentFormTemplate | undefined => {
    if (!serviceId) return undefined;
    return summaryTemplates.find(t => t.serviceIds?.includes(serviceId));
  };
  

  const handleStartFillingNote = (appointment: Appointment, draftInstance?: FilledFormInstance) => {
    const mainServiceId = appointment.serviceId.split(',')[0];
    const template = getSummaryTemplateForService(mainServiceId);
    
    if (!template) {
      toast({ variant: "destructive", title: "שגיאה", description: "לא נמצאה תבנית סיכום המשויכת לשירות זה. יש ליצור תבנית מתאימה בהגדרות." });
      return;
    }
    setNoteForAppointment(appointment);
    setEditingNote(draftInstance || null);
    setIsFillingNote(true);
  };

  const handleSaveNote = (instance: FilledFormInstance, clientUpdate?: Partial<Client>) => {
    startSavingNote(async () => {
        if (clientUpdate && Object.keys(clientUpdate).length > 0) {
            try {
                const clientToUpdate = { ...client, ...clientUpdate };
                const updatedClient = await saveClient(clientToUpdate);
                setClient(updatedClient); 
                toast({ title: "הצלחה!", description: "פרטי הלקוח עודכנו." });
            } catch (error) {
                toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לעדכן את פרטי הלקוח." });
                return;
            }
        }
        
        const existingIndex = clientFormHistory.findIndex(h => h.instanceId === instance.instanceId);
        let newHistory;
        if (existingIndex > -1) {
            newHistory = [...clientFormHistory];
            newHistory[existingIndex] = instance;
        } else {
            newHistory = [...clientFormHistory, instance];
        }

        setInLocalStorage(`clientTreatmentHistory_${client.id}`, newHistory);
        setClientFormHistory(newHistory);
        setIsFillingNote(false);
        setNoteForAppointment(null);
        setEditingNote(null);
        toast({ title: "הצלחה!", description: `סיכום הטיפול נשמר ${instance.status === 'draft' ? 'כטיוטה' : 'באופן סופי'}.` });
        setActiveTab("summaries");
    });
  };

  const handleViewNote = (instanceId: string) => {
    const instance = clientFormHistory.find(inst => inst.instanceId === instanceId);
    if (instance) {
      setViewingInstance(instance);
    }
  };

  const handleSaveCommLog = async (logData: Omit<CommunicationLog, 'id'>) => {
        let updatedLogs;
        const logWithId = { ...logData, id: editingCommLog?.id || crypto.randomUUID() };

        if (editingCommLog) {
            // Update
            updatedLogs = communicationLogs.map(log => 
                log.id === editingCommLog.id ? logWithId : log
            );
        } else {
            // Create
            updatedLogs = [logWithId, ...communicationLogs];
        }
        
        if (logWithId.reminderAt && logWithId.reminderForUserId) {
            await createReminder({
                reminderAt: logWithId.reminderAt,
                userId: logWithId.reminderForUserId,
                clientId: client.id,
                clientName: `${client.firstName} ${client.lastName}`,
                summary: logWithId.summary,
                commLogId: logWithId.id,
            });
            toast({ title: 'תזכורת נוצרה', description: 'התזכורת תשלח למנהל בזמן שנקבע.' });
        }
        
        setCommunicationLogs(updatedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setInLocalStorage(`client_comm_logs_${client.id}`, updatedLogs);
        
        toast({ title: 'הצלחה', description: 'רישום התקשורת נשמר.' });
        setEditingCommLog(null);
  };
  
  const handleDeleteCommLog = (logId: string) => {
    const updatedLogs = communicationLogs.filter(log => log.id !== logId);
    setCommunicationLogs(updatedLogs);
    setInLocalStorage(`client_comm_logs_${client.id}`, updatedLogs);
    toast({ title: 'הצלחה', description: 'הרישום נמחק.' });
  };
  
  const handleOpenCommLogDialog = (log: CommunicationLog | null) => {
      setEditingCommLog(log);
      setIsCommLogDialogOpen(true);
  }

  const sortedAllAppointments = allClientAppointments.slice().sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  
  const allPastAppointments = sortedAllAppointments.filter(app => new Date(app.start) < new Date());


  const signedForms = clientFormHistory.filter(
    (instance) => instance.status === 'signed' && instance.signatureDetails
  );

  const pendingClientForms = clientFormHistory.filter(
    (instance) => instance.status === 'pending_client_fill'
  );

  const handleManualImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                const newImage = {
                    id: crypto.randomUUID(),
                    dataUrl,
                    createdAt: new Date().toISOString(),
                };
                const updatedImages = [...manualImages, newImage];
                setManualImages(updatedImages);
                setInLocalStorage(`client_manual_images_${client.id}`, updatedImages);
            };
            reader.readAsDataURL(file);
        });

        toast({ title: 'הצלחה!', description: `${files.length} תמונות הועלו בהצלחה.` });
    };

    const handleDeleteManualImage = (manualId: string) => {
        const updatedImages = manualImages.filter(img => img.id !== manualId);
        setManualImages(updatedImages);
        setInLocalStorage(`client_manual_images_${client.id}`, updatedImages);
        setViewingImage(null);
        toast({ title: 'הצלחה!', description: 'התמונה נמחקה.' });
    };
    
     const allClientImages: ClientImage[] = useMemo(() => {
        const images: ClientImage[] = [];

        // From forms/summaries in clientFormHistory
        clientFormHistory.forEach(instance => {
            const template = allTemplates.find(t => t.id === instance.templateId);
            if (!template || !instance.filledAt) return;

            template.fields.forEach(field => {
                if (field.type === 'image' && instance.data[field.id] && Array.isArray(instance.data[field.id])) {
                    (instance.data[field.id] as string[]).forEach(imgSrc => {
                        images.push({
                            src: imgSrc,
                            sourceType: template.type,
                            sourceName: template.name,
                            date: instance.filledAt!,
                            instanceId: instance.instanceId,
                        });
                    });
                }
            });
        });

        // From manual uploads
        manualImages.forEach(img => {
            images.push({
                src: img.dataUrl,
                sourceType: 'manual',
                sourceName: 'העלאה ידנית',
                date: img.createdAt,
                manualId: img.id,
            });
        });

        // Sort by date, newest first
        return images.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [clientFormHistory, manualImages, allTemplates]);


  if (isFillingNote && noteForAppointment) {
    const mainServiceId = noteForAppointment.serviceId.split(',')[0];
    const template = getSummaryTemplateForService(mainServiceId);
    if (!template) {
      setIsFillingNote(false);
      setNoteForAppointment(null);
      return null;
    }
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <FillTreatmentForm
          template={template}
          onSave={handleSaveNote}
          onCancel={() => { setIsFillingNote(false); setNoteForAppointment(null); setEditingNote(null); }}
          appointment={noteForAppointment}
          client={client}
          adminUserName={user ? `${user.firstName} ${user.lastName}` : 'מנהל/ת'}
          isSaving={isSavingNote}
          initialInstance={editingNote}
        />
      </div>
    );
  }

  const getCommLogIcon = (type: CommunicationLog['type']) => {
        switch (type) {
            case 'phone': return <Phone className="h-4 w-4 text-blue-500" />;
            case 'sms': return <MessageSquare className="h-4 w-4 text-orange-500" />;
            case 'whatsapp': return <MessageSquare className="h-4 w-4 text-green-500" />;
            case 'email': return <Mail className="h-4 w-4 text-red-500" />;
            default: return <MessageSquare className="h-4 w-4 text-gray-500" />;
        }
    };


  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2" />
              חזרה לרשימה
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{client.firstName} {client.lastName}</h1>
            {client.status && (
              <Badge className={cn('hidden sm:inline-flex', statusMap[client.status]?.className || '')}>
                {statusMap[client.status]?.text || client.status}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline"><Send className="mr-2" />שלח הודעה</Button>
          <Link href={`/admin/calendar?clientIdForNewAppointment=${client.id}`} passHref>
            <Button><CalendarIcon className="mr-2" />קבע תור</Button>
          </Link>
        </div>
      </div>

       <Card>
          <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={client.avatarUrl} alt={`${client.firstName} ${client.lastName}`} />
                    <AvatarFallback>{client.firstName.charAt(0)}{client.lastName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="text-center sm:text-right">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <h2 className="text-xl font-bold">{client.firstName} {client.lastName}</h2>
                         {client.status && (
                          <Badge className={cn('sm:hidden', statusMap[client.status]?.className || '')}>
                            {statusMap[client.status]?.text || client.status}
                          </Badge>
                        )}
                    </div>
                    {age && <p className="text-sm text-muted-foreground">גיל {age}</p>}
                  </div>
                  <div className="flex gap-2 sm:mr-auto">
                     <Button variant="outline" size="icon" asChild><a href={`tel:${client.phone}`}><Phone /></a></Button>
                     <Button variant="outline" size="icon" asChild><a href={`mailto:${client.email}`}><Mail /></a></Button>
                  </div>
              </div>
              <Separator />
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                   <div className="space-y-2">
                      <h4 className="font-semibold text-muted-foreground">תור הבא</h4>
                      {isLoading ? <Loader2 className="animate-spin" /> : nextAppointment ? (
                        <div className="space-y-1">
                          <p className="font-semibold">{nextAppointment.serviceName}</p>
                          <p className="text-sm">{format(new Date(nextAppointment.start), 'd MMMM, HH:mm', { locale: he })}</p>
                        </div>
                      ) : <p className="text-sm">אין תורים עתידיים</p>}
                   </div>
                   <div className="space-y-2">
                      <h4 className="font-semibold text-muted-foreground">ביקור אחרון</h4>
                       {isLoading ? <Loader2 className="animate-spin" /> : lastAppointment ? (
                        <div className="space-y-1">
                          <p className="font-semibold">{lastAppointment.serviceName}</p>
                          <p className="text-sm">{format(new Date(lastAppointment.start), 'd MMMM yyyy', { locale: he })}</p>
                        </div>
                      ) : <p className="text-sm">אין היסטוריית תורים</p>}
                   </div>
               </div>
          </CardContent>
      </Card>
      

      <Tabs value={activeTab} onValueChange={setActiveTab}>
         <ScrollArea className="w-full pb-2">
          <div className="flex w-full justify-end">
            <TabsList>
                <TabsTrigger value="communication">תקשורת</TabsTrigger>
                <TabsTrigger value="photos">תמונות</TabsTrigger>
                <TabsTrigger value="summaries">סיכומים</TabsTrigger>
                <TabsTrigger value="forms">מסמכים וטפסים</TabsTrigger>
                <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
            </TabsList>
          </div>
         </ScrollArea>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-6" dir="rtl">
            <Card className="bg-yellow-50 border-yellow-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Info className="mr-2" /> חשוב לדעת (הערת מטפל)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="רשום כאן דברים שחשוב לזכור על הלקוח/ה..."
                  value={client.stickyNote || ''}
                  onChange={handleStickyNoteChange}
                  className="bg-white"
                />
              </CardContent>
              <CardFooter className="justify-start">
                <Button size="sm" onClick={handleSaveStickyNote} disabled={isMutating}>
                  {isMutating ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}שמור הערה
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader><CardTitle>דגלים</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(client.flagsSummary || []).length > 0 ? (
                  (client.flagsSummary || []).map((flag, index) => (
                    <div key={index} className={`flex justify-between items-center p-2 rounded-md ${flagSeverityColors[flag.severity]}`}>
                      <span className="font-semibold">{flag.reason}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenFlagDialog(flag)}>
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>האם למחוק את הדגל?</AlertDialogTitle>
                              <AlertDialogDescription>
                                פעולה זו תמחק את הדגל "{flag.reason}" לצמיתות.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteFlag(flag)}>מחק</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))
                ) : <p className="text-muted-foreground text-sm text-center">אין דגלים ללקוח זה.</p>}

                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleOpenFlagDialog(null)}>
                  <PlusCircle className="mr-2" />הוסף דגל
                </Button>
              </CardContent>
            </Card>
              <Card>
                  <CardHeader><CardTitle>פעולות מהירות</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Dialog>
                          <DialogTrigger asChild>
                              <Button variant="outline"><PlusCircle className="mr-2" />סיכום טיפול</Button>
                          </DialogTrigger>
                          <DialogContent>
                              <DialogHeader>
                                  <DialogTitle>בחר תור לתיעוד</DialogTitle>
                                  <DialogDescription>
                                      בחר את הטיפול שעבורו ברצונך למלא סיכום.
                                  </DialogDescription>
                              </DialogHeader>
                              <div className="max-h-60 overflow-y-auto">
                                  {allPastAppointments.length > 0 ? (
                                      <ul className="space-y-2">
                                          {allPastAppointments.map(app => (
                                              <li key={app.id}>
                                                  <Button variant="ghost" className="w-full justify-between" onClick={() => handleStartFillingNote(app)}>
                                                      <span>{app.serviceName}</span>
                                                      <span className="text-muted-foreground text-xs">{format(new Date(app.start), 'dd/MM/yy')}</span>
                                                  </Button>
                                              </li>
                                          ))}
                                      </ul>
                                  ) : <p className="text-sm text-center text-muted-foreground p-4">אין טיפולים ללא סיכום.</p>}
                              </div>
                          </DialogContent>
                      </Dialog>
                      <Button variant="outline" onClick={() => setIsSendFormsDialogOpen(true)}><FileSignature className="mr-2" />מסמך לחתימה</Button>
                      <Button variant="outline" onClick={() => setIsFamilyModalOpen(true)}><UserPlus className="mr-2" />הוסף לבני משפחה</Button>
                      <Button variant="outline" onClick={() => setIsEditModalOpen(true)}><Pencil className="mr-2" />ערוך פרטים</Button>
                  </CardContent>
              </Card>
            </div>
        </TabsContent>
        <TabsContent value="forms" className="mt-4">
              <div className="space-y-6">
                  <Card>
                      <CardHeader>
                          <div className="flex justify-between items-center">
                              <CardTitle className="text-right">מסמכים וטפסים</CardTitle>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => { setIsSignDocModalOpen(true); }}>
                                    <Upload className="mr-2" />
                                    העלה מסמך PDF
                                </Button>
                                <Button variant="outline" onClick={() => setIsSendFormsDialogOpen(true)}>
                                    <FileText className="mr-2" />
                                    שלח מהמאגר
                                </Button>
                              </div>
                          </div>
                          <CardDescription className="text-right">
                              מסמכים שנשלחו ללקוח למילוי או חתימה.
                          </CardDescription>
                      </CardHeader>
                      <CardContent>
                           {pendingClientForms.length > 0 && (
                            <>
                              <h3 className="font-semibold mb-2 text-right">ממתין למילוי על ידי הלקוח</h3>
                               <ul className="space-y-2">
                                  {pendingClientForms.map((form) => (
                                      <li key={form.instanceId} className="flex items-center text-sm p-3 border rounded-md bg-yellow-50 border-yellow-200">
                                          <p className="flex-grow">{form.templateName}</p>
                                           <div className="flex items-center gap-2 ml-auto">
                                                <p className="text-xs text-yellow-700">נשלח בתאריך {format(new Date(form.assignedAt), 'dd.MM.yy')}</p>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isDeletingForm}>
                                                            <Trash2 className="h-4 w-4 text-destructive"/>
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>האם למחוק טופס שנשלח?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                פעולה זו תמחק את הטופס "{form.templateName}" והלקוח לא יוכל למלא אותו. לא ניתן לשחזר.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeletePendingForm(form.instanceId)} disabled={isDeletingForm}>
                                                                {isDeletingForm ? <Loader2 className="animate-spin" /> : "מחק"}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                           </div>
                                      </li>
                                  ))}
                              </ul>
                              <Separator className="my-4" />
                            </>
                          )}
                          
                          {uploadedDocs.length > 0 && (
                              <ul className="space-y-2">
                                  {uploadedDocs.map((doc) => (
                                      <li key={doc.id} className="flex items-center p-3 border rounded-md bg-accent/50">
                                          <div className="text-right flex-grow">
                                              <p className="font-semibold">{doc.name}</p>
                                              <p className="text-sm text-muted-foreground">
                                                  סטטוס: {doc.status === 'pending_signature' ? 'ממתין לחתימה' : 'נחתם'}
                                              </p>
                                          </div>
                                          <div className="flex items-center gap-1 ml-auto">
                                              <Button variant="ghost" size="icon" onClick={() => window.open(doc.dataUrl, '_blank')}>
                                                  <Eye className="h-4 w-4 text-blue-600"/>
                                              </Button>
                                              <AlertDialog>
                                                  <AlertDialogTrigger asChild>
                                                      <Button variant="ghost" size="icon">
                                                          <Trash2 className="h-4 w-4 text-destructive"/>
                                                      </Button>
                                                  </AlertDialogTrigger>
                                                  <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                          <AlertDialogTitle>האם למחוק את המסמך?</AlertDialogTitle>
                                                          <AlertDialogDescription>
                                                              פעולה זו תמחק את המסמך "{doc.name}" לצמיתות.
                                                          </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                          <AlertDialogAction onClick={() => handleDeleteUploadedDoc(doc.id)}>מחק</AlertDialogAction>
                                                      </AlertDialogFooter>
                                                  </AlertDialogContent>
                                              </AlertDialog>
                                          </div>
                                      </li>
                                  ))}
                              </ul>
                          )}
                           {signedForms.length > 0 && (
                            <>
                              <Separator className="my-4" />
                              <h3 className="font-semibold mb-2 text-right">טפסים חתומים</h3>
                               <ul className="space-y-2">
                                  {signedForms.map((form) => (
                                      <li key={form.instanceId} className="flex items-center text-sm p-3 border rounded-md bg-accent/50">
                                          <p className="flex-grow">{form.templateName}</p>
                                          <div className="flex items-center gap-2 ml-auto">
                                              <Badge className="bg-green-100 text-green-800">
                                                  חתום ({form.signatureDetails?.signedAt ? format(new Date(form.signatureDetails.signedAt), 'dd.MM.yy') : ''})
                                              </Badge>
                                              <Button variant="ghost" size="icon" onClick={() => setViewingSignedInstance(form)} className="h-7 w-7">
                                                  <Eye className="h-4 h-4 text-blue-600"/>
                                              </Button>
                                          </div>
                                      </li>
                                  ))}
                              </ul>
                            </>
                          )}
                          
                          {uploadedDocs.length === 0 && signedForms.length === 0 && pendingClientForms.length === 0 && (
                               <p className="text-muted-foreground text-center p-8">לא נשלחו או הועלו מסמכים.</p>
                          )}
                      </CardContent>
                  </Card>
              </div>
          </TabsContent>
          <TabsContent value="summaries" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>סיכומי טיפולים</CardTitle>
                      <CardDescription>כאן ניתן להוסיף או לצפות בסיכומי הטיפולים של הלקוח.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {isLoading ? (
                          <div className="flex justify-center p-8"><Loader2 className="animate-spin"/></div>
                      ) : (
                          <ul className="space-y-3">
                            {sortedAllAppointments.map((app) => {
                                const noteInstance = clientFormHistory.find((h) => h.appointmentId === app.id);
                                const canManage = user?.permission === 'owner' || user?.isSuperAdmin || user?.permission === 'developer';
                                const isPast = new Date(app.start) < new Date();

                                return (
                                  <li key={app.id} className="p-4 border rounded-lg bg-accent/20">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-bold">{app.serviceName}</p>
                                        <p className="text-sm text-muted-foreground">
                                          {format(new Date(app.start), 'eeee, d MMMM yyyy, HH:mm', { locale: he })}
                                        </p>
                                      </div>
                                      <Badge className={getStatusClass(app)}>{getStatusText(app)}</Badge>
                                    </div>
                                    <Separator className="my-3" />
                                    <div className="flex justify-end gap-2">
                                      <Button variant="outline" size="sm" disabled>
                                        <Camera className="mr-2" />
                                        תמונות
                                      </Button>
                                      <Button variant="outline" size="sm" disabled>
                                        <File className="mr-2" />
                                        מסמכים
                                      </Button>
                                      {noteInstance ? (
                                          noteInstance.status === 'draft' ? (
                                            <Button variant="default" size="sm" onClick={() => handleStartFillingNote(app, noteInstance)}>
                                              <Pencil className="mr-2" />
                                              המשך עריכת טיוטה
                                            </Button>
                                          ) : (
                                            canManage ? (
                                              <Button variant="default" size="sm" onClick={() => handleViewNote(noteInstance.instanceId)}>
                                                <Eye className="mr-2" />
                                                צפה בסיכום
                                              </Button>
                                            ) : (
                                              <Button variant="default" size="sm" disabled>
                                                <Eye className="mr-2" />
                                                צפייה למנהל
                                              </Button>
                                            )
                                          )
                                        ) : (
                                          <Button variant="default" size="sm" onClick={() => handleStartFillingNote(app)} disabled={!isPast}>
                                            <Pencil className="mr-2" />
                                            {isPast ? "הוסף סיכום" : "המתן לסיום התור"}
                                          </Button>
                                        )
                                      }
                                    </div>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="photos" className="mt-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>גלריית תמונות</CardTitle>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handleManualImageUpload}
                        />
                        <Button onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2" />
                            העלאת תמונות
                        </Button>
                    </div>
                    <CardDescription>
                        כל התמונות של הלקוח/ה, כולל העלאות ידניות, תמונות מטפסים וסיכומים.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {allClientImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {allClientImages.map((image, index) => (
                                <button key={index} onClick={() => setViewingImage(image)} className="group relative aspect-square w-full overflow-hidden rounded-lg border">
                                    <Image src={image.src} alt={`Image ${index + 1}`} layout="fill" className="object-cover transition-transform group-hover:scale-105" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-white text-xs text-center">
                                        <p>{new Date(image.date).toLocaleDateString('he-IL')}</p>
                                        <p className="truncate">{image.sourceName}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-16">לא נמצאו תמונות עבור לקוח/ה זו.</p>
                    )}
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="communication" className="mt-4">
               <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>יומן תקשורת</CardTitle>
                    <Button onClick={() => handleOpenCommLogDialog(null)}>
                      <PlusCircle className="mr-2" />
                      רישום שיחה חדשה
                    </Button>
                  </div>
                  <CardDescription>
                    תיעוד כל האינטראקציות והתקשורת עם הלקוח/ה.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {communicationLogs.length > 0 ? (
                    <div className="space-y-4">
                      {communicationLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-4 border-b pb-4 last:border-b-0">
                          <div className="flex-shrink-0 pt-1">{getCommLogIcon(log.type)}</div>
                          <div className="flex-grow">
                             <div className="flex justify-between items-baseline">
                                <p className="text-sm font-semibold">
                                  {format(new Date(log.timestamp), "d MMM yyyy, HH:mm", { locale: he })}
                                </p>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenCommLogDialog(log)}>
                                        <Pencil className="h-4 w-4 text-primary" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>למחוק רישום?</AlertDialogTitle></AlertDialogHeader>
                                            <AlertDialogDescription>פעולה זו היא סופית.</AlertDialogDescription>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteCommLog(log.id)}>מחק</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                             </div>
                            <p className="mt-1 text-sm whitespace-pre-wrap">{log.summary}</p>
                            {log.reminderAt && (
                                <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-md flex items-center gap-2">
                                    <Bell className="h-3 w-3" />
                                    <span>תזכורת ל{adminUsers.find(u => u.id === log.reminderForUserId)?.firstName || 'מנהל'} בתאריך {format(new Date(log.reminderAt), "dd/MM/yy HH:mm")}</span>
                                </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-16">
                      אין רישומי תקשורת עבור לקוח/ה זה.
                    </p>
                  )}
                </CardContent>
              </Card>
          </TabsContent>
        </Tabs>

        <FlagDialog 
          onSave={handleSaveFlag}
          onOpenChange={setIsFlagDialogOpen}
          isOpen={isFlagDialogOpen}
          flagToEdit={editingFlag}
        />
        <ViewSignedFormDialog
            isOpen={!!viewingSignedInstance}
            onOpenChange={(isOpen) => !isOpen && setViewingSignedInstance(null)}
            instance={viewingSignedInstance}
            template={viewingSignedInstance ? allTemplates.find(t => t.id === viewingSignedInstance.templateId) || null : null}
            client={client}
        />
         <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                <DialogTitle>עריכת פרטי לקוח</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label htmlFor="firstName">שם פרטי</Label>
                            <Input id="firstName" value={client.firstName} onChange={(e) => setClient({...client, firstName: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="lastName">שם משפחה</Label>
                            <Input id="lastName" value={client.lastName} onChange={(e) => setClient({...client, lastName: e.target.value})} />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <Label htmlFor="email">כתובת אימייל</Label>
                        <Input id="email" type="email" value={client.email || ''} onChange={(e) => setClient({...client, email: e.target.value})} />
                    </div>

                    <div className="space-y-1">
                      <Label>תאריך לידה</Label>
                      <BirthDateSelector
                        value={client.birthDate ? new Date(client.birthDate) : null}
                        onChange={(date) => setClient({ ...client, birthDate: date ? date.toISOString() : null })}
                        disabled={isMutating}
                      />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="phone">מספר טלפון</Label>
                        <Input id="phone" value={client.phone} disabled />
                    </div>
                    
                    <div className="space-y-2">
                        <Label>מין</Label>
                        <RadioGroup value={client.gender} onValueChange={(value) => setClient({ ...client, gender: value as 'male' | 'female' })} className="flex gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="female" id="female-edit" />
                                <Label htmlFor="female-edit" className="font-normal">נקבה</Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="male" id="male-edit" />
                                <Label htmlFor="male-edit" className="font-normal">זכר</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="idNumber">תעודת זהות</Label>
                        <Input id="idNumber" value={client.idNumber || ''} onChange={(e) => setClient({...client, idNumber: e.target.value})} />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="city">עיר</Label>
                        <Input id="city" value={client.city || ''} onChange={(e) => setClient({...client, city: e.target.value})} />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1 col-span-2">
                            <Label htmlFor="street">רחוב</Label>
                            <Input id="street" value={client.street || ''} onChange={(e) => setClient({...client, street: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="houseNumber">מס' בית</Label>
                            <Input id="houseNumber" value={client.houseNumber || ''} onChange={(e) => setClient({...client, houseNumber: e.target.value})} />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>ביטול</Button>
                    <Button onClick={() => handleSaveClientDetails(client)} disabled={isMutating}>
                        {isMutating ? <Loader2 className="animate-spin"/> : "שמור"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <FamilyManagementDialog
          isOpen={isFamilyModalOpen}
          onOpenChange={setIsFamilyModalOpen}
          client={client}
          allClients={allClients}
          onUpdate={() => fetchData(client.id, client.businessId)}
        />
        <Dialog open={isSignDocModalOpen} onOpenChange={(open) => {
                if (!open) { setIsSignDocModalOpen(false) }
            }}>
             <DialogContent>
                <DialogHeader>
                    <DialogTitle>העלה מסמך לחתימה</DialogTitle>
                </DialogHeader>
             </DialogContent>
        </Dialog>
        <SendFormsDialog 
            isOpen={isSendFormsDialogOpen}
            onOpenChange={setIsSendFormsDialogOpen}
            clientId={client.id}
            onSend={() => fetchData(client.id, client.businessId)}
        />
        <ViewTreatmentInstanceDialog
            isOpen={!!viewingInstance}
            onOpenChange={(isOpen) => !isOpen && setViewingInstance(null)}
            instance={viewingInstance}
            template={viewingInstance ? summaryTemplates.find(t => t.id === viewingInstance.templateId) || null : null}
            client={client}
            adminUserName={user ? `${user.firstName} ${user.lastName}` : 'מנהל/ת'}
        />
        <ViewImageDialog
            image={viewingImage}
            onClose={() => setViewingImage(null)}
            onDelete={handleDeleteManualImage}
        />
        <CommunicationLogDialog
            isOpen={isCommLogDialogOpen}
            onOpenChange={setIsCommLogDialogOpen}
            onSave={handleSaveCommLog}
            logToEdit={editingCommLog}
            adminUsers={adminUsers}
        />
    </div>
  );
}
