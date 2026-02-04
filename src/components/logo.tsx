
'use client';

import { cn } from "@/lib/utils";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { getLogo } from "@/lib/settings";

const FALLBACK_LOGO_URL = "https://firebasestorage.googleapis.com/v0/b/yasmin-beauty-diary.firebasestorage.app/o/logo%2Flogo%20yasmin%20levi.png?alt=media&token=27516397-70dc-4e30-a674-4174315b0971";

export function Logo({ className, ...props }: React.ComponentProps<"div">) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndSetLogo = async () => {
      // Try to get from localStorage first for speed
      const cachedLogo = localStorage.getItem('businessLogoUrl');
      if (cachedLogo) {
        setLogoUrl(cachedLogo);
      }
      
      // Fetch from DB to ensure it's up-to-date
      const dbLogo = await getLogo();
      if (dbLogo) {
        setLogoUrl(dbLogo);
        localStorage.setItem('businessLogoUrl', dbLogo);
      } else if (!cachedLogo) {
        setLogoUrl(FALLBACK_LOGO_URL);
      }
    };

    fetchAndSetLogo();
    
     // Listen for updates from other tabs
    const handleStorageChange = () => {
      const newLogo = localStorage.getItem('businessLogoUrl');
      if (newLogo) {
        setLogoUrl(newLogo);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);

  }, []);


  if (!logoUrl) {
    return <div className={cn("relative bg-muted rounded-md animate-pulse", className)} {...props} />;
  }

  return (
    <div className={cn("relative", className)} {...props}>
      <Image
        src={logoUrl}
        alt="Business Logo"
        fill
        className="object-contain"
        data-ai-hint="logo beauty"
        unoptimized 
      />
    </div>
  );
}
