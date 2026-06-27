import { describe, expect, jest, test } from "@jest/globals";
import { MissingParamError } from "../../../presentation/erros/missing-param-error";
import { RequiredFields } from "./required-fields";

describe("RequiredFields", () => {
  test("should return MissingParamError if field is missing", () => {
    const sut = new RequiredFields("email");
    const error = sut.validator({});
    expect(error).toEqual(new MissingParamError("email"));
  });
  test("should return null if field is present", () => {
    const sut = new RequiredFields("email");
    const error = sut.validator({ email: "any_mail@mail.com" });
    expect(error).toBeNull();
  });
});
