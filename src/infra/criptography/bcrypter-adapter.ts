import { HashComparer } from "../../data/protocols/criptography/hash-comparer";
import bcrypt from "bcrypt";

export class BcrypterAdapter implements HashComparer {
  constructor(private readonly salt: number) {}
  async compare(value: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(value, hash);
  }
}
