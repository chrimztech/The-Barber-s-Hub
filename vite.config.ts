// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Outside Lovable's own build sandbox, nitro is skipped unless explicitly
  // enabled here — without this, `vite build` on Vercel/CI only emits static
  // client assets and there's no SSR server to route requests, hence 404s.
  // Vercel sets process.env.VERCEL during its build, so we target its Build
  // Output API there and fall back to the Cloudflare Workers preset everywhere else.
  nitro: {
    preset: process.env.VERCEL ? "vercel" : "cloudflare-module",
  },
});
