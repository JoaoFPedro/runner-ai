import { LoginController } from "../../../../presentation/controllers/login/login-controllers";
import { makeDbAuthentication } from "../../usecases/authentication/db-authentication-factory";
import { makeLoginValidation } from "./login-validation-factory";

export const makeLoginController = (): LoginController => {
  return new LoginController(makeLoginValidation(), makeDbAuthentication());
};
