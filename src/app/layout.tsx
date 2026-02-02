import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppThemeApplicator } from '@/components/app-theme-applicator';
import { Toaster } from '@/components/ui/toaster';
import { APP_VERSION } from '@/lib/version';

export const metadata: Metadata = {
  title: 'יסמין לוי',
  description: 'ניהול יומן ומעקב לקוחות',
  manifest: '/manifest.json',
  icons: {
    icon: 'https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/logo%2Flogo%20yasmin%20levi.png?alt=media&token=27516397-70dc-4e30-a674-4174315b0971',
    apple: 'https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/logo%2Flogo%20yasmin%20levi.png?alt=media&token=27516397-70dc-4e30-a674-4174315b0971',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F9F7F9',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AppThemeApplicator />
        {children}
        <Toaster />
        <footer className="fixed bottom-0 left-0 right-0 p-2 text-center text-xs text-muted-foreground bg-background border-t z-50">
          <p>פיתוח: יסמין לוי | גרסה: {APP_VERSION}</p>
        </footer>
      </body>
    </html>
  );
}
