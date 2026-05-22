import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import obfuscatorPlugin from "rollup-plugin-obfuscator";

export default defineConfig(({ command }) => {
  const isProd = command === "build";

  // Obfuscator must only run on the CLIENT bundle — never on the SSR/server
  // bundle. Applying it to the server side breaks Node.js startup because:
  //   1. debugProtectionInterval creates an infinite setInterval
  //   2. self-defending code interferes with require/import resolution
  // The `applyToEnvironment` hook (Vite 6+) ensures this is client-only.
  const clientObfuscator = isProd
    ? Object.assign(
        obfuscatorPlugin({
          options: {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.5,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.3,
            debugProtection: true,
            debugProtectionInterval: 4000,
            disableConsoleOutput: true,
            identifierNamesGenerator: "hexadecimal",
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 8,
            stringArray: true,
            stringArrayCallsTransform: true,
            stringArrayCallsTransformThreshold: 0.75,
            stringArrayEncoding: ["rc4"],
            stringArrayIndexShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 3,
            stringArrayWrappersChainedCalls: true,
            stringArrayWrappersParametersMaxCount: 4,
            stringArrayWrappersType: "function",
            stringArrayThreshold: 0.75,
            transformObjectKeys: true,
            unicodeEscapeSequence: false,
          },
        }),
        {
          name: "obfuscator-client-only",
          // applyToEnvironment restricts this plugin to the client build only
          applyToEnvironment: (env: { name: string }) => env.name === "client",
        },
      )
    : null;

  return {
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart(),
      react(),
      clientObfuscator,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    build: {
      sourcemap: false,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 3,
        },
        mangle: {
          toplevel: true,
          properties: false,
        },
        format: {
          comments: false,
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      watch: {
        // Exclude bun's package cache from the file watcher to prevent
        // endless program reloads caused by tsconfigs inside the cache.
        ignored: ["**/.cache/**", "**/node_modules/**", "**/.git/**"],
      },
    },
  };
});
