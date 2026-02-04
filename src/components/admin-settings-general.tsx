

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Save, Building, Link2, Calendar, Lock, UserCog, FileText, Bell, Users, Settings as SettingsIcon, Image as ImageIcon, Upload, Palette } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { AllSettings } from "@/lib/settings-types";
import { getSettingsForClient, saveAllSettings, saveLogo, getLogo } from "@/lib/settings";
import { useEffect, useState, useTransition, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Textarea } from "./ui/textarea";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import Image from "next/image";
import { useRouter } from "next/navigation";


const settingsSchema = z.object({
    businessDetails: z.object({
        businessName: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        gender: z.enum(['male', 'female']).optional(),
        email: z.string().email({ message: "אימייל לא תקין" }).optional().or(z.literal('')),
        street: z.string().optional(),
        houseNumber: z.string().optional(),
        city: z.string().optional(),
        phone: z.string().optional(),
    }),
    appLinks: z.object({
        facebook: z.string().optional(),
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        website: z.string().optional(),
    }),
    appTheme: z.object({
        primary: z.string().optional(),
        background: z.string().optional(),
        foreground: z.string().optional(),
        accent: z.string().optional(),
    }),
    calendarSettings: z.object({
        checkInterval: z.coerce.number().min(0).optional(),
        recheckInterval: z.coerce.number().min(0).optional(),
        adhesionDuration: z.coerce.number().min(0).optional(),
        isFlexible: z.boolean().optional(),
    }),
    limitationSettings: z.object({
        newAppointmentDaysLimit: z.coerce.number().min(0).optional(),
        newAppointmentHoursLimit: z.coerce.number().min(0).optional(),
        editAppointmentHoursLimit: z.coerce.number().min(0).optional(),
        cancelAppointmentHoursLimit: z.coerce.number().min(0).optional(),
        requireApprovalOnLimit: z.boolean().optional(),
    }),
    blockedClientSettings: z.object({
        blockingMethod: z.enum(['approval', 'login']).optional(),
    }),
    registrationSettings: z.object({
        requireBirthDate: z.boolean().optional(),
        requireEmail: z.boolean().optional(),
        requirePrepayment: z.boolean().optional(),
    }),
    generalAppSettings: z.object({
        isArrivalConfirmationActive: z.boolean().optional(),
        isWaitingListActive: z.boolean().optional(),
        showPrice: z.boolean().optional(),
        showDuration: z.boolean().optional(),
        restrictToIsraeliNumbers: z.boolean().optional(),
        hideGraySlots: z.boolean().optional(),
        noPriorityCalendar: z.boolean().optional(),
        allowMultiServiceSelection: z.boolean().optional(),
        allowEditAppointment: z.boolean().optional(),
        allowCancelAppointment: z.boolean().optional(),
        requireTermsSignature: z.boolean().optional(),
        termsAndConditions: z.string().optional(),
        appointmentApproval: z.enum(['manager', 'all']).optional(),
    }),
    appointmentNotifications: z.object({
        newAppointment: z.object({ enabled: z.boolean(), content: z.string() }).optional(),
        dayBefore: z.object({ enabled: z.boolean(), content: z.string() }).optional(),
        timeToLeave: z.object({ enabled: z.boolean(), content: z.string() }).optional(),
        afterAppointment: z.object({ enabled: z.boolean(), content: z.string() }).optional(),
        rejection: z.object({ enabled: z.boolean(), content: z.string() }).optional(),
    }),
});

const notificationTypes = [
    { key: 'newAppointment', label: 'תור חדש' },
    { key: 'dayBefore', label: 'יום לפני' },
    { key: 'timeToLeave', label: 'זמן לצאת' },
    { key: 'afterAppointment', label: 'אחרי התור' },
    { key: 'rejection', label: 'דחיית תור' },
] as const;

export function GeneralSettings() {
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isLoaded, setIsLoaded] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const methods = useForm<z.infer<typeof settingsSchema>>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {},
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const settings = await getSettingsForClient();
            if (settings) {
                methods.reset(settings);
            }
            const logo = await getLogo();
            if (logo) {
                setLogoPreview(logo);
            }
            setIsLoaded(true);
        };
        fetchSettings();
    }, [methods]);
    
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setLogoPreview(base64String);
            };
            reader.readAsDataURL(file);
        } else {
            toast({ variant: "destructive", title: "שגיאה", description: "יש לבחור קובץ תמונה בלבד." });
        }
    }


    function onSubmit(values: z.infer<typeof settingsSchema>) {
        startTransition(async () => {
            const normalized: AllSettings = {
                businessDetails: {
                    businessName: values.businessDetails?.businessName ?? '',
                    firstName: values.businessDetails?.firstName ?? '',
                    lastName: values.businessDetails?.lastName ?? '',
                    gender: values.businessDetails?.gender ?? 'female',
                    email: values.businessDetails?.email ?? '',
                    street: values.businessDetails?.street ?? '',
                    houseNumber: values.businessDetails?.houseNumber ?? '',
                    city: values.businessDetails?.city ?? '',
                    phone: values.businessDetails?.phone ?? '',
                },
                appLinks: {
                    facebook: values.appLinks?.facebook ?? '',
                    instagram: values.appLinks?.instagram ?? '',
                    tiktok: values.appLinks?.tiktok ?? '',
                    website: values.appLinks?.website ?? '',
                },
                appTheme: {
                    primary: values.appTheme?.primary ?? '#E11D48',
                    background: values.appTheme?.background ?? '#FFFFFF',
                    foreground: values.appTheme?.foreground ?? '#000000',
                    accent: values.appTheme?.accent ?? '#FCE7F3',
                },
                calendarSettings: {
                    checkInterval: values.calendarSettings?.checkInterval ?? 15,
                    recheckInterval: values.calendarSettings?.recheckInterval ?? 5,
                    adhesionDuration: values.calendarSettings?.adhesionDuration ?? 0,
                    isFlexible: values.calendarSettings?.isFlexible ?? false,
                },
                limitationSettings: {
                    newAppointmentDaysLimit: values.limitationSettings?.newAppointmentDaysLimit ?? 0,
                    newAppointmentHoursLimit: values.limitationSettings?.newAppointmentHoursLimit ?? 2,
                    editAppointmentHoursLimit: values.limitationSettings?.editAppointmentHoursLimit ?? 24,
                    cancelAppointmentHoursLimit: values.limitationSettings?.cancelAppointmentHoursLimit ?? 6,
                    requireApprovalOnLimit: values.limitationSettings?.requireApprovalOnLimit ?? false,
                },
                blockedClientSettings: {
                    blockingMethod: values.blockedClientSettings?.blockingMethod ?? 'login',
                },
                registrationSettings: {
                    requireBirthDate: values.registrationSettings?.requireBirthDate ?? false,
                    requireEmail: values.registrationSettings?.requireEmail ?? true,
                    requirePrepayment: values.registrationSettings?.requirePrepayment ?? false,
                },
                generalAppSettings: {
                    isArrivalConfirmationActive: values.generalAppSettings?.isArrivalConfirmationActive ?? true,
                    isWaitingListActive: values.generalAppSettings?.isWaitingListActive ?? false,
                    showPrice: values.generalAppSettings?.showPrice ?? true,
                    showDuration: values.generalAppSettings?.showDuration ?? true,
                    restrictToIsraeliNumbers: values.generalAppSettings?.restrictToIsraeliNumbers ?? true,
                    hideGraySlots: values.generalAppSettings?.hideGraySlots ?? false,
                    noPriorityCalendar: values.generalAppSettings?.noPriorityCalendar ?? false,
                    allowMultiServiceSelection: values.generalAppSettings?.allowMultiServiceSelection ?? true,
                    allowEditAppointment: values.generalAppSettings?.allowEditAppointment ?? true,
                    allowCancelAppointment: values.generalAppSettings?.allowCancelAppointment ?? true,
                    requireTermsSignature: values.generalAppSettings?.requireTermsSignature ?? false,
                    termsAndConditions: values.generalAppSettings?.termsAndConditions ?? '',
                    appointmentApproval: values.generalAppSettings?.appointmentApproval ?? 'all',
                },
                appointmentNotifications: {
                    newAppointment: values.appointmentNotifications?.newAppointment ?? { enabled: true, content: '' },
                    dayBefore: values.appointmentNotifications?.dayBefore ?? { enabled: false, content: '' },
                    timeToLeave: values.appointmentNotifications?.timeToLeave ?? { enabled: false, content: '' },
                    afterAppointment: values.appointmentNotifications?.afterAppointment ?? { enabled: false, content: '' },
                    rejection: values.appointmentNotifications?.rejection ?? { enabled: true, content: '' },
                },
            };
            const result = await saveAllSettings(normalized);
             if (logoPreview) {
                await saveLogo(logoPreview);
            }
            if(result.success) {
                toast({ title: "הצלחה", description: "ההגדרות נשמרו בהצלחה." });
                // Force reload of settings cache for clients
                const event = new Event('settings_updated');
                window.dispatchEvent(event);
                router.push('/admin/settings');
            } else {
                toast({ variant: "destructive", title: "שגיאה", description: result.error });
            }
        });
    }

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <FormProvider {...methods}>
            <Form {...methods}>
                <form onSubmit={methods.handleSubmit(onSubmit)}>
                    <div className="p-4 md:p-6 lg:p-8 space-y-6">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4">
                                <Link href="/admin/settings" passHref>
                                    <Button variant="outline" type="button">
                                        <ArrowLeft className="ml-2" />
                                        חזרה להגדרות
                                    </Button>
                                </Link>
                                <h1 className="text-2xl font-bold">הגדרות כלליות</h1>
                            </div>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="animate-spin" /> : <Save className="ml-2" />}
                                שמור וחזור
                            </Button>
                        </div>

                        <Accordion type="multiple" className="w-full" defaultValue={['business']}>
                            
                            <AccordionItem value="business">
                                <AccordionTrigger><div className="flex items-center gap-2"><Building /> פרטי עסק</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                        <FormField control={methods.control} name="businessDetails.businessName" render={({ field }) => (<FormItem><FormLabel>שם העסק לתצוגה</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="businessDetails.firstName" render={({ field }) => (<FormItem><FormLabel>שם פרטי</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="businessDetails.lastName" render={({ field }) => (<FormItem><FormLabel>שם משפחה</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField
                                            control={methods.control}
                                            name="businessDetails.gender"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                <FormLabel>מין</FormLabel>
                                                <FormControl>
                                                    <RadioGroup
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    className="flex flex-row space-x-4"
                                                    dir="rtl"
                                                    >
                                                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                                                        <FormControl>
                                                        <RadioGroupItem value="female" id="female" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="female" className="font-normal">
                                                        נקבה
                                                        </FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-x-reverse">
                                                        <FormControl>
                                                        <RadioGroupItem value="male" id="male" />
                                                        </FormControl>
                                                        <FormLabel htmlFor="male" className="font-normal">
                                                        זכר
                                                        </FormLabel>
                                                    </FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField control={methods.control} name="businessDetails.email" render={({ field }) => (<FormItem><FormLabel>דואר אלקטרוני</FormLabel><FormControl><Input {...field} value={field.value ?? ''} type="email" dir="ltr" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="businessDetails.street" render={({ field }) => (<FormItem><FormLabel>רחוב</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="businessDetails.houseNumber" render={({ field }) => (<FormItem><FormLabel>מספר</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="businessDetails.city" render={({ field }) => (<FormItem><FormLabel>עיר</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="businessDetails.phone" render={({ field }) => (<FormItem><FormLabel>מספר נייד</FormLabel><FormControl><Input {...field} value={field.value ?? ''} dir="ltr" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormItem>
                                            <FormLabel>לוגו העסק</FormLabel>
                                                <div className="flex items-center gap-4">
                                                     <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                                     <label htmlFor="logo-upload" className="cursor-pointer">
                                                        <Button type="button" asChild>
                                                            <span><Upload className="ml-2" />העלה לוגו</span>
                                                        </Button>
                                                     </label>
                                                    {logoPreview && <Image src={logoPreview} alt="Logo Preview" width={64} height={64} className="rounded-md border object-contain" />}
                                                </div>
                                            <FormMessage />
                                        </FormItem>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                             <AccordionItem value="links">
                                <AccordionTrigger><div className="flex items-center gap-2"><Link2 /> אפליקציית לקוחות</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                        <FormField control={methods.control} name="appLinks.facebook" render={({ field }) => (<FormItem><FormLabel>פייסבוק</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="https://facebook.com/yourpage" dir="ltr"/></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="appLinks.instagram" render={({ field }) => (<FormItem><FormLabel>אינסטגרם</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="https://instagram.com/yourprofile" dir="ltr"/></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="appLinks.tiktok" render={({ field }) => (<FormItem><FormLabel>טיקטוק</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="https://tiktok.com/@yourusername" dir="ltr"/></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="appLinks.website" render={({ field }) => (<FormItem><FormLabel>אתר הבית</FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="https://yourwebsite.com" dir="ltr"/></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                             <AccordionItem value="theme">
                                <AccordionTrigger><div className="flex items-center gap-2"><Palette /> עיצוב אפליקציית לקוחות</div></AccordionTrigger>
                                <AccordionContent>
                                     <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                                        <FormField
                                            control={methods.control}
                                            name="appTheme.primary"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>צבע ראשי (כפתורים)</FormLabel>
                                                    <FormControl>
                                                        <Input type="color" {...field} value={field.value ?? '#000000'} className="p-1 h-10 w-full" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={methods.control}
                                            name="appTheme.background"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>צבע רקע</FormLabel>
                                                    <FormControl>
                                                        <Input type="color" {...field} value={field.value ?? '#FFFFFF'} className="p-1 h-10 w-full" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={methods.control}
                                            name="appTheme.foreground"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>צבע טקסט</FormLabel>
                                                    <FormControl>
                                                        <Input type="color" {...field} value={field.value ?? '#000000'} className="p-1 h-10 w-full" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={methods.control}
                                            name="appTheme.accent"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>צבע משני (התראות ורקעים)</FormLabel>
                                                    <FormControl>
                                                        <Input type="color" {...field} value={field.value ?? '#F1F5F9'} className="p-1 h-10 w-full" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                     </div>
                                </AccordionContent>
                             </AccordionItem>
                            
                            <AccordionItem value="appointment-notifications">
                                <AccordionTrigger><div className="flex items-center gap-2"><Bell /> תזכורות</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 space-y-4">
                                        {notificationTypes.map((notification) => (
                                            <div key={notification.key} className="space-y-2 p-3 border rounded-md">
                                                <FormField
                                                    control={methods.control}
                                                    name={`appointmentNotifications.${notification.key}.enabled`}
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center justify-between">
                                                            <FormLabel className="font-semibold">{notification.label}</FormLabel>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                {methods.watch(`appointmentNotifications.${notification.key}.enabled`) && (
                                                     <FormField
                                                        control={methods.control}
                                                        name={`appointmentNotifications.${notification.key}.content`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="sr-only">תוכן</FormLabel>
                                                                <FormControl>
                                                                    <Textarea {...field} value={field.value ?? ''} placeholder={`הקלד את תוכן ההודעה עבור "${notification.label}"...`} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                         <CardDescription>
                                            ניתן להשתמש במשתנים: #שם_השירות#, #תאריך#, #שעה#, #יום#, #הוראות#.
                                        </CardDescription>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            

                            <AccordionItem value="calendar">
                                <AccordionTrigger><div className="flex items-center gap-2"><Calendar /> הגדרות יומן</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                        <FormField control={methods.control} name="calendarSettings.checkInterval" render={({ field }) => (<FormItem><FormLabel>בדיקת זמינות יומן כל (דקות)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="calendarSettings.recheckInterval" render={({ field }) => (<FormItem><FormLabel>בדיקה חוזרת של זמינות כל (דקות)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="calendarSettings.adhesionDuration" render={({ field }) => (<FormItem><FormLabel>צמידות לתור הבא (דקות)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="calendarSettings.isFlexible" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">הפעל גמישות</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                             <AccordionItem value="limitations">
                                <AccordionTrigger><div className="flex items-center gap-2"><Lock /> הגבלות</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                        <FormField control={methods.control} name="limitationSettings.newAppointmentDaysLimit" render={({ field }) => (<FormItem><FormLabel>הגבלת קביעת תור (ימים, 0=ללא)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="limitationSettings.newAppointmentHoursLimit" render={({ field }) => (<FormItem><FormLabel>הגבלת קביעת תור חדש (שעות)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="limitationSettings.editAppointmentHoursLimit" render={({ field }) => (<FormItem><FormLabel>הגבלת שינוי תור (שעות)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="limitationSettings.cancelAppointmentHoursLimit" render={({ field }) => (<FormItem><FormLabel>הגבלת ביטול תור (שעות)</FormLabel><FormControl><Input {...field} value={field.value ?? 0} type="number" /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={methods.control} name="limitationSettings.requireApprovalOnLimit" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">העברה לאישור בחריגה</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                             <AccordionItem value="clients">
                                <AccordionTrigger><div className="flex items-center gap-2"><UserCog /> הגדרות לקוחות</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                        <FormField control={methods.control} name="blockedClientSettings.blockingMethod" render={({ field }) => (
                                             <FormItem>
                                                <FormLabel>צורת חסימת לקוח מסומן</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="בחר שיטת חסימה" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="approval">צריך אישור מנהל</SelectItem>
                                                        <SelectItem value="login">לא יכול להיכנס בכלל</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                             <AccordionItem value="registration">
                                <AccordionTrigger><div className="flex items-center gap-2"><Users /> הגדרות רישום</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                        <FormField control={methods.control} name="registrationSettings.requireBirthDate" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>חייב תאריך לידה</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="registrationSettings.requireEmail" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>חייב כתובת אימייל</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="registrationSettings.requirePrepayment" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>חייב תשלום מראש</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="general">
                                <AccordionTrigger><div className="flex items-center gap-2"><SettingsIcon /> כללי</div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                         <FormField
                                            control={methods.control}
                                            name="generalAppSettings.appointmentApproval"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3 rounded-lg border p-4">
                                                    <FormLabel>אישור תורים</FormLabel>
                                                    <FormControl>
                                                        <RadioGroup
                                                            onValueChange={field.onChange}
                                                            value={field.value}
                                                            className="flex flex-col space-y-1"
                                                        >
                                                            <FormItem className="flex items-center space-x-3 space-x-reverse">
                                                                <FormControl>
                                                                    <RadioGroupItem value="all" />
                                                                </FormControl>
                                                                <FormLabel className="font-normal">
                                                                    מאושר לכולם
                                                                </FormLabel>
                                                            </FormItem>
                                                            <FormItem className="flex items-center space-x-3 space-x-reverse">
                                                                <FormControl>
                                                                    <RadioGroupItem value="manager" />
                                                                </FormControl>
                                                                <FormLabel className="font-normal">
                                                                    באישור מנהל
                                                                </FormLabel>
                                                            </FormItem>
                                                        </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField control={methods.control} name="generalAppSettings.isArrivalConfirmationActive" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>אישור הגעה פעיל</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.isWaitingListActive" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>רשימת המתנה פעילה</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.showPrice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>להציג מחיר</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.showDuration" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>להציג את אורך התור</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.restrictToIsraeliNumbers" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>הגבל רישום למספרים ישראליים</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.noPriorityCalendar" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>הצגת תורים ללא עדיפות יומן</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.allowMultiServiceSelection" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>אפשרות לבחירה מרובה של סוגי תורים</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.allowEditAppointment" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>אפשרות לשנות תור</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.allowCancelAppointment" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>אפשרות לבטל תור</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                        <FormField control={methods.control} name="generalAppSettings.requireTermsSignature" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><FormLabel>חיוב חתימה על התקנון</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="terms">
                                <AccordionTrigger><div className="flex items-center gap-2"><FileText /> תקנון</div></AccordionTrigger>
                                <AccordionContent>
                                     <div className="p-4">
                                        <FormField
                                            control={methods.control}
                                            name="generalAppSettings.termsAndConditions"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>תוכן התקנון</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="כתוב כאן את תקנון העסק..."
                                                            className="min-h-[200px]"
                                                            {...field}
                                                            value={field.value ?? ''}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                        </Accordion>
                    </div>
                </form>
            </Form>
        </FormProvider>
    );
}
