import "dotenv/config";
import { PrismaHelper } from "../infra/db/prisma/helpers/prisma-helpers";
import env from "../main/config/env";
PrismaHelper.connect().then(async () => {
  const { setupApp } = await import("../main/config/app");
  const app = await setupApp();
  app.listen(env.port, () => {
    console.log(`Server running at PORT: ${env.port}`);
  });
});
