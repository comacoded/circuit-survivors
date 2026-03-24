import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nickcoma.circuitsurvivors',
  appName: 'Circuit Survivors',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
    backgroundColor: '#050510',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050510',
    },
  },
};

export default config;
