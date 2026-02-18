import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config.js";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import url from 'url';

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    host: "0.0.0.0",
    hmr: {
      server,
      path: "/vite-hmr",
    },
    allowedHosts: true as const,
    fs: {
      strict: true,
      allow: [".."],
      deny: ["**/.*"],
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    optimizeDeps: {
      force: true,
    },
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Add no-cache middleware for all dev requests to fix Outdated Optimize Dep
  // This must be BEFORE vite.middlewares
  app.use((req, res, next) => {
    const isViteAsset = req.path.startsWith('/@') ||
      req.path.includes('node_modules') ||
      req.path.endsWith('.tsx') ||
      req.path.endsWith('.ts') ||
      req.path.endsWith('.css');

    if (isViteAsset) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    }
    next();
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    const url = req.originalUrl;
    const pathName = req.path;

    // Skip API and assets that should be handled by other middlewares
    if (pathName.startsWith("/api") || pathName.includes(".")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      if (!fs.existsSync(clientTemplate)) {
        console.error(`Index template not found at ${clientTemplate}`);
        return next();
      }

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Inject version to force main.tsx reload
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200)
        .set({
          "Content-Type": "text/html",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        })
        .end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });


}
