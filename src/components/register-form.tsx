
'use client';

import React, { useTransition, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, type AnyZodObject } from 'zod';
import { register as registerAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2 } from "lucide-react"
import type { AllSettings } from '@/lib/settings-types';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BirthDateSelector } from './birth-date-selector';


const SETTINGS_STORAGE_KEY = 'appGeneralSettings';

const baseSchema = z.object({
  firstName: z.string().min(2, { message: 'שם פרטי חייב להכיל לפחות 2 תווים' }),
  lastName: z.string().min(2, { message: 'שם משפחה חייב להכיל לפחות 2 תווים' }),
  phone: z.string(),
  gender: z.enum(["male", "female"], {
    required_error: "יש לבחור מין",
  }),
  agreeToTerms: z.boolean().optional(),
});

export function RegisterForm({ phone }: { phone: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [formSchema, setFormSchema] = useState<AnyZodObject>(baseSchema);

  useEffect(() => {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      let loadedSettings: AllSettings | null = null;
      if (savedSettings) {
          try {
              loadedSettings = JSON.parse(savedSettings);
              setSettings(loadedSettings);
          } catch(e) {
              console.error("Failed to parse settings", e);
          }
      }
      
      let dynamicSchema: AnyZodObject = baseSchema;
      
      if (loadedSettings?.registrationSettings?.requireEmail) {
        dynamicSchema = dynamicSchema.extend({
          email: z.string().email({ message: 'כתובת אימייל לא תקינה' }),
        });
      } else {
         dynamicSchema = dynamicSchema.extend({
          email: z.string().email({ message: 'כתובת אימייל לא תקינה' }).optional().or(z.literal('')),
        });
      }
      
      if (loadedSettings?.registrationSettings?.requireBirthDate) {
         dynamicSchema = dynamicSchema.extend({
          birthDate: z.date({ required_error: 'יש להזין תאריך לידה' }),
        });
      } else {
          dynamicSchema = dynamicSchema.extend({
            birthDate: z.date().optional(),
          });
      }

      if (loadedSettings?.generalAppSettings?.requireTermsSignature && loadedSettings?.generalAppSettings?.termsAndConditions) {
          dynamicSchema = dynamicSchema.extend({
            agreeToTerms: z.literal(true, {
              errorMap: () => ({ message: "יש לאשר את התקנון כדי להמשיך." }),
            })
          });
      }
      
      setFormSchema(dynamicSchema);

  }, []);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: phone,
      email: '',
      gender: 'female',
      agreeToTerms: false,
    },
  });

  useEffect(() => {
    form.setValue('phone', phone);
  }, [phone, form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('firstName', values.firstName);
      formData.append('lastName', values.lastName);
      formData.append('phone', values.phone);
      if(values.email) formData.append('email', values.email);
      if(values.birthDate) formData.append('birthDate', values.birthDate.toISOString());
      formData.append('gender', values.gender);
      
      const result = await registerAction(formData);
      if (result?.success && result.redirectUrl) {
        router.push(result.redirectUrl);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>שם פרטי</FormLabel>
              <FormControl>
                <Input {...field} placeholder="" />
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
                <Input {...field} placeholder="" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>מספר טלפון</FormLabel>
              <FormControl>
                <Input {...field} readOnly disabled />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {(formSchema.shape as any).email && (
             <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>אימייל</FormLabel>
                    <FormControl>
                        <Input {...field} type="email" placeholder="" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        )}
       
        {(formSchema.shape as any).birthDate && (
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
                           />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        )}


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
                >
                  <FormItem className="flex items-center space-x-2 space-x-reverse">
                    <FormControl>
                      <RadioGroupItem value="female" id="female-reg" />
                    </FormControl>
                    <FormLabel htmlFor="female-reg" className="font-normal">
                      נקבה
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-x-reverse">
                    <FormControl>
                      <RadioGroupItem value="male" id="male-reg" />
                    </FormControl>
                    <FormLabel htmlFor="male-reg" className="font-normal">
                      זכר
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {settings?.generalAppSettings?.requireTermsSignature && settings?.generalAppSettings?.termsAndConditions && (
             <FormField
                control={form.control}
                name="agreeToTerms"
                render={({ field }) => (
                    <FormItem>
                        <Card>
                            <CardContent className="p-4">
                                <Label className="font-bold">תקנון</Label>
                                <ScrollArea className="h-24 w-full rounded-md border p-2 mt-2">
                                    <pre className="text-sm whitespace-pre-wrap font-sans">
                                        {settings.generalAppSettings.termsAndConditions}
                                    </pre>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                        <div className="flex items-center space-x-2 space-x-reverse mt-2">
                             <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                             </FormControl>
                             <Label htmlFor="agreeToTerms">קראתי ואני מאשר/ת את התקנון</Label>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />
        )}


        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : 'סיום הרשמה'}
        </Button>
      </form>
    </Form>
  );
}
