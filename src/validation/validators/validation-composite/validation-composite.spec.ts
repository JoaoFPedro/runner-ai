import { describe, expect, test } from "@jest/globals";
import { ValidationComposite } from "./validation-composite";
import { Validation } from "../../../presentation/protocols";

const makeValidationStub = (error?: Error): Validation => ({
  validator: () => error,
});

describe("ValidationComposite", () => {
  test("should return first error", () => {
    const firstError = new Error("first_error");
    const sut = new ValidationComposite([
      makeValidationStub(firstError),
      makeValidationStub(new Error("second_error")),
    ]);

    const error = sut.validator({});
    expect(error).toBe(firstError);
  });

  test("should return undefined if all validations pass", () => {
    const sut = new ValidationComposite([
      makeValidationStub(),
      makeValidationStub(),
    ]);

    const error = sut.validator({});
    expect(error).toBeUndefined();
  });
});
