import { describe, expect, jest, test } from "@jest/globals";
import { DbAuthentication } from "./db-authentication";
import { LoadAccountByEmailRepository } from "../../protocols/db/account/load-account-by-email-repository";
import { HashComparer } from "../../protocols/criptography/hash-comparer";
import { Encrypter } from "../../protocols/criptography/encrypt";

const makeLoadByAccountEmailRepository = (): LoadAccountByEmailRepository => {
  class LoadAccountByEmailRepositoryStub implements LoadAccountByEmailRepository {
    async loadByEmail(email: string) {
      const account = {
        id: "any_id",
        name: "valid_name",
        email: "any_email@mail.com",
        password: "hashed_password",
      };
      return account;
    }
  }
  return new LoadAccountByEmailRepositoryStub();
};

const makeHashComparerRepository = (): HashComparer => {
  class HashComparerRepositoryStub implements HashComparer {
    async compare(value: string, hash: string) {
      return true;
    }
  }
  return new HashComparerRepositoryStub();
};
const makeEncrypterRepository = (): Encrypter => {
  class HashComparerRepositoryStub implements Encrypter {
    async encrypt(value: string) {
      return "any_token";
    }
  }
  return new HashComparerRepositoryStub();
};
const makeSut = (): any => {
  const loadAccuntByEmailRepositoryStub = makeLoadByAccountEmailRepository();
  const hashComparerStub = makeHashComparerRepository();
  const encrypterStub = makeEncrypterRepository();
  const sut = new DbAuthentication(
    loadAccuntByEmailRepositoryStub,
    hashComparerStub,
    encrypterStub,
  );

  return {
    sut,
    loadAccuntByEmailRepositoryStub,
    hashComparerStub,
    encrypterStub,
  };
};

describe("DbAuthentication", () => {
  test("should call LoadByAccountByEmailRepository with correct email", async () => {
    const { sut, loadAccuntByEmailRepositoryStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };

    const spy = jest.spyOn(loadAccuntByEmailRepositoryStub, "loadByEmail");

    await sut.auth(httpRequest);

    expect(spy).toHaveBeenCalledWith("any_email@mail.com");
  });

  test("should return null if LoadAccountByEmailRepository returns null", async () => {
    const { sut, loadAccuntByEmailRepositoryStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };
    jest
      .spyOn(loadAccuntByEmailRepositoryStub, "loadByEmail")
      .mockResolvedValueOnce(null);

    const httpResponse = await sut.auth(httpRequest);

    expect(httpResponse).toBeNull();
  });
  test("should call HashComparer with correct values", async () => {
    const { sut, hashComparerStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };
    const spy = jest.spyOn(hashComparerStub, "compare");

    await sut.auth(httpRequest);

    expect(spy).toHaveBeenCalledWith("any_password", "hashed_password");
  });

  test("should return null if HashComparer returns false", async () => {
    const { sut, hashComparerStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };
    jest.spyOn(hashComparerStub, "compare").mockResolvedValueOnce(false);

    const httpResponse = await sut.auth(httpRequest);

    expect(httpResponse).toBeFalsy();
  });

  test("should call Encrypter with correct values", async () => {
    const { sut, encrypterStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };
    const spy = jest.spyOn(encrypterStub, "encrypt");

    await sut.auth(httpRequest);

    expect(spy).toHaveBeenCalledWith("any_id");
  });
  test("should return access token on success", async () => {
    const { sut, encrypterStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };
    jest.spyOn(encrypterStub, "encrypt");

    const httpResponse = await sut.auth(httpRequest);

    expect(httpResponse).toBe("any_token");
  });

  test("should throw if LoadAccountByEmailRepository throws", async () => {
    const { sut, loadAccuntByEmailRepositoryStub } = makeSut();

    const httpRequest = {
      email: "any_email@mail.com",
      password: "any_password",
    };
    jest
      .spyOn(loadAccuntByEmailRepositoryStub, "loadByEmail")
      .mockRejectedValueOnce(new Error());

    await expect(
      sut.auth({ email: "any_email@mail.com", password: "any_password" }),
    ).rejects.toThrow();
  });
});
