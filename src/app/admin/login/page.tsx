import { AdminLoginForm } from '@/components/admin-login-form';
import { Logo } from '@/components/logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center justify-center text-center">
        <Logo className="w-64 h-64 mb-6" />
        <Card className="shadow-2xl border-primary/20 w-full max-w-md">
          <CardHeader>
             <CardTitle className="text-2xl font-bold text-primary">כניסת מנהל</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminLoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
