import { MissingParamError } from "../../../presentation/erros/missing-param-error";
import { Validation } from "../../../presentation/protocols";

export class RequiredFields implements Validation {
  constructor(private readonly fieldName: string) {}

  validator(input: any): Error | null {
    if (!input[this.fieldName]) return new MissingParamError(this.fieldName);
    return null;
  }
}
