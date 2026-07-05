import { EmailValidatorAdapter } from "../../../../infra/adapters/email-validator-adapter";
import { EmailValidation } from "../../../../validation/validators/email-validation/email-validation";
import { RequiredFields } from "../../../../validation/validators/required-fields/required-fields";
import { ValidationComposite } from "../../../../validation/validators/validation-composite/validation-composite";

export const makeLoginValidation = (): ValidationComposite => {
  return new ValidationComposite([
    new RequiredFields("email"),
    new RequiredFields("password"),
    new EmailValidation("email", new EmailValidatorAdapter()),
  ]);
};
