import { resolve } from 'path';
import handlebars from 'vite-plugin-handlebars';

export default {
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        join: resolve(__dirname, 'src/join.html'),
        trips: resolve(__dirname, 'src/trips.html'),
        about: resolve(__dirname, 'src/about.html'),
        suggest: resolve(__dirname, 'src/suggest.html'),
        officer: resolve(__dirname, 'src/officer.html'),
        officerSettings: resolve(__dirname, 'src/officer-settings.html'),
      },
    },
  },
  plugins: [
    handlebars({
      partialDirectory: resolve(__dirname, 'src/partials'),
    }),
  ],
};
