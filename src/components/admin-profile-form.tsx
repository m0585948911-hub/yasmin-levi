
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateAdminProfile } from '@/app/admin/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, ArrowLeft, Camera, Save, X, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAdminUser } from '@/hooks/use-admin-user';

const profileFormSchema = z.object({
  firstName: z.string().min(2, 'שם פרטי חייב להכיל לפחות 2 תווים'),
  lastName: z.string().min(2, 'שם משפחה חייב להכיל לפחות 2 תווים'),
  password: z.string().optional(),
});

export function AdminProfileForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading, setUser: setAdminUser } = useAdminUser();

  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        password: '',
    }
  });

  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName,
        lastName: user.lastName,
        password: '',
      });
      setAvatarPreview((user as any).avatarUrl || null);
    }
  }, [user, form]);

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
    if (!user) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      if (values.password) {
        formData.append('password', values.password);
      }
      if (avatarPreview) {
        formData.append('avatarUrl', avatarPreview);
      }

      const result = await updateAdminProfile(formData);
      if (result.success) {
        toast({ title: 'הצלחה!', description: 'הפרופיל עודכן בהצלחה.' });
        if(result.user) {
          setAdminUser(result.user);
        }
        setIsEditing(false);
      } else {
        toast({ variant: 'destructive', title: 'שגיאה', description: result.error });
      }
    });
  };

  const resetForm = () => {
    if (user) {
        form.reset({
            firstName: user.firstName,
            lastName: user.lastName,
            password: '',
        });
        setAvatarPreview((user as any).avatarUrl || null);
        setIsEditing(false);
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin" passHref>
          <Button variant="outline">
            <ArrowLeft className="ml-2" />
            חזרה
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">הגדרות פרופיל</h1>
      </div>
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={avatarPreview || ''} alt={`${user.firstName} ${user.lastName}`} />
                    <AvatarFallback>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors">
                        <Camera className="w-4 h-4" />
                        <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  )}
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
                <Input value={user.phone} disabled />
              </FormItem>
              {isEditing && (
                 <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>סיסמה חדשה (אופציונלי)</FormLabel>
                        <div className="relative">
                            <FormControl>
                                <Input 
                                    {...field} 
                                    disabled={isPending} 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="הזן סיסמה חדשה"
                                />
                            </FormControl>
                             <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground hover:text-foreground"
                                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                              >
                                {showPassword ? <EyeOff /> : <Eye />}
                            </button>
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              )}
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
    </div>
  );
}
