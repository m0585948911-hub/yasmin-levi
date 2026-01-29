
'use client';

import { useTransition, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, type AnyZodObject } from 'zod';
import { login } from '@/app/actions';
import type { AllSettings } from '@/lib/settings-types';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SETTINGS_STORAGE_KEY = 'appGeneralSettings';

const baseSchema = z.object({
  phone: z.string().min(5, { message: 'מספר טלפון לא תקין' }).max(20),
});

const israeliPhoneSchema = z.object({
    phone: z.string()
        .min(5, { message: 'מספר טלפון לא תקין' })
        .max(20)
        .refine(phone => {
            const cleaned = phone.replace(/[^0-9+]/g, '');
            return cleaned.startsWith('05') || cleaned.startsWith('+972');
        }, { message: 'יש להזין מספר טלפון ישראלי תקין' }),
});


export function LoginForm({ onUserNotFound }: { onUserNotFound: (phone: string) => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formSchema, setFormSchema] = useState<AnyZodObject>(baseSchema);

  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings) as AllSettings;
            if (parsed.generalAppSettings?.restrictToIsraeliNumbers) {
                setFormSchema(israeliPhoneSchema);
            }
        } catch(e) {
            console.error("Failed to parse settings for login form", e);
        }
    }
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('phone', values.phone);
      const result = await login(formData);

      if (result?.success && result.redirectUrl) {
        try {
            const url = new URL(result.redirectUrl, window.location.origin);
            const params = url.searchParams;
            const clientUser = {
                id: params.get('id'),
                firstName: params.get('firstName'),
                lastName: params.get('lastName'),
                gender: params.get('gender'),
                phone: params.get('phone'),
            };
            if (clientUser.id) {
                localStorage.setItem('clientUser', JSON.stringify(clientUser));
            }
        } catch (e) {
            console.error("Failed to save client user to storage", e);
        }
        router.push(result.redirectUrl);
      } else if (result?.reason === 'not_found' && result.phone) {
        onUserNotFound(result.phone);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>מספר טלפון</FormLabel>
              <FormControl>
                <Input placeholder="05X-XXXXXXX" {...field} type="tel" dir="ltr" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : 'כניסה'}
        </Button>
      </form>
    </Form>
  );
}
