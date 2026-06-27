import { describe, expect, jest, test } from "@jest/globals";
import { MissingParamError } from "../../erros/missing-param-error";
import { Validation } from "../../protocols";
import { LoginController } from "./login-controllers";
import {
  Authentication,
  AuthenticationParams,
} from "../../../domain/use-cases/authentication/authentication";

describe("LoginController", () => {
  class ValidationStub implements Validation {
    validator(input: any): Error | undefined | null {
      return null;
    }
  }
  class AuthenticationStub implements Authentication {
    auth(params: AuthenticationParams): Promise<string | null> {
      return Promise.resolve(null);
    }
  }

  test("should return 400 if validation fails", async () => {
    const validationStub = new ValidationStub();
    const authenticationStub = new AuthenticationStub();

    const httpRequest = {
      body: { email: "any_email", password: "any_password" },
    };
    const sut = new LoginController(validationStub, authenticationStub);

    jest
      .spyOn(validationStub, "validator")
      .mockReturnValueOnce(new MissingParamError("email"));

    const httpResponse = sut.handle(httpRequest);
    expect((await httpResponse).statusCode).toBe(400);
  });
  test("should return 401 if authentication returns null", async () => {
    const validationStub = new ValidationStub();

    const authenticationStub = new AuthenticationStub();
    const httpRequest = {
      body: { email: "any_email", password: "any_password" },
    };
    const sut = new LoginController(validationStub, authenticationStub);

    jest
      .spyOn(authenticationStub, "auth")
      .mockReturnValueOnce(Promise.resolve(null));

    const httpResponse = sut.handle(httpRequest);
    expect((await httpResponse).statusCode).toBe(401);
  });
  test("should return 200 on success", async () => {
    const validationStub = new ValidationStub();

    const authenticationStub = new AuthenticationStub();
    const httpRequest = {
      body: { email: "any_email", password: "any_password" },
    };
    const sut = new LoginController(validationStub, authenticationStub);
    const accessToken = "any_token";
    jest
      .spyOn(authenticationStub, "auth")
      .mockReturnValueOnce(Promise.resolve(accessToken));

    const httpResponse = sut.handle(httpRequest);
    expect((await httpResponse).statusCode).toBe(200);
  });
});
