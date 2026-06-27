import validator from "validator";
import { EmailValidator } from "../../validation/validators/email-validation/email-validation";

export class EmailValidatorAdapter implements EmailValidator {
  isValid(email: string): boolean {
    return validator.isEmail(email);
  }
}
