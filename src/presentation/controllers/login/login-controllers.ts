import { Authentication } from "../../../domain/use-cases/authentication/authentication";
import {
  badRequest,
  serverError,
  success,
  unauthorized,
} from "../../helpers/http/http-helpers";
import {
  Controller,
  HttpRequest,
  HttpResponse,
  Validation,
} from "../../protocols";

export class LoginController implements Controller {
  constructor(
    private validation: Validation,
    private authentication: Authentication,
  ) {}
  async handle(httpRequest: HttpRequest): Promise<HttpResponse> {
    try {
      const error = await this.validation.validator(httpRequest.body);
      if (error) return badRequest(error);
      const accessToken = await this.authentication.auth(httpRequest.body);
      if (!accessToken) {
        return unauthorized();
      }
      return success(accessToken);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
