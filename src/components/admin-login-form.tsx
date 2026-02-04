
'use client';

import { useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminLogin } from '@/app/admin/actions';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  phone: z.string().min(1, { message: 'יש להזין מספר טלפון' }),
  password: z.string().min(1, { message: 'יש להזין סיסמה' }),
});

export function AdminLoginForm() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phone: '',
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('phone', values.phone);
      formData.append('password', values.password);
      const result = await adminLogin(formData);
      if (result.error) {
        toast({
          variant: "destructive",
          title: "שגיאת כניסה",
          description: result.error,
        })
      } else if (result.success && result.user) {
        localStorage.setItem('adminUser', JSON.stringify(result.user));
        router.push('/admin');
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>סיסמה</FormLabel>
              <div className="relative">
                <FormControl>
                  <Input placeholder="••••••••" {...field} type={showPassword ? "text" : "password"} dir="ltr" className="pr-10" />
                </FormControl>
                 <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
              </div>
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
