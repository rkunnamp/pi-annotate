import * as esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";

const isWatch = process.argv.includes("--watch");

const backgroundConfig = {
  entryPoints: ["src/background.ts"],
  bundle: true,
  outfile: "dist/background.js",
  format: "esm",
  target: "chrome120",
  define: { "process.env.NODE_ENV": '"production"' },
};

const contentConfig = {
  entryPoints: ["src/content.tsx"],
  bundle: true,
  outdir: "dist",
  outbase: "src",
  format: "iife",
  target: "chrome120",
  plugins: [
    sassPlugin({
      type: "local-css",
    }),
  ],
  define: { "process.env.NODE_ENV": '"production"' },
};

async function build() {
  if (isWatch) {
    const bgCtx = await esbuild.context(backgroundConfig);
    const contentCtx = await esbuild.context(contentConfig);
    await Promise.all([bgCtx.watch(), contentCtx.watch()]);
    console.log("Watching...");
  } else {
    await Promise.all([
      esbuild.build(backgroundConfig),
      esbuild.build(contentConfig),
    ]);
    console.log("Build complete");
  }
}

build().catch(console.error);
