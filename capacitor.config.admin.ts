
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yasmin.admin',
  appName: 'יסמין לוי ניהול',
  webDir: 'out',
  server: {
    url: 'https://studio--yasmin-beauty-diary.us-central1.hosted.app/admin/login',
    cleartext: true
  }
};

export default config;
