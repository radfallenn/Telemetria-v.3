import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.studiorad.gt7telemetrynext',
  appName: 'GT7 Telemetria Next',
  webDir: 'www',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
