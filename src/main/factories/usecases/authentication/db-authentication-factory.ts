import { AccountPrismaRepository } from "../../../../data/protocols/db/prisma/account/account-prisma-repository";
import { DbAuthentication } from "../../../../data/use-cases/authentication/db-authentication";
import { BcrypterAdapter } from "../../../../infra/criptography/bcrypter/bcrypter-adapter";
import { JwtAdapter } from "../../../../infra/criptography/jwt-adapter/jwt-adapter";
import env from "../../../config/env";

export const makeDbAuthentication = (): DbAuthentication => {
  return new DbAuthentication(
    new AccountPrismaRepository(),
    new BcrypterAdapter(12),
    new JwtAdapter(env.jwtSecret),
  );
};
