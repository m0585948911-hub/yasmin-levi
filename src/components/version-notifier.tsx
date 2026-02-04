'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { APP_VERSION } from '@/lib/version';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function VersionNotifier() {
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const appInfoRef = doc(db, 'settings', 'appInfo');
        const docSnap = await getDoc(appInfoRef);
        if (docSnap.exists()) {
          const serverVersion = docSnap.data().latestVersion;
          if (serverVersion && serverVersion !== APP_VERSION) {
            setLatestVersion(serverVersion);
            setShowUpdateDialog(true);
          }
        }
      } catch (error) {
        console.error("Error checking for new version:", error);
      }
    };

    // Check for version after a short delay to not block initial render
    const timer = setTimeout(checkVersion, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleUpdate = () => {
    // Clear local storage to force a full data refresh
    localStorage.clear();
    // Reload the page from the root
    window.location.href = '/';
  };

  return (
    <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>עדכון גרסה זמין</DialogTitle>
          <DialogDescription>
            גרסה חדשה של האפליקציה ({latestVersion}) זמינה.
            <br />
            כדי להמשיך, יש לרענן את האפליקציה.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleUpdate} className="w-full">
            עדכן ורענן
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
