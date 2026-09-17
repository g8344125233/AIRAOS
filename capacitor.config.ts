import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.airaos.assistant',
  appName: 'AIRAOS',
  webDir: 'mobile/www',
  bundledWebRuntime: false,
  server: {
    cleartext: true,
  },
};

export default config;
