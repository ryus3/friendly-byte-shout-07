import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ryus.inventory',
  appName: 'متجر RYUS',
  webDir: 'dist',
  server: {
    url: 'https://5a9f8315-d7f4-4708-9260-f85606ca37a8.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#1e293b',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#3b82f6'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1e293b'
    },
    App: {
      deepLinkingEnabled: true
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  },
  android: {
    icon: 'public/app-icon.png'
  }
};

export default config;