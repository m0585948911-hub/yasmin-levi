'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { getActiveNotifications } from "@/lib/notifications";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Notification {
  id: string;
  title: string;
  content: string;
  expiresAt: Date;
  createdAt: Date;
}

export function UpdatesSection() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      setIsLoading(true);
      try {
        const fetchedNotifications = await getActiveNotifications();
        // Convert date strings from server to Date objects
        const parsedNotifications = fetchedNotifications.map(n => ({
          ...n,
          createdAt: new Date(n.createdAt),
          expiresAt: new Date(n.expiresAt)
        }));
        setNotifications(parsedNotifications);
      } catch (error) {
        console.error("Failed to load notifications:", error);
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadNotifications();
  }, []);


  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-2xl text-primary">עדכונים ומבצעים</CardTitle>
        <CardDescription>ההודעות האחרונות מהקליניקה</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification, index) => (
              <div key={notification.id}>
                <div className="mb-2">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold">{notification.title}</h3>
                    <span className="text-xs text-muted-foreground">{format(notification.createdAt, 'dd/MM/yyyy')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.content}</p>
                </div>
                {index < notifications.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        ) : (
           <p className="text-center text-muted-foreground py-8">אין עדכונים חדשים כרגע.</p>
        )}
      </CardContent>
    </Card>
  );
}
