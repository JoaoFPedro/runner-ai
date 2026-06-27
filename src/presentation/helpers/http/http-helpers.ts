import { ServerError } from "../../erros/server-error";
import { UnauthorizedError } from "../../erros/unauthorizedError-error";
import { HttpResponse } from "../../protocols";

export const badRequest = (error: Error): HttpResponse => ({
  statusCode: 400,
  body: error,
});

export const unauthorized = (): HttpResponse => ({
  statusCode: 401,
  body: new UnauthorizedError(),
});
export const success = (data: any): HttpResponse => ({
  statusCode: 200,
  body: data,
});
export const serverError = (error: Error): HttpResponse => ({
  statusCode: 500,
  body: new ServerError(error.stack),
});
