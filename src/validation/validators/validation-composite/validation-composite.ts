import { Validation } from "../../../presentation/protocols";

export class ValidationComposite implements Validation {
  constructor(private readonly validations: Validation[]) {}

  validator(input: any): Error | undefined | null {
    for (const validation of this.validations) {
      const error = validation.validator(input);
      if (error) return error;
    }
  }
}
