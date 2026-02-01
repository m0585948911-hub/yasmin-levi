
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getClientById, Client } from '@/lib/clients';
import { updateProfile } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowLeft, Camera, Save, X, Bell } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Logo } from './logo';
import { registerPushToken } from '@/lib/push';
import { BirthDateSelector } from './birth-date-selector';
import { Switch } from './ui/switch';

const profileFormSchema = z.object({
  firstName: z.string().min(2, 'שם פרטי חייב להכיל לפחות 2 תווים'),
  lastName: z.string().min(2, 'שם משפחה חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת אימייל לא תקינה').optional().or(z.literal('')),
  gender: z.enum(['male', 'female']),
  birthDate: z.date().optional(),
  notificationSettings: z.object({
    appointmentManagement: z.boolean(),
    marketing: z.boolean(),
    system: z.boolean(),
  }),
});

export function ProfileForm({ title = "פרופיל והגדרות" }: { title?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const clientId = searchParams.get('id');

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      gender: 'female',
      notificationSettings: {
        appointmentManagement: true,
        marketing: true,
        system: true,
      }
    }
  });

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    if (!clientId) {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'מזהה לקוח חסר.' });
      router.push('/');
      return;
    }

    async function fetchClient() {
      setIsLoading(true);
      const fetchedClient = await getClientById(clientId!);
      if (fetchedClient) {
        setClient(fetchedClient);
        form.reset({
          firstName: fetchedClient.firstName,
          lastName: fetchedClient.lastName,
          email: fetchedClient.email || '',
          gender: fetchedClient.gender,
          birthDate: fetchedClient.birthDate ? new Date(fetchedClient.birthDate) : undefined,
          notificationSettings: {
            appointmentManagement: fetchedClient.notificationSettings?.appointmentManagement ?? true,
            marketing: fetchedClient.notificationSettings?.marketing ?? true,
            system: fetchedClient.notificationSettings?.system ?? true,
          }
        });
        setAvatarPreview(fetchedClient.avatarUrl || null);
      } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'הלקוח לא נמצא.' });
        router.push('/');
      }
      setIsLoading(false);
    }
    fetchClient();
  }, [clientId, router, toast, form]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        toast({ variant: "destructive", title: "שגיאה", description: "יש לבחור קובץ תמונה בלבד." });
    }
  };
  
  const onSubmit = (values: z.infer<typeof profileFormSchema>) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('clientId', clientId!);
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      formData.append('email', values.email || '');
      formData.append('gender', values.gender);
      if (values.birthDate) {
        formData.append('birthDate', values.birthDate.toISOString());
      }
      if (values.notificationSettings) {
        formData.append('notificationSettings', JSON.stringify(values.notificationSettings));
      }
      if (avatarPreview) {
        formData.append('avatarUrl', avatarPreview);
      }

      const result = await updateProfile(formData);
      if (result.success) {
        toast({ title: 'הצלחה!', description: 'הפרופיל עודכן בהצלחה.' });
        router.push(`/dashboard?${result.newParams}`);
        router.refresh(); // Refresh to ensure dashboard shows updated info
      } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
      }
    });
  };
  
  const handleRequestNotificationPermission = () => {
    Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
            if (clientId) {
                registerPushToken(clientId, 'clients');
                toast({ title: 'הצלחה', description: 'התראות הופעלו. תקבל/י מאיתנו עדכונים חשובים.' });
            }
        } else {
             toast({ variant: 'destructive', title: 'שימ/י לב', description: 'אינך אישרת קבלת התראות. כדי לקבל עדכונים, יש לאפשר אותן בהגדרות הדפדפן.' });
        }
    });
  }


  const dashboardLink = `/dashboard?${searchParams.toString()}`;

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const resetForm = () => {
    form.reset({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email || '',
        gender: client.gender,
        birthDate: client.birthDate ? new Date(client.birthDate) : undefined,
        notificationSettings: {
            appointmentManagement: client.notificationSettings?.appointmentManagement ?? true,
            marketing: client.notificationSettings?.marketing ?? true,
            system: client.notificationSettings?.system ?? true,
        },
    });
    setAvatarPreview(client.avatarUrl || null);
    setIsEditing(false);
  }

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <header className="p-4 flex justify-between items-center mb-6">
        <Link href={dashboardLink} className="w-20 h-20">
            <Logo className="w-full h-full" />
        </Link>
        <div className="text-center">
            <h1 className="text-2xl font-bold text-primary">{title}</h1>
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

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <div className="flex flex-col items-center gap-4">
                 <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarPreview || ''} alt={`${client.firstName} ${client.lastName}`} />
                    <AvatarFallback>{client.firstName.charAt(0)}{client.lastName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors">
                        <Camera className="w-4 h-4" />
                        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  )}
                </div>
                <div className="text-center">
                    <CardTitle>{client.firstName} {client.lastName}</CardTitle>
                    <CardDescription>חבר/ה מאז {new Date(client.createdAt).toLocaleDateString('he-IL')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם פרטי</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!isEditing || isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם משפחה</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!isEditing || isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>טלפון</FormLabel>
                <Input value={client.phone} disabled />
              </FormItem>
               <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>כתובת אימייל</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!isEditing || isPending} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel>מין</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-row space-x-4"
                        dir="rtl"
                        disabled={!isEditing || isPending}
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
                 <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>תאריך לידה</FormLabel>
                            <FormControl>
                                <BirthDateSelector
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={!isEditing || isPending}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
             <CardFooter className="flex justify-end gap-2 pt-4">
                {isEditing ? (
                  <>
                    <Button type="button" variant="outline" onClick={resetForm} disabled={isPending}>
                       <X className="ml-2" /> ביטול
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? <Loader2 className="animate-spin" /> : <Save className="ml-2" />}
                      שמור שינויים
                    </Button>
                  </>
                ) : (
                  <Button type="button" onClick={() => setIsEditing(true)}>
                    עריכת פרופיל
                  </Button>
                )}
              </CardFooter>
          </form>
        </Form>
      </Card>
      
      <Card className="mt-6">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell /> הגדרות התראות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            {notificationPermission === 'granted' ? (
                <p className="text-sm text-green-600">התראות מופעלות עבור מכשיר זה.</p>
            ) : notificationPermission === 'denied' ? (
                <div className="text-sm text-destructive">
                    <p>התראות חסומות. כדי לקבל עדכונים, יש לאפשר אותן בהגדרות המכשיר עבור האפליקציה.</p>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">קבל/י תזכורות על תורים ועדכונים חשובים.</p>
                    <Button onClick={handleRequestNotificationPermission} variant="outline" size="sm">הפעל התראות</Button>
                </div>
            )}
            
            {isEditing && (
                <div className="space-y-3 pt-4 border-t">
                    <FormField
                        control={form.control}
                        name="notificationSettings.appointmentManagement"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>ניהול תורים</FormLabel>
                                    <FormDescription className="text-xs">אישור, ביטול, שינוי ותזכורות לתורים.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notificationSettings.marketing"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>פרסומות ומבצעים</FormLabel>
                                    <FormDescription className="text-xs">עדכונים על הנחות ומבצעים מיוחדים.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notificationSettings.system"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>התראות מערכת</FormLabel>
                                    <FormDescription className="text-xs">הודעות כלליות וחשובות מהעסק.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
