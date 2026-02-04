
import { Suspense } from 'react';
import { RegisterForm } from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';

// This page is no longer used for the main registration flow,
// but we can keep it as a fallback or for direct access if needed.
export default function RegisterPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <Logo className="w-48 h-48 mb-6" />
        <Card className="shadow-2xl border-primary/20 w-full">
          <CardHeader className="text-center">
            <h1 className="font-headline text-4xl font-bold text-primary">הרשמה</h1>
            <CardDescription className="pt-2 text-muted-foreground">
              נראה שזו הפעם הראשונה שלך כאן, ברוכה הבאה!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading...</div>}>
              <RegisterForm phone="" />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
