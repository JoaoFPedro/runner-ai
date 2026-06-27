import { PrismaHelper } from "../../../../../infra/db/prisma/helpers/prisma-helpers";
import { LoadAccountByEmailRepository } from "../../account/load-account-by-email-repository";

export class AccountPrismaRepository implements LoadAccountByEmailRepository {
  async loadByEmail(email: string) {
    const account = await PrismaHelper.client.account.findUnique({
      where: { email },
    });
    if (!account) return null;

    return account;
  }
}
