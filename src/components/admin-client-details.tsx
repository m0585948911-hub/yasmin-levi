'use client';

import React from 'react';

import { getSettingsForClient } from '@/lib/settings';
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
  Bell,
  Video,
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
import { collection, doc, writeBatch, query, where, getDocs, onSnapshot, addDoc, setDoc, deleteDoc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFormTemplates, deleteFormInstance, type TreatmentFormTemplate, type FormField, type FormFieldType, type FilledFormInstance, type SignatureDetails } from '@/lib/form-templates';
import { BirthDateSelector } from './birth-date-selector';
import { SignaturePad } from './signature-pad';
import { User, getUsers } from '@/lib/users';
import { getServices, type Service } from '@/lib/services';
import { createReminder } from '@/lib/reminders';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


interface ClientMedia {
    src: string;
    type: 'image' | 'video';
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

function FamilyManagementDialog({
    isOpen, onOpenChange, client, allClients, onUpdate
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    client: Client;
    allClients: Client[];
    onUpdate: () => void;
}) {
    const [relations, setRelations] = useState<FamilyRelation[]>(client.familyRelations || []);
    const [isMutating, startMutation] = useTransition();
    const { toast } = useToast();



    // To add a new relation
    const [search, setSearch] = useState('');
    const [selectedClientToAdd, setSelectedClientToAdd] = useState<Client | null>(null);
    const [selectedRelation, setSelectedRelation] = useState<Relationship>('daughter');

    useEffect(() => {
        setRelations(client.familyRelations || []);
    }, [isOpen, client]); // Reset when opening or client changes

    const handleRemoveRelation = (memberId: string) => {
        setRelations(prev => prev.filter(r => r.memberId !== memberId));
    };

    const handleAddRelation = () => {
        if (!selectedClientToAdd) {
            toast({ title: "שגיאה", description: "יש לבחור לקוח להוספה." });
            return;
        }
        if (relations.some(r => r.memberId === selectedClientToAdd.id)) {
            toast({ title: "מידע", description: "הלקוח כבר מקושר." });
            return;
        }
        setRelations(prev => [...prev, { memberId: selectedClientToAdd.id, relation: selectedRelation }]);
        setSelectedClientToAdd(null);
        setSearch('');
    };

    const handleSave = () => {
        startMutation(async () => {
            const result = await updateFamilyRelations(client.id, relations, allClients);
            if (result.success) {
                toast({ title: "הצלחה!", description: "קשרי המשפחה עודכנו." });
                onUpdate(); // This should trigger a refetch in the parent
                onOpenChange(false);
            } else {
                toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לשמור את השינויים." });
            }
        });
    };
    
    const relationOptions: { value: Relationship, label: string }[] = [
        { value: 'son', label: 'בן' }, { value: 'daughter', label: 'בת' },
        { value: 'father', label: 'אבא' }, { value: 'mother', label: 'אמא' },
        { value: 'brother', label: 'אח' }, { value: 'sister', label: 'אחות' },
    ];
    
    const getRelationLabel = (relation: Relationship) => {
      return relationOptions.find(o => o.value === relation)?.label || relation;
    };
    
    const filteredClientsForSearch = search
        ? allClients.filter(c =>
            (c.firstName + " " + c.lastName).toLowerCase().includes(search.toLowerCase()) &&
            c.id !== client.id &&
            !relations.some(r => r.memberId === c.id)
        ).slice(0, 5) // limit results
        : [];
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>ניהול קשרי משפחה עבור {client.firstName}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>קשרים קיימים</Label>
                        {relations.length > 0 ? (
                             <ScrollArea className="h-32">
                                {relations.map(rel => {
                                    const member = allClients.find(c => c.id === rel.memberId);
                                    return (
                                        <div key={rel.memberId} className="flex items-center justify-between p-2 border rounded mb-2">
                                            <span>{member?.firstName} {member?.lastName} ({getRelationLabel(rel.relation)})</span>
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRelation(rel.memberId)}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    )
                                })}
                            </ScrollArea>
                        ) : <p className="text-sm text-muted-foreground text-center p-4 border rounded">אין קשרים מוגדרים.</p>}
                    </div>

                    <Separator />
                    
                    <div className="space-y-2">
                         <Label>הוספת קשר חדש</Label>
                         <div className="p-4 border rounded space-y-3 bg-accent/50">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Input 
                                        placeholder="חפש לקוח להוספה..." 
                                        value={search} 
                                        onChange={e => { setSearch(e.target.value); setSelectedClientToAdd(null); }} 
                                    />
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandList>
                                            <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                                            {filteredClientsForSearch.map(c => (
                                                <CommandItem key={c.id} onSelect={() => {
                                                    setSelectedClientToAdd(c);
                                                    setSearch(`${c.firstName} ${c.lastName}`);
                                                }}>
                                                    {c.firstName} {c.lastName}
                                                </CommandItem>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {selectedClientToAdd && (
                                <div className="flex items-end gap-2">
                                    <div className="flex-grow space-y-1">
                                        <Label>סוג הקרבה</Label>
                                         <Select value={selectedRelation} onValueChange={(v: Relationship) => setSelectedRelation(v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="בחר קרבה..."/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {relationOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleAddRelation}>הוסף</Button>
                                </div>
                            )}
                         </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave} disabled={isMutating}>
                        {isMutating ? <Loader2 className="animate-spin" /> : 'שמור שינויים'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function TreatmentTrackingCard({
instances
}:{instances:FilledFormInstance[]}){

const rows=instances
.slice()
.sort((a,b)=>
new Date(a.filledAt||a.assignedAt).getTime()-
new Date(b.filledAt||b.assignedAt).getTime()
)
.slice(0,10);

return (
<Card className="mb-8">
<CardContent className="p-6">

<h3 className="text-xl font-bold text-center mb-6">
כרטיס מעקב 10 טיפולים
</h3>

<Table>
<TableHeader>
<TableRow>
<TableHead>מס׳</TableHead>
<TableHead>תאריך</TableHead>
<TableHead>אזור</TableHead>
<TableHead>אנרגיה</TableHead>
<TableHead>עוצמה</TableHead>
<TableHead>תדירות</TableHead>
<TableHead>תשלום</TableHead>
</TableRow>
</TableHeader>

<TableBody>

{Array.from({length:10}).map((_,i)=>{
const row=rows[i];
const d=row?.data||{};

return(
<TableRow key={i}>
<TableCell>{i+1}</TableCell>
<TableCell>
{row?.filledAt
? format(new Date(row.filledAt),'dd/MM/yy')
: '-'}
</TableCell>

<TableCell>
{d['treatment_grid_rowLabel_0']
|| d['rowLabel_0']
|| '-'}
</TableCell>

<TableCell>
{d['treatment_grid_r0_c0']||'-'}
</TableCell>

<TableCell>
{d['treatment_grid_r0_c1']||'-'}
</TableCell>

<TableCell>
{d['treatment_grid_r0_c2']||'-'}
</TableCell>

<TableCell>
{d['payment']||'-'}
</TableCell>

</TableRow>
)
})}

</TableBody>
</Table>

</CardContent>
</Card>
);
}

function TreatmentSummaryTable({
    instances,
    templates,
    appointments = [],
}: {
    instances: FilledFormInstance[];
    templates: TreatmentFormTemplate[];
    appointments?: Appointment[];
}) {
    const [selectedAreaName, setSelectedAreaName] = useState<string | null>(null);

    const summaryFields = useMemo(() => {
        const fieldsMap = new Map<string, FormField>();
        templates.forEach(template => {
            (template.fields || []).forEach(field => {
                if (field.showInSummary && !fieldsMap.has(field.label)) {
                    fieldsMap.set(field.label, field);
                }
            });
        });
        return Array.from(fieldsMap.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }, [templates]);

    const instancesWithTemplate = useMemo(() => 
        instances
          .filter(instance => instance.status === 'completed' || instance.status === 'signed')
          .map(instance => ({
              instance,
              template: templates.find(t => t.id === instance.templateId)
          }))
          .filter((item): item is { instance: FilledFormInstance; template: TreatmentFormTemplate } => !!item.template),
        [instances, templates]
    );

    const getAreaNameFromInstance = (instance: FilledFormInstance, template: TreatmentFormTemplate) => {
        const directValue =
            instance.data?.treatmentArea ||
            instance.data?.treatmentAreas ||
            instance.data?.area ||
            instance.data?.areas;

        if (directValue) {
            return Array.isArray(directValue) ? directValue.join(', ') : String(directValue);
        }

        const areaField = template.fields?.find((field: any) =>
            ['אזור טיפול', 'איזור טיפול', 'אזורי טיפול', 'איזורי טיפול'].includes(String(field.label || '').trim())
        );

        if (areaField && instance.data?.[areaField.id]) {
            const value = instance.data[areaField.id];
            return Array.isArray(value) ? value.join(', ') : String(value);
        }

        return '';
    };

    const treatmentAreaStats = useMemo(() => {
        const appointmentById = new Map(appointments.map(app => [app.id, app]));
        const stats = new Map<string, { count: number; lastDate?: string }>();

        instancesWithTemplate.forEach(({ instance, template }) => {
            const appointment = instance.appointmentId ? appointmentById.get(instance.appointmentId) : undefined;
            const rawName = appointment?.serviceName || getAreaNameFromInstance(instance, template) || instance.templateName || template.name || 'טיפול לא מזוהה';

            const areaNames = rawName
                .split(',')
                .map(name => name.trim())
                .filter(Boolean);

            const uniqueAreaNames = Array.from(new Set(areaNames.length ? areaNames : [rawName]));

            uniqueAreaNames.forEach(areaName => {
                const current = stats.get(areaName) || { count: 0 };
                const candidateDate = instance.filledAt || appointment?.start || instance.assignedAt;

                stats.set(areaName, {
                    count: current.count + 1,
                    lastDate: !current.lastDate || new Date(candidateDate) > new Date(current.lastDate)
                        ? candidateDate
                        : current.lastDate,
                });
            });
        });

        return Array.from(stats.entries())
            .map(([areaName, data]) => ({ areaName, ...data }))
            .sort((a, b) => b.count - a.count || a.areaName.localeCompare(b.areaName, 'he'));
    }, [instancesWithTemplate, appointments]);

    const filteredInstancesWithTemplate = useMemo(() => {
        if (!selectedAreaName) return instancesWithTemplate;

        const appointmentById = new Map(appointments.map(app => [app.id, app]));

        return instancesWithTemplate.filter(({ instance, template }) => {
            const appointment = instance.appointmentId ? appointmentById.get(instance.appointmentId) : undefined;
            const rawName = appointment?.serviceName || getAreaNameFromInstance(instance, template) || instance.templateName || template.name || 'טיפול לא מזוהה';

            return rawName
                .split(',')
                .map(name => name.trim())
                .filter(Boolean)
                .includes(selectedAreaName);
        });
    }, [selectedAreaName, instancesWithTemplate, appointments]);

    if (instancesWithTemplate.length === 0) {
        return <p className="text-sm text-center text-muted-foreground py-4">אין סיכומי טיפולים להצגה.</p>;
    }


    return (
        <>
        {treatmentAreaStats.length > 0 && (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {treatmentAreaStats.map(item => (
                    <Card
                        key={item.areaName}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedAreaName(prev => prev === item.areaName ? null : item.areaName)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedAreaName(prev => prev === item.areaName ? null : item.areaName);
                            }
                        }}
                        className={`bg-muted/30 cursor-pointer transition hover:bg-muted/60 ${selectedAreaName === item.areaName ? 'ring-2 ring-primary' : ''}`}
                    >
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">אזור טיפול</p>
                            <p className="font-semibold">{item.areaName}</p>
                            <p className="text-2xl font-bold mt-2">{item.count}</p>
                            <p className="text-xs text-muted-foreground">
                                {item.count === 1 ? 'טיפול אחד' : 'טיפולים'}
                                {item.lastDate ? ` · אחרון: ${format(new Date(item.lastDate), 'dd/MM/yy')}` : ''}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}

        {selectedAreaName && (
            <div className="mb-3 flex items-center justify-between rounded-md border bg-accent/30 p-3">
                <p className="text-sm">
                    מציג טיפולים באזור: <span className="font-bold">{selectedAreaName}</span>
                    <span className="text-muted-foreground"> · {filteredInstancesWithTemplate.length} תוצאות</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAreaName(null)}>
                    נקה סינון
                </Button>
            </div>
        )}

        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>תאריך</TableHead>
                    {summaryFields.map(field => (
                        <TableHead key={field.id}>{field.label}</TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredInstancesWithTemplate.map(({ instance, template }) => (
                    <TableRow key={instance.instanceId}>
                        <TableCell className="font-medium">
                            {instance.filledAt ? format(new Date(instance.filledAt), 'dd/MM/yy') : '-'}
                        </TableCell>
                        {summaryFields.map(summaryField => {
                            const fieldInInstanceTemplate = template.fields.find(f => f.label === summaryField.label);
                            const value = fieldInInstanceTemplate ? instance.data[fieldInInstanceTemplate.id] : undefined;
                            
                            let displayValue: React.ReactNode = '-';
                            if (typeof value === 'boolean') {
                                displayValue = value ? 'כן' : 'לא';
                            } else if (Array.isArray(value)) {
                                displayValue = value.join(', ');
                            } else if (value) {
                                displayValue = String(value);
                            }

                            return (
                                <TableCell key={`${instance.instanceId}-${summaryField.id}`}>
                                    {displayValue}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
        </>
    );
};


const PrintableSummary = React.forwardRef<HTMLDivElement, {
    instance: FilledFormInstance,
    template: TreatmentFormTemplate,
    client: Client,
    adminUserName: string,
    settings: AllSettings | null,
    logoUrl: string | null,
}>(({ instance, template, client, adminUserName, settings, logoUrl }, ref) => {
    const business = settings?.businessDetails;
    const businessAddress = [
        business?.street,
        business?.houseNumber,
        business?.city,
    ].filter(Boolean).join(', ');
    const businessWebsite = settings?.appLinks?.website || '';
    
    // Grouping logic
    const sortedFields = template.fields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const fieldGroups: (FormField | FormField[])[] = [];
    let currentGroup: FormField[] = [];
    
    const isColumnar = (type: FormFieldType) => ['text', 'select', 'checkbox'].includes(type);

    sortedFields.forEach(field => {
        if (field.type === 'title' || field.type === 'subtitle' || !isColumnar(field.type)) {
            if (currentGroup.length > 0) {
                fieldGroups.push(currentGroup);
            }
            currentGroup = [];
            fieldGroups.push(field);
        } else {
            currentGroup.push(field);
        }
    });

    if (currentGroup.length > 0) {
        fieldGroups.push(currentGroup);
    }

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans" style={{ width: '210mm' }}>
            <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-800">{business?.businessName || ''}</h1>
                    {businessAddress && <p className="text-sm text-gray-500">{businessAddress}</p>}
                    {business?.phone && <p className="text-sm text-gray-500">טלפון: {business.phone}</p>}
                    {business?.email && <p className="text-sm text-gray-500">אימייל: {business.email}</p>}
                    {businessWebsite && <p className="text-sm text-gray-500">אתר: {businessWebsite}</p>}
                </div>
                {logoUrl && (
                    <div className="w-24 h-24 relative">
                        <Image unoptimized src={logoUrl} alt="Logo" layout="fill" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                    </div>
                )}
            </header>

            <main className="mt-8">
                <div className="text-center mb-6">
<h2 className="text-3xl font-bold">{template.name}</h2>
<p className="mt-2 text-sm">
סוג טיפול: {template.name || ""} • טיפול מספר {(instance.data?.treatmentNumber || 1)}
</p>
</div>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm mb-6 p-4 bg-gray-50 rounded-lg">
                    <div><span className="font-semibold">שם הלקוח/ה:</span> {client.firstName} {client.lastName}</div>
                    <div><span className="font-semibold">שם המטפל/ת:</span> {adminUserName}</div>
                    <div><span className="font-semibold">תאריך הטיפול:</span> {instance.filledAt ? new Date(instance.filledAt).toLocaleDateString('he-IL') : ''}</div>
                    <div><span className="font-semibold">שעת הטיפול:</span> {instance.filledAt ? new Date(instance.filledAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>

                <div className="space-y-4">
                  {fieldGroups.map((group, groupIndex) => {
                    if (!Array.isArray(group)) {
                      const field = group;
                      const value = instance.data[field.id];
                      
                      if (field.type === 'title') {
                          return <h3 key={field.id} className="text-lg font-semibold pt-4 border-b pb-1 mb-2">{field.label}</h3>;
                      }
                      if (field.type === 'subtitle') {
                          return <h4 key={field.id} className="text-md font-medium text-gray-600 pt-2">{field.label}</h4>;
                      }

                      let displayValue: React.ReactNode = '-';
                      if (field.type === 'dynamicGrid') {
 displayValue=renderDynamicGridForPrint(field,instance);
}
else if (field.type === 'signature') {
                          displayValue = value ? <div className="border p-1 mt-1 bg-white inline-block"><img src={value as string} alt="חתימה" style={{ width: '200px', height: '100px', objectFit: 'contain' }} /></div> : '-';
                      } else if (field.type === 'image') {
                         displayValue = (<div className="flex flex-wrap gap-2 mt-1">{(value as string[] || []).map((mediaSrc, idx) => (<div key={idx} className="w-32 h-32 relative border rounded">{mediaSrc.startsWith('data:image') ? (<Image unoptimized src={mediaSrc} alt={`${field.label} ${idx + 1}`} layout="fill" style={{width: '100%', height: '100%', objectFit: 'cover'}} />) : (<div className="w-full h-full bg-black text-white flex items-center justify-center">וידאו</div>)}</div>))}</div>);
                      } else if (value) {
                           displayValue = <p className="whitespace-pre-wrap">{String(value)}</p>;
                      }
                      
                      return (
                        <div key={field.id} className="pt-2 text-sm">
                           <div className="font-semibold col-span-1">{field.label}:</div>
                           <div className="col-span-2 mt-1">{displayValue}</div>
                        </div>
                      )

                    } else { // It's a group of columnar fields
                      return (
                        <div key={`group-${groupIndex}`} className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm pt-2">
                           {group.map(field => {
                                const value = instance.data[field.id];
                                let displayValue: React.ReactNode = '-';
                                if (typeof value === 'boolean') {
                                    displayValue = value ? 'כן' : 'לא';
                                } else if (Array.isArray(value)) {
                                    displayValue = value.join(', ');
                                } else if (value) {
                                     displayValue = String(value);
                                }
                                return (
                                    <div key={field.id} className="border-b pb-1">
                                        <span className="font-semibold">{field.label}:</span>
                                        <span className="ml-2">{displayValue}</span>
                                    </div>
                                )
                           })}
                        </div>
                      )
                    }
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

const renderDynamicGridForPrint = (field:any, instance:any) => {
 return (
   <table className="w-full border-collapse border mt-3 text-sm">
     <thead>
       <tr>
         <th className="border p-2">אזור טיפול</th>
         {(field.options||[]).filter(Boolean).map((c:string,i:number)=>(
           <th key={i} className="border p-2">{c}</th>
         ))}
       </tr>
     </thead>
     <tbody>
       {Array.from({length:20}).map((_,r)=>{
         const first=instance.data[`${field.id}_r${r}_c0`];
         if(!first) return null;
         return (
          <tr key={r}>
            <td className="border p-2 font-semibold">
              {instance.data[`${field.id}_rowLabel_${r}`] || ('אזור '+(r+1))}
            </td>
            {(field.options||[]).filter(Boolean).map((_:any,c:number)=>(
             <td key={c} className="border p-2">
              {instance.data[`${field.id}_r${r}_c${c}`] || '-'}
             </td>
            ))}
          </tr>
         )
       })}
     </tbody>
   </table>
 )
};


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
    
    // Grouping logic
    const sortedFields = template.fields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const fieldGroups: (FormField | FormField[])[] = [];
    let currentGroup: FormField[] = [];
    const isColumnar = (type: FormFieldType) => ['text', 'select', 'checkbox'].includes(type);

    sortedFields.forEach(field => {
        if (field.type === 'title' || field.type === 'subtitle' || !isColumnar(field.type)) {
            if (currentGroup.length > 0) {
                fieldGroups.push(currentGroup);
            }
            currentGroup = [];
            fieldGroups.push(field);
        } else {
            currentGroup.push(field);
        }
    });

    if (currentGroup.length > 0) {
        fieldGroups.push(currentGroup);
    }

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans" style={{ width: '210mm' }}>
            <header className="flex justify-between items-center pb-4 border-b-2 border-gray-200">
                <div className="text-right">
                    <h1 className="text-3xl font-bold text-gray-800">{settings?.businessDetails?.businessName || ''}</h1>
                    <p className="text-sm text-gray-500">
                      {[settings?.businessDetails?.street, settings?.businessDetails?.houseNumber, settings?.businessDetails?.city].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-sm text-gray-500">טלפון: {settings?.businessDetails?.phone || ''}</p>
                    <p className="text-sm text-gray-500">אימייל: {settings?.businessDetails?.email || ''}</p>
                    <p className="text-sm text-gray-500">אתר: {settings?.appLinks?.website || ''}</p>
                </div>
                {logoUrl && (
                    <div className="w-24 h-24 relative">
                        <Image unoptimized src={logoUrl} alt="Logo" layout="fill" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
                    </div>
                )}
            </header>

            <main className="mt-8">
                <h2 className="text-2xl font-semibold text-center mb-6">{template.name}</h2>
                
                <div className="space-y-4">
                   {fieldGroups.map((group, groupIndex) => {
                      if (!Array.isArray(group)) {
                          const field = group;
                          const value = instance.data[field.id];
                          let displayValue: React.ReactNode = '-';

                          if (field.type === 'dynamicGrid') {
 displayValue=renderDynamicGridForPrint(field,instance);
}
if (field.type === 'personalDetails') {
                              return <div key={field.id}>{PersonalDetailsSection}</div>;
                          }
                          if (field.type === 'title') {
                              return <h3 key={field.id} className="text-lg font-semibold pt-4 border-b pb-1 mb-2">{field.label}</h3>;
                          }
                          if (field.type === 'subtitle') {
                              return <h4 key={field.id} className="text-md font-medium text-gray-600 pt-2">{field.label}</h4>;
                          }
                          
                          if (field.type === 'signature') {
                              displayValue = value ? <div className="border p-1 mt-1 bg-white inline-block"><img src={value as string} alt="חתימה" style={{ width: '200px', height: '100px', objectFit: 'contain' }} /></div> : '-';
                          } else if (value) {
                               displayValue = <p className="whitespace-pre-wrap">{String(value)}</p>;
                          }
                          
                          return (
                            <div key={field.id} className="pt-2 text-sm">
                               <div className="font-semibold col-span-1">{field.label}:</div>
                               <div className="col-span-2 mt-1">{displayValue}</div>
                            </div>
                          )
                      } else { // Columnar group
                          return (
                            <div key={`group-${groupIndex}`} className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm pt-2">
                               {group.map(field => {
                                    const value = instance.data[field.id];
                                    let displayValue: React.ReactNode = '-';
                                    if (typeof value === 'boolean') {
                                        displayValue = value ? 'כן' : 'לא';
                                    } else if (Array.isArray(value)) {
                                        displayValue = value.join(', ');
                                    } else if (value) {
                                         displayValue = String(value);
                                    }
                                    return (
                                        <div key={field.id} className="border-b pb-1">
                                            <span className="font-semibold">{field.label}:</span>
                                            <span className="ml-2">{displayValue}</span>
                                        </div>
                                    )
                               })}
                            </div>
                          )
                      }
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
        (async()=>{
const liveSettings = await getSettingsForClient();
console.log("PRINT SETTINGS", liveSettings);
setSettings(liveSettings);
})();
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
                        {(instance.data[field.id] as string[] || []).map((mediaSrc, idx) => (
                            <div key={idx} className="relative aspect-square w-full">
                            {mediaSrc.startsWith('data:image') ? (
                                <Image unoptimized src={mediaSrc} alt={`${field.label} ${idx + 1}`} layout="fill" className="object-cover rounded-md border" />
                            ) : (
                                <video src={mediaSrc} controls className="rounded-md border w-full h-full object-cover bg-black" />
                            )}
                            </div>
                        ))}
                        </div>
                    ) : field.type === 'signature' ? (
                         <div className="p-2 border rounded-md bg-white">
                            {instance.data[field.id] ? (
                                <Image unoptimized src={instance.data[field.id] as string} alt="חתימה" width={300} height={150} className="mx-auto object-contain" />
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
          <Button onClick={handlePrint} disabled={isPrinting || !settings}>
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

function ViewSignedFormDialog({ isOpen, onOpenChange, instance, template, client }: {
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  instance: FilledFormInstance | null,
  template: TreatmentFormTemplate | null,
  client: Client,
}) {
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
                                <Image unoptimized src={instance.data[field.id] as string} alt="חתימה" width={300} height={150} className="mx-auto object-contain" />
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


function CameraCaptureDialog({ isOpen, onOpenChange, onCapture }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onCapture: (dataUrl: string) => void }) {
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
            <DialogContent className="max-w-5xl">
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
  clientFormHistory,
  services,
}: {
  template: TreatmentFormTemplate,
  onSave: (instance: FilledFormInstance, clientUpdate?: Partial<Client>) => void,
  onCancel: () => void,
  appointment: Appointment,
  client: Client,
  adminUserName: string,
  isSaving: boolean,
  initialInstance: FilledFormInstance,
  clientFormHistory: FilledFormInstance[],
  services: Service[],
}) => {
  const [formData, setFormData] = useState<{ [fieldId: string]: string | boolean | string[] }>({});
  const [extraServices, setExtraServices] = useState<string[]>([]);
  
  const [editableClientDetails, setEditableClientDetails] = useState({
      firstName: client.firstName,
      lastName: client.lastName,
      birthDate: client.birthDate ? new Date(client.birthDate) : null,
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturingForFieldId, setCapturingForFieldId] = useState<string | null>(null);
  const { toast } = useToast();

  const getTreatmentNumberForArea = (areaName: string) => {
    const cleanArea = areaName.trim();
    if (!cleanArea) return 1;

    let count = 0;

    clientFormHistory.forEach((instance) => {
      const data = instance.data || {};
      const values = Object.values(data).map(v => String(v).trim());
      if (values.includes(cleanArea)) {
        count += 1;
      }
    });

    return count + 1;
  };

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
            alert(`ניתן להעלות עד ${maxImages} קבצים לשדה זה.`);
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
      alert(`ניתן להעלות עד ${maxImages} קבצים לשדה זה.`);
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
                    <div key={field.id} className="space-y-2 rounded-2xl border shadow-sm bg-white p-5">
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
                

                {field.type === 'appointmentTreatmentsTable' && (
                  <>
                  <div className="mb-4 flex gap-2">
                    <input
                      placeholder="הוסף טיפול ידנית"
                      className="border px-2 py-1 rounded"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val) {
                            setExtraServices(prev => [...prev, val]);
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-4 rounded-2xl border shadow-sm bg-white p-6 overflow-x-auto">

                    {(
  [
    ...(
      (appointment?.serviceId || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .map(id => {
          const service = services.find((s: Service) => s.id === id);
          return service?.name || id;
        })
    ),
    ...extraServices
  ].join(',')
)
                      .split(',')
                      .map(v=>v.trim())
                      .filter(Boolean)
                      .map((serviceName,index)=>(
                        <div
                          key={index}
                          className="rounded-xl border bg-slate-50 p-5 min-w-[760px]"
                        >

                          <div className="font-semibold text-base">
                            {serviceName}
                          </div>

                          <div className="grid md:grid-cols-3 gap-4">

                            <Input
                              placeholder="מספר טיפול"
                              value={(formData[`${field.id}_${index}_number`] as string)||''}
                              onChange={e=>handleFieldChange(
                                `${field.id}_${index}_number`,
                                e.target.value
                              )}
                            />

                            <Input
                              placeholder="עוצמה"
                              value={(formData[`${field.id}_${index}_power`] as string)||''}
                              onChange={e=>handleFieldChange(
                                `${field.id}_${index}_power`,
                                e.target.value
                              )}
                            />

                            <Input
                              placeholder="תדירות"
                              value={(formData[`${field.id}_${index}_freq`] as string)||''}
                              onChange={e=>handleFieldChange(
                                `${field.id}_${index}_freq`,
                                e.target.value
                              )}
                            />

                          </div>

                          <Textarea
                            placeholder="הערות לאזור זה"
                            value={(formData[`${field.id}_${index}_notes`] as string)||''}
                            onChange={e=>handleFieldChange(
                              `${field.id}_${index}_notes`,
                              e.target.value
                            )}
                          />

                        </div>
                      ))
                    }

                  </div>
                  </>
                )}


                {field.type === 'dynamicGrid' && (
                  <div className="overflow-x-auto rounded-xl border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center font-bold">מס׳ טיפול</TableHead>
<TableHead className="text-center font-bold">אזור טיפול</TableHead>
                          {(field.options || []).filter(Boolean).map((column, columnIndex) => (
                            <TableHead key={columnIndex} className="text-center font-bold">
                              {column}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(
  [
    ...(
      (appointment?.serviceId || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .map(id => {
          const service = services.find((s: Service) => s.id === id);
          return service?.name || id;
        })
    ),
    ...extraServices
  ].join(',')
)
                          .split(',')
                          .map(v => v.trim())
                          .filter(Boolean)
                          .map((serviceName, rowIndex) => (
                            <TableRow key={rowIndex}>
                              <TableCell className="text-center font-semibold">
{((formData.treatmentNumber as any) || 1)}
</TableCell>
<TableCell className="text-center font-semibold">
                                {serviceName}
                                {(() => {
                                  if (!formData[`${field.id}_rowLabel_${rowIndex}`]) {
                                    handleFieldChange(
                                      `${field.id}_rowLabel_${rowIndex}`,
                                      serviceName
                                    );
                                  }
                                  return null;
                                })()}
                              </TableCell>

                              {(field.options || []).filter(Boolean).map((column, columnIndex) => {
                                const cellKey = `${field.id}_r${rowIndex}_c${columnIndex}`;
                                return (
                                  <TableCell key={cellKey}>
                                    <Input
                                      placeholder={column}
                                      value={
(field.options?.[columnIndex]?.includes('מס')
 || field.options?.[columnIndex]?.includes('טיפול'))
? String(getTreatmentNumberForArea(serviceName))
: ((formData[cellKey] as string)||'')
}
                                      onChange={e => handleFieldChange(cellKey, e.target.value)}
                                    />
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>

                    {!(
  [
    ...(
      (appointment?.serviceId || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .map(id => {
          const service = services.find((s: Service) => s.id === id);
          return service?.name || id;
        })
    ),
    ...extraServices
  ].join(',')
).trim() && (
                      <p className="text-sm text-muted-foreground text-center p-4">
                        לא נמצאו טיפולים בתור הזה.
                      </p>
                    )}
                  </div>
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
                            accept="image/*,video/mp4"
                            onChange={e => handleImageUpload(e, field.id)}
                            className="mb-2 flex-grow"
                        />
                         <Button type="button" variant="outline" onClick={() => openCamera(field.id)}>
                            <Camera className="mr-2" />
                            צלם
                        </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(formData[field.id] as string[] || []).map((mediaSrc, idx) => (
                        <div key={idx} className="relative group">
                          {mediaSrc.startsWith('data:image') ? (
                            <img
                                src={mediaSrc}
                                alt="Uploaded preview"
                                className="rounded-md object-cover w-full aspect-square"
                            />
                          ) : (
                            <video
                                src={mediaSrc}
                                controls
                                className="rounded-md object-cover w-full aspect-square bg-black"
                            />
                          )}
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

function FlagDialog({ onSave, onOpenChange, isOpen, flagToEdit }: {
    onSave: (flag: ClientFlag) => void;
    onOpenChange: (open: boolean) => void;
    isOpen: boolean;
    flagToEdit: ClientFlag | null;
}) {
    const [reason, setReason] = useState('');
    const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('low');

    useEffect(() => {
        if (flagToEdit) {
            setReason(flagToEdit.reason);
            setSeverity(flagToEdit.severity);
        } else {
            setReason('');
            setSeverity('low');
        }
    }, [flagToEdit]);

    const handleSave = () => {
        if (!reason.trim()) {
            return;
        }
        const now = new Date().toISOString();
        const newFlag: ClientFlag = {
            type: 'operational', // Default type for now
            reason: reason.trim(),
            severity,
            active: true,
            createdAtIso: flagToEdit?.createdAtIso || now,
            lastChangedAtIso: now,
            source: 'clinician',
        };
        onSave(newFlag);
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{flagToEdit ? 'עריכת דגל' : 'הוספת דגל חדש'}</DialogTitle>
                    <DialogDescription>
                        הוסף התראה חשובה שתוצג תמיד בכרטיס הלקוח.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="flag-reason">סיבה</Label>
                        <Input
                            id="flag-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="לדוגמה: אלרגיה לפניצילין"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="flag-severity">רמת חומרה</Label>
                        <Select value={severity} onValueChange={(v: 'low' | 'medium' | 'high') => setSeverity(v)}>
                            <SelectTrigger id="flag-severity">
                                <SelectValue placeholder="בחר רמת חומרה" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">נמוכה</SelectItem>
                                <SelectItem value="medium">בינונית</SelectItem>
                                <SelectItem value="high">גבוהה</SelectItem>
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

function SendFormsDialog({
    isOpen, onOpenChange, clientId, onSend, allTemplates
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    clientId: string;
    onSend: () => void;
    allTemplates: TreatmentFormTemplate[];
}) {
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [isSending, startSending] = useTransition();
    const { toast } = useToast();

    const nonSummaryTemplates = useMemo(() => allTemplates.filter(t => t.type !== 'summary'), [allTemplates]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedTemplateIds([]);
        }
    }, [isOpen]);

    const toggleSelection = (templateId: string) => {
        setSelectedTemplateIds(prev =>
            prev.includes(templateId)
                ? prev.filter(id => id !== templateId)
                : [...prev, templateId]
        );
    };

    const handleSend = () => {
        if (selectedTemplateIds.length === 0) {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'יש לבחור לפחות טופס אחד לשליחה.' });
            return;
        }

        startSending(async () => {
            try {
                const batch = writeBatch(db);
                const now = new Date();

                selectedTemplateIds.forEach(templateId => {
                    const template = nonSummaryTemplates.find(t => t.id === templateId);
                    if (template) {
                        const newInstanceRef = doc(collection(db, 'formInstances'));
                        batch.set(newInstanceRef, {
                            templateId: template.id,
                            templateName: template.name,
                            clientId: clientId,
                            status: 'pending_client_fill',
                            assignedAt: Timestamp.fromDate(now),
                            data: {},
                        });
                    }
                });

                await batch.commit();
                toast({ title: 'הצלחה!', description: `${selectedTemplateIds.length} טפסים נשלחו ללקוח למילוי.` });
                onSend();
                onOpenChange(false);

            } catch (error) {
                console.error("Error sending forms:", error);
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לשלוח את הטפסים.' });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>שליחת טפסים למילוי</DialogTitle>
                    <DialogDescription>
                        בחר את הטפסים שברצונך לשלוח ללקוח. הלקוח יקבל התראה וימצא אותם באזור "המסמכים שלי".
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ScrollArea className="h-64">
                        <div className="space-y-2 pr-2">
                            {nonSummaryTemplates.map(template => (
                                <div key={template.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent">
                                    <Checkbox
                                        id={`template-${template.id}`}
                                        checked={selectedTemplateIds.includes(template.id)}
                                        onCheckedChange={() => toggleSelection(template.id)}
                                    />
                                    <Label htmlFor={`template-${template.id}`} className="flex-grow cursor-pointer">{template.name}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSend} disabled={isSending || selectedTemplateIds.length === 0}>
                        {isSending ? <Loader2 className="animate-spin" /> : 'שלח טפסים'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

function ViewMediaDialog({ media, onClose, onDelete }: {
    media: ClientMedia | null;
    onClose: () => void;
    onDelete: (manualId: string) => void;
}) {
    const [isDeleting, startDeleteTransition] = useTransition();

    if (!media) return null;

    const handleDelete = () => {
        if (media.manualId) {
            startDeleteTransition(() => {
                onDelete(media.manualId!);
            });
        }
    };

    return (
        <Dialog open={!!media} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{media.sourceName}</DialogTitle>
                    <DialogDescription>
                        צולם בתאריך: {new Date(media.date).toLocaleString('he-IL')}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 flex justify-center">
                    {media.type === 'image' ? (
                        <Image unoptimized src={media.src} alt="Media" width={800} height={600} className="max-h-[60vh] object-contain" />
                    ) : (
                        <video src={media.src} controls className="max-h-[60vh] w-full" />
                    )}
                </div>
                <DialogFooter className="justify-between">
                    <div>
                        {media.sourceType === 'manual' && media.manualId && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 className="mr-2" />}
                                        מחק
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>האם למחוק מדיה זו?</AlertDialogTitle>
                                        <AlertDialogDescription>פעולה זו היא סופית.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDelete}>מחק</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <a href={media.src} download={`media_${new Date(media.date).toISOString()}.jpg`}>
                                <Download className="mr-2" />
                                הורדה
                            </a>
                        </Button>
                        <Button onClick={onClose}>סגור</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function CommunicationLogDialog({ isOpen, onOpenChange, onSave, logToEdit, adminUsers }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (log: Omit<CommunicationLog, 'id'>) => void;
    logToEdit: CommunicationLog | null;
    adminUsers: User[];
}) {
    const [type, setType] = useState<CommunicationLog['type']>('phone');
    const [summary, setSummary] = useState('');
    const [addReminder, setAddReminder] = useState(false);
    const [reminderDateTime, setReminderDateTime] = useState('');
    const [reminderForUserId, setReminderForUserId] = useState('');
    const { user: currentUser } = useAdminUser();

    useEffect(() => {
        if (logToEdit) {
            setType(logToEdit.type);
            setSummary(logToEdit.summary);
            const hasReminder = !!logToEdit.reminderAt;
            setAddReminder(hasReminder);
            setReminderDateTime(hasReminder ? format(new Date(logToEdit.reminderAt!), "yyyy-MM-dd'T'HH:mm") : '');
            setReminderForUserId(logToEdit.reminderForUserId || currentUser?.id || '');
        } else {
            // Reset for new log
            setType('phone');
            setSummary('');
            setAddReminder(false);
            setReminderDateTime('');
            setReminderForUserId(currentUser?.id || '');
        }
    }, [logToEdit, isOpen, currentUser]);

    const handleSave = () => {
        const logData: Omit<CommunicationLog, 'id'> = {
            type,
            summary,
            timestamp: new Date().toISOString(),
            reminderAt: addReminder ? new Date(reminderDateTime).toISOString() : null,
            reminderForUserId: addReminder ? reminderForUserId : null,
        };
        onSave(logData);
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{logToEdit ? 'עריכת רישום תקשורת' : 'הוספת רישום תקשורת'}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="comm-type">סוג התקשורת</Label>
                        <Select value={type} onValueChange={(v: CommunicationLog['type']) => setType(v)}>
                            <SelectTrigger id="comm-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="phone">שיחת טלפון</SelectItem>
                                <SelectItem value="sms">הודעת SMS</SelectItem>
                                <SelectItem value="whatsapp">הודעת וואטסאפ</SelectItem>
                                <SelectItem value="email">אימייל</SelectItem>
                                <SelectItem value="other">אחר</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="comm-summary">סיכום</Label>
                        <Textarea id="comm-summary" value={summary} onChange={e => setSummary(e.target.value)} placeholder="תאר את נושא השיחה..." />
                    </div>
                     <div className="flex items-center space-x-2 space-x-reverse">
                        <Switch id="add-reminder-switch" checked={addReminder} onCheckedChange={setAddReminder} />
                        <Label htmlFor="add-reminder-switch">הוסף תזכורת להמשך טיפול</Label>
                    </div>
                    {addReminder && (
                        <div className="p-4 border rounded-md space-y-4 bg-accent/50">
                             <div className="space-y-2">
                                <Label htmlFor="reminder-time">תאריך ושעת התזכורת</Label>
                                <Input id="reminder-time" type="datetime-local" value={reminderDateTime} onChange={e => setReminderDateTime(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="reminder-user">תזכורת עבור</Label>
                                <Select value={reminderForUserId} onValueChange={setReminderForUserId}>
                                    <SelectTrigger id="reminder-user"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {adminUsers.map(u => (
                                            <SelectItem key={u.id} value={u.id}>{`${u.firstName} ${u.lastName}`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמור</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
  const [services, setServices] = useState<Service[]>([]);
  const [allTemplates, setAllTemplates] = useState<TreatmentFormTemplate[]>([]);
  const [clientFormHistory, setClientFormHistory] = useState<FilledFormInstance[]>([]);
  const [viewingInstance, setViewingInstance] = useState<FilledFormInstance | null>(null);
  const [editingFlag, setEditingFlag] = useState<ClientFlag | null>(null);
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false);
  const [viewingSignedInstance, setViewingSignedInstance] = useState<FilledFormInstance | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  const [manualImages, setManualImages] = useState<any[]>([]);
  const [viewingMedia, setViewingMedia] = useState<ClientMedia | null>(null);

  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>([]);
  const [isCommLogDialogOpen, setIsCommLogDialogOpen] = useState(false);
  const [editingCommLog, setEditingCommLog] = useState<CommunicationLog | null>(null);


  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [isSignDocModalOpen, setIsSignDocModalOpen] = useState(false);
  const [isSendFormsDialogOpen, setIsSendFormsDialogOpen] = useState(false);
  const [signDialogMode, setSignDialogMode] = useState<'upload' | 'select'>('upload');

  const { toast } = useToast();

   useEffect(() => {
    const clientId = initialClient.id;
    if (!clientId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    const unsubscribes: (() => void)[] = [];

    // Listen to client document
    unsubscribes.push(onSnapshot(doc(db, 'clients', clientId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const toIso = (date: any): string | null => {
            if (!date) return null;
            if (date instanceof Timestamp) return date.toDate().toISOString();
            if (date instanceof Date) return date.toISOString();
            return date; // Assume already a string
        }
        setClient({ id: docSnap.id, ...data, createdAt: toIso(data.createdAt)!, updatedAt: toIso(data.updatedAt), birthDate: toIso(data.birthDate) } as Client);
      }
    }));

    // Listen to appointments
    unsubscribes.push(onSnapshot(query(collection(db, 'appointments'), where('clientId', '==', clientId)), (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, start: (doc.data().start as Timestamp).toDate().toISOString(), end: (doc.data().end as Timestamp).toDate().toISOString() })) as Appointment[];
      const sortedAppointments = apps.sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      setAllClientAppointments(sortedAppointments);

      const now = new Date();
      const futureApps = sortedAppointments.filter(a => new Date(a.start) >= now && ['scheduled', 'confirmed', 'pending'].includes(a.status));
      const pastApps = sortedAppointments.filter(a => new Date(a.start) < now);

      setNextAppointment(futureApps[0] || null);
      setLastAppointment(pastApps[pastApps.length - 1] || null);
    }));

    // Listen to form instances
    unsubscribes.push(onSnapshot(query(collection(db, "formInstances"), where("clientId", "==", clientId)), (snapshot) => {
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            instanceId: doc.id,
            assignedAt: data.assignedAt?.toDate ? data.assignedAt.toDate().toISOString() : data.assignedAt,
            filledAt: data.filledAt?.toDate ? data.filledAt.toDate().toISOString() : data.filledAt,
        } as FilledFormInstance;
      });
      setClientFormHistory(history);
    }));

    // Listen to communication logs
    unsubscribes.push(onSnapshot(query(collection(db, 'clients', clientId, 'communicationLogs'), orderBy('timestamp', 'desc')), (snapshot) => {
        const logs = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp).toDate().toISOString(),
                reminderAt: data.reminderAt ? (data.reminderAt as Timestamp).toDate().toISOString() : null,
            } as CommunicationLog;
        });
        setCommunicationLogs(logs);
    }));

    // Listen to manual media
    unsubscribes.push(onSnapshot(query(collection(db, 'clients', clientId, 'manualMedia'), orderBy('createdAt', 'desc')), (snapshot) => {
        const media = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString() }));
        setManualImages(media);
    }));

    // One-time fetches
    Promise.all([getFormTemplates(), getClients(initialClient.businessId), getUsers(), getServices()]).then(([templates, clients, users, services]) => {
      setAllTemplates(templates);
      setSummaryTemplates(templates.filter(t => t.type === 'summary'));
      setAllClients(clients);
      setAdminUsers(users);
      setServices(services);
      setIsLoading(false);
    }).catch(error => {
        console.error("Error fetching one-time data:", error);
        setIsLoading(false);
        toast({variant: 'destructive', title: 'שגיאה', description: 'טעינת נתונים נכשלה'});
    });
    
    // Cleanup
    return () => unsubscribes.forEach(unsub => unsub());
  }, [initialClient.id, initialClient.businessId, toast]);


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
            // The listener will auto-update the UI
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

    const service = services.find(s => s.id === serviceId);
    const categoryId = service?.categoryId;

    return summaryTemplates.find(t =>
      t.serviceIds?.includes(serviceId) ||
      (!!categoryId && t.categoryIds?.includes(categoryId))
    );
  };
  

  const handleStartFillingNote = (appointment: Appointment, draftInstance?: FilledFormInstance) => {
    const mainServiceId = appointment.serviceId.split(',')[0];
    const template = getSummaryTemplateForService(mainServiceId);
    
    if (!template) {
      toast({ variant: "destructive", title: "שגיאה", description: "לא נמצאה תבנית סיכום המשויכת לשירות זה. יש ליצור תבנית מתאימה בהגדרות." });
      return;
    }

    let initialData = draftInstance?.data || {};
    const treatmentNumberField = template.fields.find(f => f.label === 'טיפול מספר');

    if (treatmentNumberField && !draftInstance) {
        const completedTreatmentsCount = clientFormHistory.filter(
            instance => instance.templateId === template.id && (instance.status === 'completed' || instance.status === 'signed')
        ).length;
        
        const newTreatmentNumber = completedTreatmentsCount + 1;
        
        initialData[treatmentNumberField.id] = String(newTreatmentNumber);
    }
    
    const instanceForForm: FilledFormInstance = draftInstance 
      ? { ...draftInstance, data: initialData }
      : {
          instanceId: crypto.randomUUID(),
          templateId: template.id,
          templateName: template.name,
          status: 'draft',
          assignedAt: new Date().toISOString(),
          appointmentId: appointment.id,
          clientId: client.id,
          data: initialData
        };

    setNoteForAppointment(appointment);
    setEditingNote(instanceForForm);
    setIsFillingNote(true);
  };

  const handleSaveNote = (instance: FilledFormInstance, clientUpdate?: Partial<Client>) => {
    startSavingNote(async () => {
        if (clientUpdate && Object.keys(clientUpdate).length > 0) {
            try {
                const clientToUpdate = { ...client, ...clientUpdate };
                await saveClient(clientToUpdate);
                toast({ title: "הצלחה!", description: "פרטי הלקוח עודכנו." });
            } catch (error) {
                toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לעדכן את פרטי הלקוח." });
                return;
            }
        }
        
        const { instanceId, ...dataToSave } = instance;
        const docRef = doc(db, "formInstances", instanceId);

        // Convert date strings back to Timestamps for Firestore
        const saveData: any = { ...dataToSave };
        if (saveData.assignedAt) saveData.assignedAt = Timestamp.fromDate(new Date(saveData.assignedAt));
        if (saveData.filledAt) saveData.filledAt = Timestamp.fromDate(new Date(saveData.filledAt));
        if (saveData.signatureDetails?.signedAt) {
             saveData.signatureDetails.signedAt = Timestamp.fromDate(new Date(saveData.signatureDetails.signedAt));
        }

        console.log("SAVING FORM INSTANCE DATA", saveData);
        await setDoc(docRef, saveData, { merge: true });

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
    if (!client) return;

    startMutation(async () => {
        const logId = editingCommLog?.id || doc(collection(db, 'clients', client.id, 'communicationLogs')).id;

        const dataForFirestore: any = {
            ...logData,
            timestamp: Timestamp.fromDate(new Date(logData.timestamp)),
            reminderAt: logData.reminderAt ? Timestamp.fromDate(new Date(logData.reminderAt)) : null,
        };

        if (logData.reminderAt && logData.reminderForUserId) {
            await createReminder({
                reminderAt: logData.reminderAt,
                userId: logData.reminderForUserId,
                clientId: client.id,
                clientName: `${client.firstName} ${client.lastName}`,
                summary: logData.summary,
                commLogId: logId,
            });
            toast({ title: 'תזכורת נוצרה', description: 'התזכורת תשלח למנהל בזמן שנקבע.' });
        }
        
        await setDoc(doc(db, 'clients', client.id, 'communicationLogs', logId), dataForFirestore, { merge: true });

        toast({ title: 'הצלחה', description: 'רישום התקשורת נשמר.' });
        setEditingCommLog(null);
        setIsCommLogDialogOpen(false);
    });
  };
  
  const handleDeleteCommLog = (logId: string) => {
    if (!client) return;
    startMutation(async () => {
        await deleteDoc(doc(db, 'clients', client.id, 'communicationLogs', logId));
        toast({ title: 'הצלחה', description: 'הרישום נמחק.' });
    });
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
        if (!client) return;
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        startMutation(async () => {
            for (const file of files) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                await new Promise<void>(resolve => {
                    reader.onload = async (e) => {
                        const dataUrl = e.target?.result as string;
                        await addDoc(collection(db, 'clients', client.id, 'manualMedia'), {
                            dataUrl,
                            createdAt: Timestamp.now(),
                        });
                        resolve();
                    };
                });
            }
            toast({ title: 'הצלחה!', description: `${files.length} קבצי מדיה הועלו בהצלחה.` });
        });
    };

    const handleDeleteManualImage = (manualId: string) => {
        if (!client) return;
        startMutation(async () => {
            await deleteDoc(doc(db, 'clients', client.id, 'manualMedia', manualId));
            setViewingMedia(null);
            toast({ title: 'הצלחה!', description: 'המדיה נמחקה.' });
        });
    };
    
     const allClientMedia: ClientMedia[] = useMemo(() => {
        const media: ClientMedia[] = [];

        // From forms/summaries in clientFormHistory
        clientFormHistory.forEach(instance => {
            const template = allTemplates.find(t => t.id === instance.templateId);
            if (!template || !instance.filledAt) return;

            template.fields.forEach(field => {
                if (field.type === 'image' && instance.data[field.id] && Array.isArray(instance.data[field.id])) {
                    (instance.data[field.id] as string[]).forEach(mediaSrc => {
                        media.push({
                            src: mediaSrc,
                            type: mediaSrc.startsWith('data:video') ? 'video' : 'image',
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
        manualImages.forEach(item => {
            media.push({
                src: item.dataUrl,
                type: item.dataUrl.startsWith('data:video') ? 'video' : 'image',
                sourceType: 'manual',
                sourceName: 'העלאה ידנית',
                date: item.createdAt,
                manualId: item.id,
            });
        });

        // Sort by date, newest first
        return media.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
          initialInstance={editingNote!}
          clientFormHistory={clientFormHistory}
          services={services}
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
            <TabsList className="grid grid-cols-5 w-full md:w-auto">
                <TabsTrigger value="communication">תקשורת</TabsTrigger>
                <TabsTrigger value="photos">מדיה</TabsTrigger>
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
                <CardHeader>
                    <CardTitle>סיכום טיפולים כללי</CardTitle>
                    <CardDescription>
                        ריכוז של המידע החשוב מכל הטיפולים הקודמים של הלקוח/ה.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <TreatmentTrackingCard
instances={clientFormHistory}
/>

<TreatmentSummaryTable
                        instances={clientFormHistory}
                        templates={allTemplates}
                        appointments={allPastAppointments}
                    />
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
              <div className="mx-auto max-w-4xl space-y-8 px-6 pb-10">
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
                          <CardDescription>
                              מסמכים שנשלחו ללקוח למילוי או חתימה.
                          </CardDescription>
                      </CardHeader>
                      <CardContent>
                           {pendingClientForms.length > 0 && (
                            <>
                              <h3 className="font-semibold mb-2">ממתין למילוי על ידי הלקוח</h3>
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
                                          <div className="flex-grow">
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
                              <h3 className="font-semibold mb-2">טפסים חתומים</h3>
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
                                              <div className="flex gap-2">
                                                <Button variant="default" size="sm" onClick={() => handleViewNote(noteInstance.instanceId)}>
                                                  <Eye className="mr-2" />
                                                  צפה בסיכום
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleStartFillingNote(app, noteInstance)}>
                                                  <Pencil className="mr-2" />
                                                  ערוך סיכום
                                                </Button>
                                              </div>
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
                        <CardTitle>גלריית מדיה</CardTitle>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,video/mp4"
                            multiple
                            onChange={handleManualImageUpload}
                        />
                        <Button onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2" />
                            העלאת מדיה
                        </Button>
                    </div>
                    <CardDescription>
                        כל קבצי המדיה של הלקוח/ה, כולל העלאות ידניות, תמונות וסרטונים מטפסים וסיכומים.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {allClientMedia.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {allClientMedia.map((media, index) => (
                                <button key={index} onClick={() => setViewingMedia(media)} className="group relative aspect-square w-full overflow-hidden rounded-lg border">
                                     {media.type === 'image' ? (
                                        <Image unoptimized src={media.src} alt={`Media ${index + 1}`} layout="fill" className="object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                        <>
                                            <video src={media.src} className="object-cover w-full h-full bg-black" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Video className="h-8 w-8 text-white" />
                                            </div>
                                        </>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1 text-white text-xs text-center">
                                        <p>{new Date(media.date).toLocaleDateString('he-IL')}</p>
                                        <p className="truncate">{media.sourceName}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-16">לא נמצאה מדיה עבור לקוח/ה זו.</p>
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
                                    <span>תזכורת ל{adminUsers.find(u => u.id === log.reminderForUserId)?.firstName || 'מנהל'} בתאריך {format(new Date(log.reminderAt), "dd/MM/yy HH:mm", { locale: he })}</span>
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
          onUpdate={() => { /* Listener will handle updates */ }}
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
            allTemplates={allTemplates}
            onSend={() => { /* Listener will handle updates */ }}
        />
        <ViewTreatmentInstanceDialog
            isOpen={!!viewingInstance}
            onOpenChange={(isOpen) => !isOpen && setViewingInstance(null)}
            instance={viewingInstance}
            template={viewingInstance ? summaryTemplates.find(t => t.id === viewingInstance.templateId) || null : null}
            client={client}
            adminUserName={user ? `${user.firstName} ${user.lastName}` : 'מנהל/ת'}
        />
        <ViewMediaDialog
            media={viewingMedia}
            onClose={() => setViewingMedia(null)}
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
// BUILD VERSION: 2026-05-03_06:14:46
// BUILD VERSION: 2026-05-03_06:28:32
