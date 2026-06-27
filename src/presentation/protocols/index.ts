export interface Validation {
  validator(input: any): Error | undefined | null;
}
export type HttpRequest = {
  body?: any;
  headers?: any;
  params?: any;
  accountId?: string;
};
export type HttpResponse = {
  statusCode: number;
  body: any;
};

export interface Controller {
  handle(httpRequest: HttpRequest): Promise<HttpResponse>;
}
