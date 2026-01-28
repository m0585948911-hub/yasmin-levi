
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, FileEdit, Upload, FileText, ChevronDown, Trash2, Edit, BarChart3, Save, PlusCircle, FilePlus2, X, Image as ImageIcon, Info, Loader2, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useTransition } from "react";
import { getServices, Service } from "@/lib/services";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { saveFormTemplate, getFormTemplates, deleteFormTemplate } from '@/lib/form-templates';
import type { TreatmentFormTemplate, FormField, FormFieldType } from '@/lib/form-templates';


type FormAssociation = {
  [formId: string]: string[];
};

type UploadedFile = {
  id: string;
  name: string;
  fileName: string;
  dataUrl: string; // Store file as Base64 data URL
  usageCount: number;
};

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

// Helper to set data to localStorage
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

const EditFormDialog = ({ form, onSave, onOpenChange, isOpen }: { form: UploadedFile | null, onSave: (updatedForm: UploadedFile) => void, onOpenChange: (open: boolean) => void, isOpen: boolean}) => {
    const [name, setName] = useState(form?.name || '');

    useEffect(() => {
        if (form) {
            setName(form.name);
        }
    }, [form]);

    const handleSave = () => {
        if (form) {
            onSave({ ...form, name });
        }
    };

    if (!form) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>עריכת טופס</DialogTitle>
                    <DialogDescription>
                        שנה את שם הטופס.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="form-name" className="text-right">
                            שם
                        </Label>
                        <Input
                            id="form-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
                    <Button onClick={handleSave}>שמור שינויים</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const TreatmentFormBuilder = ({ onSave, onCancel, initialData, services, formType }: { onSave: (form: TreatmentFormTemplate) => void, onCancel: () => void, initialData?: TreatmentFormTemplate, services: Service[], formType: 'treatment' | 'summary' }) => {
    const defaultForm: TreatmentFormTemplate = {
        id: initialData?.id || crypto.randomUUID(),
        name: '',
        fields: [],
        serviceIds: [],
        type: formType,
    };
    
    const [form, setForm] = useState<TreatmentFormTemplate>(initialData || defaultForm);
    
    useEffect(() => {
        if (initialData) {
            const serviceIds = initialData.serviceIds || ((initialData as any).serviceId ? [(initialData as any).serviceId] : []);
            setForm({ ...initialData, serviceIds, type: formType });
        } else {
            setForm({ id: crypto.randomUUID(), name: '', fields: [], serviceIds: [], type: formType});
        }
    }, [initialData, formType]);

    const addField = () => {
        const newField: FormField = {
            id: crypto.randomUUID(),
            label: '',
            type: 'text',
            options: [],
            sortOrder: form.fields.length + 1,
            imageCount: 1,
            required: false,
        };
        setForm(prev => ({...prev, fields: [...prev.fields, newField]}));
    };

    const deleteField = (id: string) => {
        setForm(prev => ({...prev, fields: prev.fields.filter(field => field.id !== id)}));
    };

    const updateField = (id: string, updatedField: Partial<FormField>) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields.map(field => field.id === id ? { ...field, ...updatedField } : field)
        }));
    };
    
    const addOption = (fieldId: string) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields.map(field => 
                field.id === fieldId ? { ...field, options: [...field.options, ''] } : field
            )
        }));
    };

    const updateOption = (fieldId: string, optionIndex: number, value: string) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields.map(field =>
                field.id === fieldId ? {
                    ...field,
                    options: field.options.map((opt, i) => i === optionIndex ? value : opt)
                } : field
            )
        }));
    };

    const deleteOption = (fieldId: string, optionIndex: number) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields.map(field =>
                field.id === fieldId ? {
                    ...field,
                    options: field.options.filter((_, i) => i !== optionIndex)
                } : field
            )
        }));
    };


    const handleSave = () => {
        if (!form.name.trim()) {
            toast({ variant: "destructive", title: "שגיאה", description: "יש להזין שם לטופס."});
            return;
        }
        const sortedForm = {
            ...form,
            fields: [...form.fields].sort((a,b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        };
        onSave(sortedForm);
    };
    
    const toast = useToast().toast;

    const isInputType = (type: FormFieldType) => !['title', 'subtitle', 'personalDetails'].includes(type);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileEdit className="mr-2 h-5 w-5" />
                    {initialData ? `עריכת טופס: ${initialData.name}` : 'בניית טופס טיפול חדש'}
                </CardTitle>
                <CardDescription>
                    בנה טופס מותאם אישית לתיעוד הטיפולים שלך.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="form-name">שם הטופס</Label>
                    <Input 
                        id="form-name" 
                        placeholder="לדוגמה: טופס טיפול פנים" 
                        value={form.name}
                        onChange={(e) => setForm(prev => ({...prev, name: e.target.value}))} 
                    />
                </div>
                 <div className="space-y-2">
                    <Label>שיוך לטיפולים (אופציונלי)</Label>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                            <span>
                                {(form.serviceIds?.length || 0) > 0
                                ? `${form.serviceIds?.length} שירותים נבחרו`
                                : 'בחר טיפולים לשיוך...'}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[--radix-popover-trigger-width]">
                        <DropdownMenuLabel>שייך טיפולים</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {services.map(service => (
                            <DropdownMenuCheckboxItem
                            key={service.id}
                            checked={form.serviceIds?.includes(service.id)}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={(checked) => {
                                const currentIds = form.serviceIds || [];
                                if (checked) {
                                    setForm(prev => ({...prev, serviceIds: [...currentIds, service.id]}));
                                } else {
                                    setForm(prev => ({...prev, serviceIds: currentIds.filter(id => id !== service.id)}));
                                }
                            }}
                            >
                            {service.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <p className="text-xs text-muted-foreground">
                        שיוך טופס לטיפול יאפשר הצעתו האוטומטית לאחר ביצוע הטיפול.
                    </p>
                </div>
                <Separator />
                <div className="space-y-4">
                    <h4 className="font-medium">שדות הטופס</h4>
                    <div className="space-y-3">
                        {form.fields.map(field => (
                             <div key={field.id} className="flex items-start gap-2 p-3 border rounded-md bg-accent/50">
                                <div className="flex-grow space-y-2">
                                     <div className="flex items-center gap-2">
                                        {field.type === 'contentWithConsent' ? (
                                            <Textarea 
                                                placeholder="הזן כאן את התוכן שהלקוח צריך לקרוא ולאשר..."
                                                value={field.label}
                                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                                className="flex-grow min-h-[120px]"
                                            />
                                        ) : (
                                            <Input 
                                            placeholder={isInputType(field.type) ? "שם השדה (לדוגמה: סוג עור)" : "תוכן הכותרת"}
                                            value={field.label}
                                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                                            className="flex-grow"
                                            disabled={field.type === 'personalDetails'}
                                            />
                                        )}
                                        <Input
                                            type="number"
                                            value={field.sortOrder}
                                            onChange={(e) => updateField(field.id, { sortOrder: parseInt(e.target.value, 10) || 0 })}
                                            className="w-20"
                                            placeholder="מיון"
                                        />
                                     </div>
                                     <div className="flex items-center gap-4">
                                        <Select 
                                            value={field.type} 
                                            onValueChange={(value: FormFieldType) => {
                                                const updates: Partial<FormField> = { type: value, options: [] };
                                                if (value === 'personalDetails') {
                                                    updates.label = 'פרטים אישיים';
                                                }
                                                if (value === 'contentWithConsent' || value === 'signature') {
                                                    updates.required = true;
                                                }
                                                updateField(field.id, updates);
                                            }}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="בחר סוג שדה" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">טקסט קצר</SelectItem>
                                                <SelectItem value="textarea">טקסט ארוך (הערה)</SelectItem>
                                                <SelectItem value="select">רשימה נפתחת</SelectItem>
                                                <SelectItem value="checkbox">תיבת סימון (וי)</SelectItem>
                                                <SelectItem value="image">העלאת תמונות</SelectItem>
                                                <Separator />
                                                <SelectItem value="title">כותרת</SelectItem>
                                                <SelectItem value="subtitle">כותרת משנה</SelectItem>
                                                <SelectItem value="personalDetails">פרטים אישיים</SelectItem>
                                                <Separator />
                                                <SelectItem value="contentWithConsent">תוכן והצהרה</SelectItem>
                                                <SelectItem value="signature">חתימה</SelectItem>
                                            </SelectContent>
                                        </Select>
                                         {isInputType(field.type) && !['contentWithConsent', 'signature'].includes(field.type) && (
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <Switch 
                                                    id={`required-${field.id}`} 
                                                    checked={field.required}
                                                    onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                                                />
                                                <Label htmlFor={`required-${field.id}`}>שדה חובה</Label>
                                            </div>
                                         )}
                                     </div>
                                    {field.type === 'select' && (
                                         <div className="pl-4 space-y-2">
                                             <Label className="text-xs">אפשרויות</Label>
                                             {field.options.map((option, index) => (
                                                 <div key={index} className="flex items-center gap-2">
                                                     <Input 
                                                        value={option}
                                                        onChange={(e) => updateOption(field.id, index, e.target.value)}
                                                        placeholder={`אפשרות ${index + 1}`}
                                                     />
                                                     <Button variant="ghost" size="icon" onClick={() => deleteOption(field.id, index)}>
                                                        <X className="h-4 w-4 text-destructive" />
                                                     </Button>
                                                 </div>
                                             ))}
                                            <Button variant="outline" size="sm" onClick={() => addOption(field.id)}>
                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                הוסף אפשרות
                                            </Button>
                                         </div>
                                    )}
                                    {field.type === 'image' && (
                                        <div className="pl-4 space-y-2">
                                            <Label className="text-xs">כמות תמונות מקסימלית</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={field.imageCount}
                                                onChange={e => updateField(field.id, { imageCount: parseInt(e.target.value, 10) || 1 })}
                                                className="w-32"
                                            />
                                        </div>
                                    )}
                                </div>
                                 <Button variant="ghost" size="icon" onClick={() => deleteField(field.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                 </Button>
                             </div>
                        ))}
                    </div>
                     <Button variant="outline" className="w-full" onClick={addField}>
                        <PlusCircle className="mr-2"/>
                        הוסף שדה חדש
                    </Button>
                </div>
            </CardContent>
            <CardFooter className="justify-between">
                <Button onClick={handleSave}><Save className="mr-2" />שמור טופס</Button>
                <Button variant="outline" onClick={onCancel}>ביטול</Button>
            </CardFooter>
        </Card>
    );
}


export default function ClientSettingsPage() {
  const [uploadedForms, setUploadedForms] = useState<UploadedFile[]>([]);
  const [formAssociations, setFormAssociations] = useState<FormAssociation>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingForm, setEditingForm] = useState<UploadedFile | null>(null);
  
  const [allTemplates, setAllTemplates] = useState<TreatmentFormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isBuildingForm, setIsBuildingForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TreatmentFormTemplate | null>(null);

  const [isBuildingSummaryForm, setIsBuildingSummaryForm] = useState(false);
  const [editingSummaryTemplate, setEditingSummaryTemplate] = useState<TreatmentFormTemplate | null>(null);
  
  const [services, setServices] = useState<Service[]>([]);
  
  const { toast } = useToast();

  const fetchTemplatesAndServices = async () => {
      setIsLoading(true);
      const [fetchedTemplates, fetchedServices] = await Promise.all([
        getFormTemplates(),
        getServices()
      ]);
      setAllTemplates(fetchedTemplates);
      setServices(fetchedServices);
      setIsLoading(false);
  };

  useEffect(() => {
    setUploadedForms(getFromLocalStorage<UploadedFile[]>('uploadedForms', []));
    setFormAssociations(getFromLocalStorage<FormAssociation>('formAssociations', {}));
    fetchTemplatesAndServices();
  }, []);


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        setSelectedFile(file);
      } else {
        toast({
          variant: "destructive",
          title: "שגיאה",
          description: "יש לבחור קובץ PDF בלבד."
        })
        setSelectedFile(null);
      }
    }
  };
  
  const handleUploadAndSave = () => {
    if (!selectedFile) {
       toast({
          variant: "destructive",
          title: "שגיאה",
          description: "לא נבחר קובץ."
        })
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = () => {
        const newForm: UploadedFile = {
            id: crypto.randomUUID(),
            name: selectedFile.name.replace('.pdf', ''),
            fileName: selectedFile.name,
            dataUrl: reader.result as string,
            usageCount: 0,
        };
        const updatedForms = [...uploadedForms, newForm];
        setUploadedForms(updatedForms);
        setInLocalStorage('uploadedForms', updatedForms);
        
        const updatedAssociations = {...formAssociations, [newForm.id]: []};
        setFormAssociations(updatedAssociations);
        setInLocalStorage('formAssociations', updatedAssociations);


        setSelectedFile(null); // Reset file input
        
        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = "";

        toast({
            title: "הצלחה!",
            description: `הטופס "${newForm.name}" הועלה בהצלחה.`
        });
    };
    reader.onerror = (error) => {
        console.error("Error reading file:", error);
        toast({ variant: "destructive", title: "שגיאה", description: "לא ניתן היה לקרוא את הקובץ."})
    }
  }

  const handleDeleteForm = (formId: string) => {
    const formToDelete = uploadedForms.find(f => f.id === formId);
    if (formToDelete) {
      const updatedForms = uploadedForms.filter(f => f.id !== formId);
      setUploadedForms(updatedForms);
      setInLocalStorage('uploadedForms', updatedForms);
      
      const newAssociations = {...formAssociations};
      delete newAssociations[formId];
      setFormAssociations(newAssociations);
      setInLocalStorage('formAssociations', newAssociations);

      toast({
        title: "הצלחה!",
        description: `הטופס "${formToDelete.name}" נמחק.`
      })
    }
  };

  const handleAssociationChange = (formId: string, serviceId: string) => {
    const newAssociations = {...formAssociations};
    const currentAssociations = newAssociations[formId] || [];
    const updatedServiceAssociations = currentAssociations.includes(serviceId)
      ? currentAssociations.filter(id => id !== serviceId)
      : [...currentAssociations, serviceId];
    newAssociations[formId] = updatedServiceAssociations;
    setFormAssociations(newAssociations);
    // Note: General save button will persist this
  };

  const getAssociatedServicesCount = (formId: string) => {
    return formAssociations[formId]?.length || 0;
  }

  const handleGeneralSave = () => {
    setInLocalStorage('formAssociations', formAssociations);
     toast({
      title: "הצלחה!",
      description: "השינויים נשמרו בהצלחה."
    });
  }

  const handleEditForm = (form: UploadedFile) => {
      setEditingForm(form);
  };
  
  const handleSaveEditedForm = (updatedForm: UploadedFile) => {
      const updatedForms = uploadedForms.map(form => (form.id === updatedForm.id ? updatedForm : form));
      setUploadedForms(updatedForms);
      setInLocalStorage('uploadedForms', updatedForms);
      setEditingForm(null);
      toast({
          title: "הצלחה!",
          description: `הטופס "${updatedForm.name}" עודכן בהצלחה.`
      });
  };

  const treatmentFormTemplates = allTemplates.filter(t => t.type === 'treatment' || !t.type);
  const summaryFormTemplates = allTemplates.filter(t => t.type === 'summary');
  
  // Treatment Form Handlers
  const handleStartNewTemplate = () => {
    setEditingTemplate(null);
    setIsBuildingForm(true);
  }
  const handleEditTemplate = (template: TreatmentFormTemplate) => {
    setEditingTemplate(template);
    setIsBuildingForm(true);
  }
  const handleDeleteTemplate = async (templateId: string) => {
    await deleteFormTemplate(templateId);
    toast({ title: "הצלחה!", description: "תבנית הטופס נמחקה." });
    fetchTemplatesAndServices();
  }
  const handleSaveTemplate = async (template: TreatmentFormTemplate) => {
    await saveFormTemplate(template);
    setIsBuildingForm(false);
    setEditingTemplate(null);
    toast({ title: "הצלחה!", description: "הטופס נשמר." });
    fetchTemplatesAndServices();
  }

  // Summary Form Handlers
  const handleStartNewSummaryTemplate = () => {
    setEditingSummaryTemplate(null);
    setIsBuildingSummaryForm(true);
  }
  const handleEditSummaryTemplate = (template: TreatmentFormTemplate) => {
    setEditingSummaryTemplate(template);
    setIsBuildingSummaryForm(true);
  }
  const handleDeleteSummaryTemplate = async (templateId: string) => {
    await deleteFormTemplate(templateId);
    toast({ title: "הצלחה!", description: "תבנית הסיכום נמחקה." });
    fetchTemplatesAndServices();
  }
  const handleSaveSummaryTemplate = async (template: TreatmentFormTemplate) => {
    await saveFormTemplate(template);
    setIsBuildingSummaryForm(false);
    setEditingSummaryTemplate(null);
    toast({ title: "הצלחה!", description: "תבנית הסיכום נשמרה." });
    fetchTemplatesAndServices();
  }

  if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin/settings" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2" />
            חזרה להגדרות
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">הגדרות לקוחות וטפסים</h1>
      </div>
       <Tabs defaultValue="treatment-record" className="w-full" dir="rtl">
        <TabsList className="w-full flex justify-end">
            <TabsTrigger value="summaries">סיכומים</TabsTrigger>
            <TabsTrigger value="pdf-forms">טפסי PDF</TabsTrigger>
            <TabsTrigger value="treatment-record">תיק טיפול</TabsTrigger>
        </TabsList>
        <TabsContent value="treatment-record" className="mt-4">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileEdit className="mr-2 h-5 w-5" />
                        תיק טיפול
                    </CardTitle>
                    <CardDescription>
                        צור ונהל תבניות טפסים לתיעוד הטיפולים שלך.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isBuildingForm ? (
                        <TreatmentFormBuilder 
                            formType="treatment"
                            onSave={handleSaveTemplate} 
                            onCancel={() => setIsBuildingForm(false)} 
                            initialData={editingTemplate || undefined} 
                            services={services}
                        />
                    ) : (
                        <div className="space-y-4">
                            <Button className="w-full" onClick={handleStartNewTemplate}>
                                <FilePlus2 className="mr-2" />
                                יצירת תיק טיפול חדש
                            </Button>
                            <Separator />
                            <h4 className="font-medium">טפסים קיימים</h4>
                            {treatmentFormTemplates.length > 0 ? (
                                <ul className="space-y-2">
                                {treatmentFormTemplates.map(template => (
                                    <li key={template.id} className="flex items-center justify-between p-3 border rounded-md bg-accent/50">
                                    <div>
                                        <span className="font-semibold">{template.name}</span>
                                         {template.serviceIds && template.serviceIds.length > 0 && (
                                            <p className="text-xs text-primary max-w-xs truncate">
                                                {template.serviceIds.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                                                <Edit className="h-4 w-4 text-primary" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>האם למחוק את תבנית הטופס?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            פעולה זו תמחק את הטופס "{template.name}" לצמיתות. לא ניתן לשחזר את הפעולה.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteTemplate(template.id)}>מחיקה</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                    </div>
                                    </li>
                                ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-center text-muted-foreground py-4">לא נוצרו עדיין טפסי טיפול.</p>
                            )}
                        </div>
                    )}
                </CardContent>
             </Card>
        </TabsContent>
         <TabsContent value="pdf-forms" className="mt-4">
            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                    <Upload className="mr-2 h-5 w-5" />
                    ניהול טפסי PDF (הצהרות בריאות)
                    </CardTitle>
                    <CardDescription>
                    העלה טפסי PDF ושייך אותם לסוגי תורים. לקוחות יתבקשו למלא טפסים אלו לפני התור.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-grow">
                    <div className="flex items-center gap-2">
                        <Input id="pdf-upload" type="file" accept=".pdf" className="flex-grow" onChange={handleFileSelect}/>
                        <Button onClick={handleUploadAndSave} disabled={!selectedFile}>
                        <Save className="mr-2" />
                        העלה ושמור
                        </Button>
                    </div>
                    
                    {uploadedForms.length > 0 && (
                    <div className="space-y-3 pt-4">
                        <h4 className="font-medium">טפסים שהועלו</h4>
                        <ul className="space-y-2">
                        {uploadedForms.map(form => (
                            <li key={form.id} className="flex items-center justify-between p-3 border rounded-md bg-accent/50">
                            <div className="flex items-center gap-3">
                                <FileText className="mr-2 h-5 w-5 text-primary" />
                                <div>
                                <p className="font-semibold">{form.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <BarChart3 className="mr-1 h-3 w-3" />
                                    <span>שימוש: {form.usageCount}</span>
                                </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        שייך לתורים ({getAssociatedServicesCount(form.id)})
                                        <ChevronDown className="mr-2 h-4 w-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56">
                                    <DropdownMenuLabel>בחר תורים רלוונטיים</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {services.map(service => (
                                        <DropdownMenuCheckboxItem
                                        key={service.id}
                                        checked={formAssociations[form.id]?.includes(service.id)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => handleAssociationChange(form.id, service.id)}
                                        >
                                        {service.name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="ghost" size="icon" onClick={() => handleEditForm(form)}>
                                    <Edit className="h-4 w-4 text-primary" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>האם למחוק את הטופס?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            פעולה זו תמחק את הטופס "{form.name}" לצמיתות. לא ניתן לשחזר את הפעולה.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteForm(form.id)}>
                                            מחיקה
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>

                            </div>
                            </li>
                        ))}
                        </ul>
                    </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleGeneralSave}>שמור שינויים כלליים</Button>
                </CardFooter>
            </Card>
        </TabsContent>
         <TabsContent value="summaries" className="mt-4">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileEdit className="mr-2 h-5 w-5" />
                        תבניות סיכום טיפול
                    </CardTitle>
                    <CardDescription>
                        צור ונהל תבניות לסיכומי טיפולים שיוצמדו לתורים של לקוחות.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isBuildingSummaryForm ? (
                        <TreatmentFormBuilder 
                            formType="summary"
                            onSave={handleSaveSummaryTemplate} 
                            onCancel={() => setIsBuildingSummaryForm(false)} 
                            initialData={editingSummaryTemplate || undefined}
                            services={services}
                        />
                    ) : (
                        <div className="space-y-4">
                            <Button className="w-full" onClick={handleStartNewSummaryTemplate}>
                                <FilePlus2 className="mr-2" />
                                יצירת תבנית סיכום חדשה
                            </Button>
                            <Separator />
                            <h4 className="font-medium">תבניות קיימות</h4>
                            {summaryFormTemplates.length > 0 ? (
                                <ul className="space-y-2">
                                {summaryFormTemplates.map(template => (
                                    <li key={template.id} className="flex items-center justify-between p-3 border rounded-md bg-accent/50">
                                    <div>
                                        <span className="font-semibold">{template.name}</span>
                                        {template.serviceIds && template.serviceIds.length > 0 && (
                                            <p className="text-xs text-primary max-w-xs truncate">
                                                {template.serviceIds.map(id => services.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEditSummaryTemplate(template)}>
                                                <Edit className="h-4 w-4 text-primary" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>האם למחוק את תבנית הסיכום?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            פעולה זו תמחק את התבנית "{template.name}" לצמיתות.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteSummaryTemplate(template.id)}>מחיקה</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                    </div>
                                    </li>
                                ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-center text-muted-foreground py-4">לא נוצרו עדיין תבניות סיכום.</p>
                            )}
                        </div>
                    )}
                </CardContent>
             </Card>
         </TabsContent>
      </Tabs>
      <EditFormDialog 
        isOpen={!!editingForm}
        onOpenChange={() => setEditingForm(null)}
        form={editingForm}
        onSave={handleSaveEditedForm}
      />
    </div>
  );
}
