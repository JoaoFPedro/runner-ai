import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { PrismaHelper } from "../../../../../infra/db/prisma/helpers/prisma-helpers";
import { AccountPrismaRepository } from "./account-prisma-repository";

describe("JWTAdapter", () => {
  beforeAll(async () => {
    await PrismaHelper.connect();
  });

  afterAll(async () => {
    await PrismaHelper.disconnect();
  });

  afterEach(async () => {
    await PrismaHelper.client.account.deleteMany();
  });
  test("should return account on success", async () => {
    await PrismaHelper.client.account.create({
      data: {
        name: "any_name",
        email: "any_email@mail.com",
        password: "hashed_password",
      },
    });
    const sut = new AccountPrismaRepository();
    const httpResponse = await sut.loadByEmail("any_email@mail.com");

    expect(httpResponse).toBeTruthy();
    expect(httpResponse?.email).toBe("any_email@mail.com");
  });
});
