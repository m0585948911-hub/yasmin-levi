
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getClientById, Client } from '@/lib/clients';
import { updateProfile } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowLeft, Camera, Save, Bell } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Logo } from './logo';
import { registerPushToken } from '@/lib/push';
import { BirthDateSelector } from './birth-date-selector';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';

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
  const [isPending, startTransition] = useTransition();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isPushEnabledOnDevice, setIsPushEnabledOnDevice] = useState(false);

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
  
  const checkPushStatus = useCallback(() => {
    if (typeof window === 'undefined' || !clientId) return;

    const isRegisteredInStorage = localStorage.getItem(`push_token_registered_clients_${clientId}`) === 'true';
    const permission = 'Notification' in window ? Notification.permission : 'denied';

    if (isRegisteredInStorage && permission === 'granted') {
        setIsPushEnabledOnDevice(true);
    } else {
        setIsPushEnabledOnDevice(false);
        // Clean up inconsistent state if it exists
        if (isRegisteredInStorage && permission !== 'granted') {
             localStorage.removeItem(`push_token_registered_clients_${clientId}`);
        }
    }
  }, [clientId]);


  useEffect(() => {
    if (!clientId) {
      toast({ variant: 'destructive', title: 'שגיאה', description: 'מזהה לקוח חסר.' });
      router.push('/');
      return;
    }

    checkPushStatus();

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
  }, [clientId, router, toast, form, checkPushStatus]);

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
        toast({ title: 'הצלחה!', description: 'הפרופיל וההגדרות עודכנו בהצלחה.' });
        router.push(`/dashboard?${result.newParams}`);
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
      }
    });
  };

  const handleRequestNotificationPermission = () => {
    if (!('Notification' in window)) return;

    Notification.requestPermission().then(async (permission) => {
      if (permission === 'granted') {
        if (clientId) {
          await registerPushToken(clientId, 'clients');
          setIsPushEnabledOnDevice(true);
          toast({ title: 'הצלחה', description: 'התראות הופעלו. תקבל/י מאיתנו עדכונים חשובים.' });
        }
      } else {
        setIsPushEnabledOnDevice(false);
        if (clientId) {
          localStorage.removeItem(`push_token_registered_clients_${clientId}`);
        }
        toast({
          variant: 'destructive',
          title: 'שימ/י לב',
          description: 'אינך אישרת קבלת התראות. כדי לקבל עדכונים, יש לאפשר אותן בהגדרות הדפדפן.'
        });
      }
    });
  };

  const dashboardLink = `/dashboard?${searchParams.toString()}`;

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
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
                  <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors">
                    <Camera className="w-4 h-4" />
                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={isPending} />
                  </label>
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
                      <Input {...field} disabled={isPending} />
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
                      <Input {...field} disabled={isPending} />
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
                      <Input {...field} disabled={isPending} type="email" />
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
                        disabled={isPending}
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
                      <BirthDateSelector value={field.value} onChange={field.onChange} disabled={isPending} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-6" />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2"><Bell /> הגדרות התראות</h3>

                {isPushEnabledOnDevice ? (
                    <div className="p-3 border rounded-md bg-green-50 text-green-800">
                        <p className="text-sm font-medium">התראות מופעלות עבור מכשיר זה.</p>
                        <p className="text-xs">כדי לכבות, יש לשנות את ההרשאה בהגדרות הדפדפן.</p>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 border rounded-md">
                        <p className="text-sm text-muted-foreground">קבל/י תזכורות על תורים ועדכונים חשובים.</p>
                        <Button type="button" onClick={handleRequestNotificationPermission} variant="outline" size="sm">
                        הפעל התראות במכשיר זה
                        </Button>
                    </div>
                )}


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
              </div>
            </CardContent>

            <CardFooter className="flex justify-end gap-2 pt-4">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="animate-spin" /> : <Save className="ml-2" />}
                שמור שינויים
              </Button>
            </CardFooter>

          </form>
        </Form>
      </Card>
    </div>
  );
}
