import { defineConfig, splitVendorChunkPlugin } from "vite";
import path from "path";
import autoprefixer from "autoprefixer";
import react from "@vitejs/plugin-react-swc";
import basicSsl from "@vitejs/plugin-basic-ssl";

let plugins = [
  react(),
  splitVendorChunkPlugin()
];

if(process.env.SERVE_HTTPS) {
  plugins.push(basicSsl());
}

export default defineConfig(() => {
  return {
    plugins,
    server: {
      port: 8089,
      host: true
    },
    build: {
      rollupOptions: {
        output: {
          assetFileNames: (chunkInfo) => {
            if(chunkInfo.name === "style.css")
              return "elv-player-js.css";
          },
        },
      },
      lib: {
        entry: path.resolve(__dirname, "lib/index.js"),
        name: "@eluvio/elv-player-js",
        fileName: (format) => `elv-player-js.${format}.js`,
        formats: ["es", "cjs"]
      },
      cssCodeSplit: false,
      manifest: true
    },
    css: {
      postcss: {
        plugins: [
          autoprefixer
        ]
      }
    }
  };
});
