import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

/**
 * Build configuration.
 *
 * `manualChunks` exists because the landing page should not download the whole
 * product. Routes are already split by `React.lazy`, but without this every
 * page's chunk carried its own copy of the vendor graph's entry points and the
 * first paint pulled far more than it needed. The groups below are the
 * dependencies more than one route shares — splitting them means a student who
 * moves from /learn to /practice re-uses what the browser already cached
 * instead of fetching Radix and React Query again.
 *
 * Nothing here is speculative: each group is a package the app genuinely
 * imports, and anything not listed stays in the chunk that uses it.
 */
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // The visualiser and the grader legitimately push a route chunk past the
    // default 500 kB warning. Raised so the warning still means something.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          return undefined;
        },
      },
    },
  },
}));
