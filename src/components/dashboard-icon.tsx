import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

type DashboardIconProps = {
  icon: React.ReactNode;
  label: string;
  href: string;
  badgeCount?: number;
  external?: boolean;
  action?: () => void;
};

export function DashboardIcon({ icon, label, href, badgeCount, external = false, action }: DashboardIconProps) {
  const linkProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};

  const content = (
    <div className="group relative flex flex-col items-center justify-center">
      <Card className="flex flex-col items-center justify-center p-4 w-full h-32 md:h-36 aspect-square transition-all duration-300 ease-in-out group-hover:shadow-xl group-hover:scale-105 group-hover:bg-accent border-2 border-transparent hover:border-primary/30 rounded-xl">
        <CardContent className="p-0 flex items-center justify-center flex-grow">
            {icon}
        </CardContent>
      </Card>
      <div className="mt-2 text-center h-10">
         <p className="text-sm md:text-base font-semibold text-foreground leading-tight">{label}</p>
      </div>
      {badgeCount != null && badgeCount > 0 && (
        <div className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center pointer-events-none ring-2 ring-background">
          {badgeCount}
        </div>
      )}
    </div>
  );

  if (action) {
    return (
        <button onClick={action} className="no-underline group w-full">
            {content}
        </button>
    );
  }

  return (
    <Link href={href} {...linkProps} className="no-underline w-full">
      {content}
    </Link>
  );
}
