

'use client';

import { getAppointments, Appointment } from "@/lib/appointments";
import { Category, getCategories } from "@/lib/categories";
import { Service, getServices } from "@/lib/services";
import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft, History, Calendar, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import Link from "next/link";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Logo } from "./logo";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import Image from "next/image";
import { getFormTemplates, type TreatmentFormTemplate, type FilledFormInstance } from "@/lib/form-templates";


// Helper from localStorage, also from admin pages
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


interface GroupedAppointments {
    [categoryName: string]: Appointment[];
}

const ViewTreatmentInstanceDialog = ({ isOpen, onOpenChange, instance, template }: {
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
            פרטי הטיפול מתאריך: {new Date(instance.filledAt!).toLocaleString('he-IL')}
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


function MyAppointmentsHistoryContent() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // State for treatment history
    const [allTemplates, setAllTemplates] = useState<TreatmentFormTemplate[]>([]);
    const [clientFormHistory, setClientFormHistory] = useState<FilledFormInstance[]>([]);
    const [viewingInstance, setViewingInstance] = useState<FilledFormInstance | null>(null);


    const searchParams = useSearchParams();
    
    const clientId = searchParams.get('id');

    useEffect(() => {
        const fetchHistory = async () => {
            if (!clientId) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            const fiveYearsAgo = new Date();
            fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
            const businessId = 'default_business';
            
            const [fetchedAppointments, fetchedCategories, fetchedServices, fetchedTemplates] = await Promise.all([
                getAppointments(fiveYearsAgo, new Date(), businessId, clientId),
                getCategories(),
                getServices(),
                getFormTemplates()
            ]);

            const clientAppointments = fetchedAppointments
                .filter(app => new Date(app.start) < new Date())
                .map(a => ({...a, start: new Date(a.start).toISOString(), end: new Date(a.end).toISOString()}))
                .sort((a,b) => new Date(b.start).getTime() - new Date(a.start).getTime());

            setAppointments(clientAppointments);
            setCategories(fetchedCategories);
            setServices(fetchedServices);
            
            // Fetch treatment history
            setAllTemplates(fetchedTemplates);
            const history = getFromLocalStorage<FilledFormInstance[]>(`clientTreatmentHistory_${clientId}`, []);
            // Only show forms that are completed/signed AND linked to an appointment on this page.
            const appointmentRelatedHistory = history.filter(h => h.appointmentId && (h.status === 'completed' || h.status === 'signed'));
            setClientFormHistory(appointmentRelatedHistory.sort((a, b) => new Date(b.filledAt!).getTime() - new Date(a.filledAt!).getTime()));

            setIsLoading(false);
        }
        fetchHistory();
    }, [clientId]);
    
    const groupedAppointments = useMemo(() => {
        const getCategoryNameForService = (serviceId: string): string => {
            const service = services.find(s => s.id === serviceId);
            if (!service) return "שירותים כלליים";
            const category = categories.find(c => c.id === service.categoryId);
            return category?.name || "שירותים כלליים";
        };

        return appointments.reduce((acc, app) => {
            const mainServiceId = app.serviceId.split(',')[0];
            const categoryName = getCategoryNameForService(mainServiceId);
            
            if (!acc[categoryName]) {
                acc[categoryName] = [];
            }
            acc[categoryName].push(app);
            return acc;
        }, {} as GroupedAppointments);
    }, [appointments, categories, services]);

    const dashboardLink = `/dashboard?${searchParams.toString()}`;
    
    const getStatusText = (status: Appointment['status']): string => {
        switch (status) {
            case 'completed': return 'הושלם';
            case 'no-show': return 'לא הופיע/ה';
            case 'cancelled': return 'בוטל';
            default: return 'הושלם';
        }
    };

    const categoryIdsInHistory = useMemo(() => {
        const serviceIds = new Set(appointments.map(a => a.serviceId.split(',')).flat());
        const categoryIds = new Set(services.filter(s => serviceIds.has(s.id)).map(s => s.categoryId));
        return Array.from(categoryIds);
    }, [appointments, services]);
    
    const sortedCategories = useMemo(() => {
        return categories
            .filter(c => categoryIdsInHistory.includes(c.id))
            .sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }, [categories, categoryIdsInHistory]);
    
    const handleViewInstance = (instanceId: string) => {
        const instance = clientFormHistory.find(inst => inst.instanceId === instanceId);
        if (instance) {
          setViewingInstance(instance);
        }
    };


    return (
        <div className="container mx-auto p-4 max-w-2xl space-y-6">
             <header className="p-4 flex justify-between items-center mb-6">
                <Link href={dashboardLink} className="w-20 h-20">
                    <Logo className="w-full h-full" />
                </Link>
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-primary">היסטוריית טיפולים</h1>
                </div>
                <div className="w-20 flex items-center justify-center">
                    <Button asChild variant="outline">
                        <Link href="/my-appointments">
                            <ArrowLeft className="ml-2" />
                            חזרה
                        </Link>
                    </Button>
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History />
                        כל הטיפולים והתורים הקודמים
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : clientFormHistory.length === 0 && appointments.length === 0 ? (
                        <p className="text-center text-muted-foreground py-16">
                           אין היסטוריית טיפולים או תורים.
                        </p>
                    ) : (
                         <div className="space-y-4">
                             {clientFormHistory.length > 0 && (
                                <Accordion type="single" collapsible defaultValue="treatment-history" className="w-full space-y-2">
                                     <AccordionItem value="treatment-history" className="border-b-0 rounded-lg bg-accent/30 overflow-hidden">
                                        <AccordionTrigger className="p-4 bg-accent/50 hover:bg-accent/80">
                                            <span className="font-semibold">היסטוריית טפסי טיפול</span>
                                        </AccordionTrigger>
                                        <AccordionContent className="p-2">
                                             <div className="space-y-2">
                                                {clientFormHistory.map(instance => (
                                                     <div key={instance.instanceId} className="flex items-center justify-between p-3 border rounded-md bg-background">
                                                        <div>
                                                            <p className="font-semibold">{instance.templateName}</p>
                                                            <p className="text-sm text-muted-foreground">{instance.filledAt ? new Date(instance.filledAt).toLocaleDateString('he-IL') : ''}</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => handleViewInstance(instance.instanceId)}>
                                                            <Eye className="w-4 w-4 text-blue-600" />
                                                        </Button>
                                                     </div>
                                                ))}
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            )}
                            
                             {appointments.length > 0 && (
                                 <Accordion type="multiple" className="w-full space-y-2">
                                     {sortedCategories.map(category => (
                                         <AccordionItem value={category.name} key={category.id} className="border-b-0 rounded-lg bg-accent/30 overflow-hidden">
                                            <AccordionTrigger className="p-4 bg-accent/50 hover:bg-accent/80">
                                                <span className="font-semibold">{category.name}</span>
                                            </AccordionTrigger>
                                            <AccordionContent className="p-2">
                                                <ul className="space-y-2">
                                                {(groupedAppointments[category.name] || []).map(app => (
                                                     <li key={app.id}>
                                                        <div className="p-4 border rounded-lg bg-background flex justify-between items-center">
                                                            <div>
                                                                <h3 className="font-semibold text-base">{app.serviceName}</h3>
                                                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                                                    <Calendar className="h-4 w-4" />
                                                                    <span>{format(new Date(app.start), 'd MMMM yyyy', { locale: he })}</span>
                                                                </div>
                                                            </div>
                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusText(app.status) === 'הושלם' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                                {getStatusText(app.status)}
                                                            </span>
                                                        </div>
                                                    </li>
                                                ))}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                     ))}
                                </Accordion>
                             )}
                         </div>
                     )}
                </CardContent>
            </Card>
            
            <ViewTreatmentInstanceDialog
                isOpen={!!viewingInstance}
                onOpenChange={(isOpen) => !isOpen && setViewingInstance(null)}
                instance={viewingInstance}
                template={viewingInstance ? allTemplates.find(t => t.id === viewingInstance.templateId) || null : null}
            />
        </div>
    );
}

export function MyAppointmentsHistory() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <MyAppointmentsHistoryContent />
        </Suspense>
    );
}
