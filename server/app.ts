import express from "express";

const app = express();
const PORT = process.env.PORT ?? 3000;

// Chrome DevTools probes this path — return 404 before it hits React Router's catch-all
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.status(404).end();
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static("build/client"));

  const { createRequestHandler } = await import("@react-router/express");
  app.use(
    createRequestHandler({
      // @ts-expect-error — built server module
      build: await import("../build/server/index.js"),
    })
  );
} else {
  const vite = await import("vite");
  const viteDevServer = await vite.createServer({
    server: { middlewareMode: true },
  });
  app.use(viteDevServer.middlewares);

  const { createRequestHandler } = await import("@react-router/express");
  app.use(
    createRequestHandler({
      build: () =>
        viteDevServer.ssrLoadModule(
          "virtual:react-router/server-build"
        ) as any,
    })
  );
}

app.listen(PORT, () => {
  console.log(`Web server running at http://localhost:${PORT}`);
});
