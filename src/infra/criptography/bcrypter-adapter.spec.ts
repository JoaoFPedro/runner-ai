import { describe, expect, jest, test } from "@jest/globals";
import bcrypt from "bcrypt";
import { BcrypterAdapter } from "./bcrypter-adapter";

describe("BcrypterAdapter", () => {
  test("should return true when compare succeeds", async () => {
    const sut = new BcrypterAdapter(12);
    const hash = await bcrypt.hash("any_password", 12);
    const isValid = await sut.compare("any_password", hash);

    expect(isValid).toBeTruthy();
  });
  test("should return false when compare fails", async () => {
    const sut = new BcrypterAdapter(12);
    const hash = await bcrypt.hash("another_password", 12);
    const isValid = await sut.compare("any_password", hash);

    expect(isValid).toBeFalsy();
  });
});
