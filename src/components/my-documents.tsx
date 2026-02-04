
'use client';

import { Suspense, useEffect, useState, useTransition, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, FileText, FileSignature, CheckCircle2, Save, X, Camera } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import Link from "next/link";
import { Logo } from "./logo";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Client, getClientById } from "@/lib/clients";
import { useToast } from "@/hooks/use-toast";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFormTemplates, type TreatmentFormTemplate, type FormField, type FilledFormInstance, type SignatureDetails } from '@/lib/form-templates';
import { BirthDateSelector } from "./birth-date-selector";
import { SignaturePad } from "./signature-pad";

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

const ClientFillForm = ({
  template, onSave, onCancel, client, isSaving, initialInstance,
}: {
  template: TreatmentFormTemplate,
  onSave: (instance: FilledFormInstance) => void,
  onCancel: () => void,
  client: Client,
  isSaving: boolean,
  initialInstance: FilledFormInstance,
}) => {
  const [formData, setFormData] = useState<{ [fieldId: string]: string | boolean | string[] }>(initialInstance.data || {});

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = () => {
    let isValid = true;
    let hasSignature = false;
    template.fields.forEach(field => {
        if (field.type === 'signature') hasSignature = true;
        if (field.required && !['title', 'subtitle', 'personalDetails'].includes(field.type)) {
            const value = formData[field.id];
            if ((field.type === 'checkbox' || field.type === 'contentWithConsent' || field.type === 'signature') && !value) {
                isValid = false;
            } else if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
                isValid = false;
            }
        }
    });

    if (!isValid) {
      alert('נא למלא את כל שדות החובה כדי לשמור.');
      return;
    }

    const newInstance: FilledFormInstance = {
      ...initialInstance,
      status: hasSignature ? 'signed' : 'completed',
      filledAt: new Date().toISOString(),
      data: formData,
    };
    
    if (hasSignature) {
        const signatureField = template.fields.find(f => f.type === 'signature');
        if (signatureField) {
            newInstance.signatureDetails = {
                signedByName: `${client.firstName} ${client.lastName}`,
                signedAt: new Date().toISOString(),
                signatureImageStoragePath: formData[signatureField.id] as string,
                userAgent: navigator.userAgent,
                ipHash: 'mock_ip_hash', // In a real app, generate a hash of the user's IP
                dataHash: 'mock_data_hash', // In a real app, generate a hash of the form data
            }
        }
    }

    onSave(newInstance);
  };
  
  const PersonalDetailsSection = (
    <div className="space-y-3 mb-6 p-4 border rounded-lg bg-accent/20">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">שם פרטי</Label>
              <Input value={client.firstName} disabled />
          </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">שם משפחה</Label>
              <Input value={client.lastName} disabled />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground">טלפון</Label>
          <Input value={client.phone} disabled />
        </div>
        {client.birthDate && (
          <div className="space-y-1">
            <Label className="text-muted-foreground">תאריך לידה</Label>
            <Input value={new Date(client.birthDate).toLocaleDateString('he-IL')} disabled />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>נא למלא את כל הפרטים הנדרשים.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {template.fields.sort((a, b) => a.sortOrder - b.sortOrder).map(field => {
            if (field.type === 'title') return <h3 key={field.id} className="text-xl font-bold pt-4 border-b pb-2">{field.label}</h3>;
            if (field.type === 'subtitle') return <h4 key={field.id} className="text-lg font-semibold text-muted-foreground pt-2">{field.label}</h4>;
            if (field.type === 'personalDetails') return <div key={field.id}>{PersonalDetailsSection}</div>;
            if (field.type === 'contentWithConsent') {
                const isRequired = field.required;
                return (
                    <div key={field.id} className="space-y-2">
                        <Card><CardContent className="p-4"><ScrollArea className="h-24 w-full rounded-md border p-2"><pre className="text-sm whitespace-pre-wrap font-sans">{field.label}</pre></ScrollArea></CardContent></Card>
                        <div className="flex items-center space-x-2 space-x-reverse pt-2">
                            <Checkbox id={field.id} checked={(formData[field.id] as boolean) || false} onCheckedChange={checked => handleFieldChange(field.id, !!checked)} />
                            <Label htmlFor={field.id} className={cn(isRequired && "font-bold after:content-['*'] after:ml-0.5 after:text-red-500")}>קראתי, הבנתי ומאשר/ת את התוכן</Label>
                        </div>
                    </div>
                );
            }

            const isRequired = field.required;
            return (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className={cn(isRequired && "font-bold after:content-['*'] after:ml-0.5 after:text-red-500")}>{field.label}</Label>
                {field.type === 'text' && <Input id={field.id} value={(formData[field.id] as string) || ''} onChange={e => handleFieldChange(field.id, e.target.value)} />}
                {field.type === 'textarea' && <Textarea id={field.id} value={(formData[field.id] as string) || ''} onChange={e => handleFieldChange(field.id, e.target.value)} />}
                {field.type === 'checkbox' && <div className="flex items-center pt-2"><Checkbox id={field.id} checked={(formData[field.id] as boolean) || false} onCheckedChange={checked => handleFieldChange(field.id, !!checked)} /></div>}
                {field.type === 'select' && <Select onValueChange={value => handleFieldChange(field.id, value)} value={(formData[field.id] as string) || ''}><SelectTrigger id={field.id}><SelectValue placeholder="בחר..." /></SelectTrigger><SelectContent>{field.options.map((opt, i) => <SelectItem key={i} value={opt}>{opt}</SelectItem>)}</SelectContent></Select>}
                {field.type === 'signature' && <div className="space-y-2"><SignaturePad dataUrl={formData[field.id] as string | undefined} onEnd={dataUrl => handleFieldChange(field.id, dataUrl)} onClear={() => handleFieldChange(field.id, '')} />{isRequired && !formData[field.id] && <p className="text-sm font-medium text-destructive">חתימה היא שדה חובה.</p>}</div>}
              </div>
            );
        })}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>ביטול</Button>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : 'שמור ושלח'}
        </Button>
      </CardFooter>
    </Card>
  );
};

const ViewCompletedFormDialog = ({ isOpen, onOpenChange, instance, template }: {
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  instance: FilledFormInstance | null,
  template: TreatmentFormTemplate | null
}) => {
  if (!instance || !template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            הושלם בתאריך: {instance.filledAt ? new Date(instance.filledAt).toLocaleString('he-IL') : 'לא צוין'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {template.fields.sort((a, b) => ((a.sortOrder || 0) - (b.sortOrder || 0))).map(field => {
            if (field.type === 'title') {
                return <h3 key={field.id} className="text-lg font-semibold pt-4">{field.label}</h3>;
            }
            if (field.type === 'subtitle') {
                return <h4 key={field.id} className="text-md font-medium text-muted-foreground">{field.label}</h4>;
            }
            if (field.type === 'signature') {
              return (
                <div key={field.id} className="flex flex-col gap-1">
                  <Label className="font-semibold">{field.label}</Label>
                  <div className="p-2 border rounded-md bg-white">
                      {instance.data[field.id] ? (
                          <Image src={instance.data[field.id] as string} alt="חתימה" width={300} height={150} className="mx-auto object-contain" />
                      ) : (
                          <p className="text-muted-foreground text-center">לא נחתם</p>
                      )}
                  </div>
                </div>
              )
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגירה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function MyDocumentsContent() {
    const searchParams = useSearchParams();
    const [client, setClient] = useState<Client | null>(null);
    const [history, setHistory] = useState<FilledFormInstance[]>([]);
    const [templates, setTemplates] = useState<TreatmentFormTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fillingForm, setFillingForm] = useState<{instance: FilledFormInstance, template: TreatmentFormTemplate} | null>(null);
    const [isSubmitting, startSubmitting] = useTransition();
    const { toast } = useToast();
    const [viewingInstance, setViewingInstance] = useState<FilledFormInstance | null>(null);

    const clientId = searchParams.get('id');
    const dashboardLink = `/dashboard?${searchParams.toString()}`;

    useEffect(() => {
        if (!clientId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const fetchInitialData = async () => {
            const clientData = await getClientById(clientId);
            setClient(clientData);
            
            const fetchedTemplates = await getFormTemplates();
            setTemplates(fetchedTemplates);
        };
        
        fetchInitialData();

        const q = query(collection(db, "formInstances"), where("clientId", "==", clientId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const historyData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    instanceId: doc.id,
                    assignedAt: data.assignedAt?.toDate ? data.assignedAt.toDate().toISOString() : data.assignedAt,
                    filledAt: data.filledAt?.toDate ? data.filledAt.toDate().toISOString() : data.filledAt,
                } as FilledFormInstance;
            });
            setHistory(historyData);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching form instances:", error);
            toast({variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את המסמכים.'})
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [clientId, toast]);

    const pendingForms = history.filter(h => h.status === 'pending_client_fill');
    const completedForms = history.filter(h => h.status === 'completed' || h.status === 'signed');
    
    const handleFillClick = (instance: FilledFormInstance) => {
        const template = templates.find(t => t.id === instance.templateId);
        if (template) {
            setFillingForm({ instance, template });
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'תבנית הטופס לא נמצאה.' });
        }
    }
    
    const handleSaveForm = (instance: FilledFormInstance) => {
        startSubmitting(async () => {
            const { instanceId, ...dataToSave } = instance;
            const docRef = doc(db, "formInstances", instanceId);
            try {
                // Make a copy and convert dates to Timestamps for Firestore
                const saveData: any = { ...dataToSave };
                if (saveData.assignedAt) saveData.assignedAt = Timestamp.fromDate(new Date(saveData.assignedAt));
                if (saveData.filledAt) saveData.filledAt = Timestamp.fromDate(new Date(saveData.filledAt));

                await updateDoc(docRef, saveData);
                setFillingForm(null);
                toast({ title: 'הצלחה!', description: 'הטופס נשמר ונשלח.' });
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'שגיאה', description: 'שמירת הטופס נכשלה' });
            }
        });
    }

    const handleViewCompletedForm = (instance: FilledFormInstance) => {
        const template = templates.find(t => t.id === instance.templateId);
        if (template) {
            setViewingInstance(instance);
        } else {
            toast({ variant: 'destructive', title: 'שגיאה', description: 'תבנית הטופס לא נמצאה.' });
        }
    };


    if (isLoading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!client) {
         return <div className="text-center p-8">לקוח לא נמצא.</div>;
    }
    
    if (fillingForm) {
        return (
            <div className="container mx-auto p-4 max-w-2xl space-y-6">
                 <header className="p-4 flex justify-between items-center mb-6">
                    <div className="w-20" />
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-primary">{fillingForm.template.name}</h1>
                    </div>
                    <div className="w-20" />
                </header>
                <ClientFillForm 
                    template={fillingForm.template}
                    initialInstance={fillingForm.instance}
                    client={client}
                    isSaving={isSubmitting}
                    onSave={handleSaveForm}
                    onCancel={() => setFillingForm(null)}
                />
            </div>
        );
    }


    return (
        <div className="container mx-auto p-4 max-w-2xl space-y-6">
             <header className="p-4 flex justify-between items-center mb-6">
                <Link href={dashboardLink} className="w-20 h-20">
                    <Logo className="w-full h-full" />
                </Link>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary">המסמכים שלי</h1>
                </div>
                <div className="w-20 flex items-center justify-center">
                    <Button asChild variant="outline">
                        <Link href={dashboardLink}>
                            <ArrowLeft className="ml-2" />
                            חזרה
                        </Link>
                    </Button>
                </div>
            </header>

            <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">טפסים למילוי</TabsTrigger>
                    <TabsTrigger value="completed">טפסים שהושלמו</TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="mt-4">
                    <Card>
                        <CardHeader><CardTitle>טפסים הממתינים למילוי</CardTitle></CardHeader>
                        <CardContent>
                            {pendingForms.length > 0 ? (
                                <div className="space-y-3">
                                    {pendingForms.map(form => (
                                        <div key={form.instanceId} className="flex items-center justify-between p-3 border rounded-md bg-accent/50">
                                            <div>
                                                <p className="font-semibold">{form.templateName}</p>
                                                <p className="text-xs text-muted-foreground">נשלח בתאריך: {new Date(form.assignedAt).toLocaleDateString('he-IL')}</p>
                                            </div>
                                            <Button onClick={() => handleFillClick(form)}>מלא טופס</Button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-muted-foreground py-8">אין טפסים הממתינים למילוי.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="completed" className="mt-4">
                     <Card>
                        <CardHeader><CardTitle>היסטוריית טפסים</CardTitle></CardHeader>
                        <CardContent>
                             {completedForms.length > 0 ? (
                                <div className="space-y-3">
                                    {completedForms.map(form => (
                                        <div key={form.instanceId} className="flex items-center justify-between p-3 border rounded-md">
                                            <div>
                                                <p className="font-semibold">{form.templateName}</p>
                                                <p className="text-xs text-muted-foreground">הושלם בתאריך: {form.filledAt ? new Date(form.filledAt).toLocaleDateString('he-IL') : 'לא צוין'}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => handleViewCompletedForm(form)}>צפייה</Button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-muted-foreground py-8">אין טפסים שהושלמו.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <ViewCompletedFormDialog
                isOpen={!!viewingInstance}
                onOpenChange={() => setViewingInstance(null)}
                instance={viewingInstance}
                template={viewingInstance ? templates.find(t => t.id === viewingInstance.templateId) || null : null}
            />

        </div>
    );
}

export function MyDocuments() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <MyDocumentsContent />
        </Suspense>
    );
}
