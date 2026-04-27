import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
        swipe: resolve(__dirname, 'swipe.html'),
        match: resolve(__dirname, 'match.html'),
        realtime_chat: resolve(__dirname, 'realtime_chat.html'),
      },
    },
  },
});
