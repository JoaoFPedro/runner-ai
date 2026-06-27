import { PrismaClient } from "../../../../generated/prisma/client";

export const PrismaHelper = {
  client: new PrismaClient(),

  async connect(): Promise<void> {
    await this.client.$connect();
  },
  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  },
};
