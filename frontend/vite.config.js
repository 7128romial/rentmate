import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        welcome: resolve(__dirname, 'welcome.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
        swipe: resolve(__dirname, 'swipe.html'),
        match: resolve(__dirname, 'match.html'),
        realtime_chat: resolve(__dirname, 'realtime_chat.html'),
        profile: resolve(__dirname, 'profile.html'),
        matches: resolve(__dirname, 'matches.html'),
        landlord: resolve(__dirname, 'landlord.html'),
        landlord_property: resolve(__dirname, 'landlord_property.html'),
        landlord_inquiries: resolve(__dirname, 'landlord_inquiries.html'),
        landlord_add: resolve(__dirname, 'landlord_add.html'),
        settings: resolve(__dirname, 'settings.html'),
        checkout: resolve(__dirname, 'checkout.html'),
      },
    },
  },
});
