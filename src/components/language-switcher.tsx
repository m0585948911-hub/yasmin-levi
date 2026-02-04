'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  // TODO: Implement language switching logic
  const setLocale = (locale: string) => {
    console.log(`Switching to ${locale}`);
    // This is where you would typically change the language using a context or a library like next-intl
    // For now, we'll just log it. A full implementation requires a broader setup.
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale('en')}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('he')}>
          עברית
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
