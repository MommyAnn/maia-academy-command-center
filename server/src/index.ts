import { buildApp } from "./app.js";
import { env } from "./env.js";

const app = await buildApp();

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`M.A.I.A. server listening on :${env.PORT} [${env.NODE_ENV}]`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
