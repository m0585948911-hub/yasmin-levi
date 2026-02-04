
'use client';

import { LoginForm } from '@/components/login-form';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Suspense, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RegisterForm } from '@/components/register-form';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function LoginPageContent() {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [phoneToRegister, setPhoneToRegister] = useState('');

  const handleUserNotFound = (phone: string) => {
    setPhoneToRegister(phone);
    setIsRegisterOpen(true);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-col items-center justify-center text-center w-full max-w-md">
        <Logo className="w-64 h-64 mb-6" />
        <Card className="shadow-2xl border-primary/20 w-full">
          <CardHeader>
             <CardTitle className="text-2xl font-bold text-primary">כניסה לאזור האישי</CardTitle>
          </CardHeader>
          <CardContent>
            <LoginForm onUserNotFound={handleUserNotFound} />
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader className="text-center">
            <DialogTitle className="font-headline text-2xl font-bold text-primary">הרשמה</DialogTitle>
            <DialogDescription className="pt-2 text-muted-foreground">
              נראה שזו הפעם הראשונה שלך כאן, ברוכה הבאה!
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            <RegisterForm phone={phoneToRegister} />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function LoginPage() {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const clientUserJson = localStorage.getItem('clientUser');
        if (clientUserJson) {
            try {
                const clientUser = JSON.parse(clientUserJson);
                if (clientUser?.id) {
                    const params = new URLSearchParams();
                    params.append('id', clientUser.id);
                    if (clientUser.firstName) params.append('firstName', clientUser.firstName);
                    if (clientUser.lastName) params.append('lastName', clientUser.lastName);
                    if (clientUser.gender) params.append('gender', clientUser.gender);
                    if (clientUser.phone) params.append('phone', clientUser.phone);
                    // Use replace to not add the login page to history
                    router.replace(`/dashboard?${params.toString()}`);
                    return; // Prevent setting isChecking to false
                }
            } catch (e) {
                console.error("Failed to parse client user from storage", e);
                // Fall through to show login page if parsing fails
            }
        }
        setIsChecking(false);
    }, [router]);

    if (isChecking) {
        return (
             <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                 <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </main>
        );
    }
    
    return (
        <Suspense>
            <LoginPageContent />
        </Suspense>
    )
}
