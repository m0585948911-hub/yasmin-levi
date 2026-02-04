import { ProfileForm } from '@/components/profile-form';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

export default function NotificationsSettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <ProfileForm title="הגדרות והתראות" />
    </Suspense>
  );
}
