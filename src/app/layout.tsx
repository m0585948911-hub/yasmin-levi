import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppThemeApplicator } from '@/components/app-theme-applicator';
import { Toaster } from '@/components/ui/toaster';
import { APP_VERSION } from '@/lib/version';
import NotificationsBootstrap from '@/components/NotificationsBootstrap';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'יסמין לוי',
  description: 'ניהול יומן ומעקב לקוחות',
  manifest: '/manifest.json',
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

        {/* חובה ב-Next 15 כאשר יש שימוש ב-useSearchParams בתוך רכיב קליינט */}
        <Suspense fallback={null}>
          <NotificationsBootstrap />
        </Suspense>

        {children}
        <Toaster />

        <footer className="fixed bottom-0 left-0 right-0 p-2 text-center text-xs text-muted-foreground bg-background border-t z-50">
          <p>פיתוח: יסמין לוי | גרסה: {APP_VERSION}</p>
        </footer>
      </body>
    </html>
  );
}
