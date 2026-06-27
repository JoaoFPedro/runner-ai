import { describe, expect, jest, test } from "@jest/globals";
import jwt from "jsonwebtoken";
import { JwtAdapter } from "./jwt-adapter";

describe("JWTAdapter", () => {
  test("should call sign with correct values", async () => {
    const sut = new JwtAdapter("secret");
    const spy = jest.spyOn(jwt, "sign") as unknown as jest.SpiedFunction<
      (payload: string, secret: string) => string
    >;
    sut.encrypt("any_id");
    expect(spy).toHaveBeenCalledWith("any_id", "secret");
  });
  test("should throw if sign throws", async () => {
    const sut = new JwtAdapter("secret");
    jest.spyOn(jwt, "sign").mockImplementationOnce(() => {
      throw new Error();
    });
    // O padrão correto para testar exceções em métodos async é await
    await expect(sut.encrypt("any_id")).rejects.toThrow();
  });
});
