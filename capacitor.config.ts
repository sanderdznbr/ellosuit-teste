
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.84320702497142e0bb916756570feabc',
  appName: 'ellosuit-connect-vista',
  webDir: 'dist',
  server: {
    url: 'https://84320702-4971-42e0-bb91-6756570feabc.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
