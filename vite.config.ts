import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Injects build timestamp into sw.js so each deploy gets a new SW version
function swVersionPlugin(): Plugin {
  return {
    name: "sw-version",
    writeBundle() {
      const swPath = resolve("build/client/sw.js");
      try {
        const content = readFileSync(swPath, "utf-8");
        const versioned = content.replace("__BUILD_VERSION__", Date.now().toString(36));
        writeFileSync(swPath, versioned);
      } catch {}
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths(), swVersionPlugin()],
});
