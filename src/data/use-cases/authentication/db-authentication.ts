import {
  Authentication,
  AuthenticationParams,
} from "../../../domain/use-cases/authentication/authentication";
import { Encrypter } from "../../protocols/criptography/encrypt";
import { HashComparer } from "../../protocols/criptography/hash-comparer";
import { LoadAccountByEmailRepository } from "../../protocols/db/account/load-account-by-email-repository";

export class DbAuthentication implements Authentication {
  constructor(
    private readonly loadAccuntByEmailRepository: LoadAccountByEmailRepository,
    private readonly hashComparer: HashComparer,
    private readonly encrypter: Encrypter,
  ) {}

  async auth(params: AuthenticationParams): Promise<string | null> {
    const { email, password } = params;
    const account = await this.loadAccuntByEmailRepository.loadByEmail(email);

    if (!account) return null;

    const isValid = await this.hashComparer.compare(password, account.password);

    if (!isValid) return null;

    return this.encrypter.encrypt(account.id);
  }
}
