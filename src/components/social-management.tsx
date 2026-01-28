
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, ArrowLeft, Settings, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

type Platform = 'facebook' | 'instagram' | 'tiktok';

type SocialUsernames = {
    [key: string]: string | undefined;
};

const getSocialPlatformEmbedUrl = (platform: Platform, username: string): string => {
    switch (platform) {
        case 'facebook':
            return `https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2F${encodeURIComponent(username)}%2F&tabs=timeline&width=340&height=500&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true&appId`;
        case 'instagram':
            return `https://www.instagram.com/${encodeURIComponent(username)}/embed`;
        case 'tiktok':
            const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
            return `https://www.tiktok.com/@${encodeURIComponent(cleanUsername)}`;
    }
}

const getSocialPlatformProfileUrl = (platform: Platform, username: string): string => {
    switch (platform) {
        case 'facebook':
            return `https://www.facebook.com/${encodeURIComponent(username)}`;
        case 'instagram':
            return `https://www.instagram.com/${encodeURIComponent(username)}`;
        case 'tiktok':
             const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
             return `https://www.tiktok.com/@${encodeURIComponent(cleanUsername)}`;
    }
}


const socialPlatforms = [
  {
    id: "facebook" as Platform,
    name: "פייסבוק",
    icon: <Facebook className="h-8 w-8 text-blue-600" />,
    embeddable: true,
  },
  {
    id: "instagram" as Platform,
    name: "אינסטגרם",
    icon: <Instagram className="h-8 w-8 text-pink-500" />,
    embeddable: true,
  },
  {
    id: "tiktok" as Platform,
    name: "טיקטוק",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 0 .17.02.25.04.5.11 1 .28 1.43.58.44.31.78.72 1.05 1.18.28.47.46.99.57 1.54.11.55.15 1.12.16 1.69.01 1.62.01 3.24.01 4.86 0 .33-.01.66-.04.99-.06.57-.22 1.12-.48 1.64a4.13 4.13 0 01-1.12 1.57c-.49.43-1.06.74-1.68.95-.62.2-1.28.3-1.94.31a.8.8 0 01-.29.02c-2.33.01-4.66.01-6.99.01-.39 0-.78-.02-1.17-.07-.5-.06-1-.21-1.46-.45-.45-.24-.87-.56-1.22-.94-.36-.39-.65-.84-.87-1.34-.22-.5-.38-1.03-.47-1.58-.09-.55-.13-1.1-.14-1.66-.01-1.63-.01-3.25-.01-4.88 0-.39.02-.78.06-1.17.06-.5.21-1 .44-1.46.24-.46.55-.87.93-1.23.38-.35.83-.64 1.32-.86.49-.22 1.02-.36 1.56-.44.54-.08 1.08-.12 1.62-.13 1.64-.01 3.28-.01 4.92-.01zM7.75 4.14c-.39.02-.77.05-1.15.15-.31.08-.6.22-.86.4-.27.18-.5.4-.69.67-.2.28-.35.59-.44.92-.09.32-.15.66-.17 1a4.93 4.93 0 00-.02 1.48v4.34c.01.38.03.76.08 1.13.06.4.18.79.37 1.15.19.36.45.68.76.95.31.27.67.48 1.06.62.39.14.8.22 1.21.25.41.03.82.04 1.23.04h4.4c.4 0 .79-.01 1.19-.04.4-.03.79-.11 1.17-.24.38-.13.73-.32 1.05-.56.32-.24.6-.54.81-.88.21-.34.37-.72.46-1.12.1-.39.15-.79.17-1.19V7.65c-.01-.4-.03-.79-.08-1.18-.06-.4-.18-.79-.37-1.15-.19-.36-.45-.68-.76-.95-.31-.27-.67-.48 1.06.62.39-.14-.8-.22-1.21-.25-.41-.03-.82-.04-1.23-.04H9.02c-.41 0-.81.01-1.22.04a5.6 5.6 0 00-.05-.01zm.09 6.07c-.52.02-1.02-.07-1.5-.27-.48-.2-.9-.5-1.22-.9-.32-.4-.53-.87-.62-1.38-.09-.5-.1-1.01-.1-1.52 0-.27.01-.55.03-.82.04-.51.17-1 .4-1.44.23-.44.54-.82.93-1.12.39-.3.85-.52 1.35-.65.5-.13 1.01-.18 1.52-.17.5.01 1 .09 1.47.27.47.18.9.45 1.26.8.36.35.64.77.82 1.24.18.47.28.97.29 1.49.01.51-.07 1.02-.24 1.49-.17.47-.44.9-.79 1.26-.35.36-.77.64-1.23.82-.46.18-.96.28-1.46.29zm4.27-5.06c.21 0 .42.01.63.03.48.04.93.18 1.34.4.41.22.76.52 1.04.88.28.36.48.78.6 1.25.12.47.16.96.16 1.46 0 .49-.04.98-.15 1.45-.11.47-.3.91-.56 1.31-.26.4-.59.74-.98 1.01-.4.27-.85.46-1.32.56-.47.1-.96.12-1.44.08-.49-.04-.96-.16-1.4-.35-.44-.19-.84-.46-1.18-.8-.34-.34-.6-.74-.78-1.18-.18-.44-.27-.92-.27-1.41 0-.49.09-.97.26-1.43.17-.46.43-.88.77-1.24.34-.36.75-.63 1.2-.82.44-.19.92-.29 1.4-.3z"/>
      </svg>
    ),
    embeddable: false,
  },
];

export function SocialManagement() {
  const [socialUsernames, setSocialUsernames] = useState<SocialUsernames>({});

  useEffect(() => {
    const savedUsernames = localStorage.getItem('socialUsernames');
    if (savedUsernames) {
        try {
            const parsedUsernames = JSON.parse(savedUsernames) as SocialUsernames;
            setSocialUsernames(parsedUsernames);
        } catch(e) {
            console.error("Failed to parse social usernames:", e);
        }
    }
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
       <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Link href="/admin" passHref>
            <Button variant="outline">
                <ArrowLeft className="mr-2" />
                חזרה
            </Button>
            </Link>
            <h1 className="text-2xl font-bold">ניהול רשתות חברתיות</h1>
        </div>
         <Link href="/admin/settings" passHref>
            <Button variant="outline" size="icon">
                <Settings className="h-5 w-5" />
            </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {socialPlatforms.map((platform) => {
            const usernameKey = `${platform.id}User`;
            const username = socialUsernames[usernameKey]
            const embedUrl = username ? getSocialPlatformEmbedUrl(platform.id, username) : "about:blank";
            const profileUrl = username ? getSocialPlatformProfileUrl(platform.id, username) : "#";


            return (
              <Card key={platform.name} className="flex flex-col">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 no-underline text-current hover:opacity-80 transition-opacity">
                      {platform.icon}
                      <CardTitle>{platform.name}</CardTitle>
                  </a>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                  { !username ? (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4 border rounded-md bg-muted/50">
                        <CardDescription>
                            שם המשתמש עבור {platform.name} אינו מוגדר.
                        </CardDescription>
                        <Link href="/admin/settings" passHref>
                            <Button variant="link" className="mt-2">
                                עבור אל ההגדרות כדי להגדיר
                            </Button>
                        </Link>
                    </div>
                  ) : platform.embeddable ? (
                     <div className="aspect-w-16 aspect-h-9 w-full h-full border rounded-md overflow-hidden flex-grow">
                        <iframe
                          src={embedUrl}
                          className="w-full h-full"
                          style={{ border: "none", height: "600px" }}
                          allow="encrypted-media"
                          sandbox="allow-scripts allow-same-origin allow-popups"
                        ></iframe>
                      </div>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4 border rounded-md bg-muted/50">
                        <CardDescription>
                            הצגת פיד עבור {platform.name} אינה נתמכת.
                        </CardDescription>
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                            <Button className="mt-4">
                                <LinkIcon className="ml-2" />
                                צפה בפרופיל @{username.startsWith('@') ? username.substring(1) : username}
                            </Button>
                        </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
        })}
      </div>
    </div>
  );
}
