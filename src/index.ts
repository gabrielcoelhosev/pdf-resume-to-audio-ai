import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { pdfRoutes } from "./routes/pdf";

const app = new Elysia()
  .use(staticPlugin({ assets: "public", prefix: "" })) // Explicitamente serve a pasta 'public' na raiz
  .get("/", () => Bun.file("public/index.html")) 
  .use(pdfRoutes)
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
