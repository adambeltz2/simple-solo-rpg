import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://adambeltz2.github.io/simple-solo-rpg/ (a GitHub Pages
  // project site), so assets must resolve under that subpath.
  base: '/simple-solo-rpg/',
  plugins: [react()],
})
