import { describe, expect, jest, test } from "@jest/globals";
import { InvalidParamError } from "../../../presentation/erros/invalid-param-error";
import { EmailValidation } from "./email-validation";

const makeEmailValidatorStub = () => ({
  isValid: jest.fn<(email: string) => boolean>().mockReturnValue(true),
});

describe("EmailValidation", () => {
  test("should return InvalidParamError if email is invalid", () => {
    const emailValidatorStub = makeEmailValidatorStub();
    emailValidatorStub.isValid.mockReturnValueOnce(false);
    const sut = new EmailValidation("email", emailValidatorStub);
    const error = sut.validator({ email: "invalid_email" });

    expect(error).toEqual(new InvalidParamError("email"));
  });
  test("should call EmailValidator with correct email", () => {
    const emailValidatorStub = makeEmailValidatorStub();
    const sut = new EmailValidation("email", emailValidatorStub);
    sut.validator({ email: "any_email@mail.com" });
    expect(emailValidatorStub.isValid).toHaveBeenCalledWith(
      "any_email@mail.com",
    );
  });
});
