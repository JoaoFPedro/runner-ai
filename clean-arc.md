# Arquitetura do Projeto — clean-node-api

## Visão Geral

Esta API foi construída seguindo os princípios da **Clean Architecture** (Arquitetura Limpa) de Robert C. Martin, combinados com os princípios **SOLID**. O objetivo central é manter a independência entre regras de negócio, mecanismos de entrega e detalhes de infraestrutura, garantindo alta testabilidade e facilidade de manutenção.

**Stack principal:**

- **Runtime:** Node.js 20.x
- **Linguagem:** TypeScript 5.x
- **Framework HTTP:** Express 5.x
- **Banco de dados:** MongoDB (driver nativo)
- **Autenticação:** JWT (`jsonwebtoken`)
- **Criptografia:** bcrypt
- **Documentação:** Swagger UI (`swagger-ui-express`)
- **Testes:** Jest (unitário com `ts-jest`, integração com `@shelf/jest-mongodb`)
- **Infra:** Docker + Docker Compose

---

## Estrutura de Camadas

```
src/
├── domain/          # Regras de negócio puras — núcleo da aplicação
├── data/            # Implementações dos casos de uso + protocolos de dados
├── infra/           # Implementações externas (BD, criptografia, adaptadores)
├── presentation/    # Controllers, middlewares HTTP, helpers e erros
├── main/            # Composição da aplicação (factories, rotas, config, servidor)
└── validation/      # Validadores reutilizáveis
```

A dependência flui de fora para dentro: `main → infra/presentation → data → domain`. O `domain` nunca depende de nenhuma outra camada.

---

## Camada `domain`

**Propósito:** Define entidades (modelos) e interfaces de casos de uso. É a camada mais interna e não possui dependência de nenhuma outra.

### Modelos (`domain/models/`)

Tipos TypeScript simples que representam as entidades do sistema:

```typescript
// account.ts
export type AccountModel = {
  id: string;
  name: string;
  email: string;
  password: string;
};

// load-survey-model.ts
export type SurveyModel = {
  id: string;
  question: string;
  answers: SurveyAnswerModel[];
  date: Date;
};
export type SurveyAnswerModel = {
  image?: string;
  answer: string;
};

// survey-result.ts
export type SurveyResultModel = {
  id: string;
  surveyId: string;
  accountId: string;
  answer: string;
  date: Date;
};
```

### Casos de Uso (`domain/use-cases/`)

Interfaces que definem **o que** o sistema faz, sem **como** fazer:

```typescript
// add-account/add-account-use-case.ts
export type AddAccountParams = Omit<AccountModel, "id">;
export interface AddAccount {
  add(account: AddAccountParams): Promise<AccountModel | null>;
}

// add-account/authentication.ts
export interface AuthenticationParams {
  email: string;
  password: string;
}
export interface Authentication {
  auth(params: AuthenticationParams): Promise<string | null>;
}

// add-account/load-account-by-token.ts
export interface LoadAccountByToken {
  loadByToken(accessToken: string, role?: string): Promise<AccountModel | null>;
}

// survey/add-survey.ts
export type AddSurveyParams = Omit<SurveyModel, "id">;
export interface AddSurvey {
  add(data: AddSurveyParams): Promise<void>;
}

// survey/load-surveys.ts / load-survey-by-id.ts
// surve-result/save-survey-result.ts
```

> **Convenção:** `AddAccountParams` = `Omit<Modelo, 'id'>` para operações de criação. O `id` é gerado pelo banco.

---

## Camada `data`

**Propósito:** Implementa os casos de uso do `domain` e define protocolos (interfaces) para as dependências externas de dados (repositórios, criptografia). Não conhece o banco nem a camada HTTP.

### Protocolos de Criptografia (`data/protocols/criptography/`)

Interfaces que abstraem operações criptográficas:

| Interface      | Método                                   | Implementação     |
| -------------- | ---------------------------------------- | ----------------- |
| `Hasher`       | `hash(value): Promise<string>`           | `BCrypterAdapter` |
| `HashComparer` | `compare(value, hash): Promise<boolean>` | `BCrypterAdapter` |
| `Encrypter`    | `encrypt(userId): Promise<string>`       | `JwtAdapter`      |
| `Decrypter`    | `decrypt(value): Promise<string>`        | `JwtAdapter`      |

### Protocolos de Repositório (`data/protocols/db/`)

Interfaces para acesso ao banco, organizadas por entidade:

```
db/
├── account/
│   ├── add-account-repository.ts
│   ├── load-account-by-email-repository.ts
│   ├── load-account-by-token-repository.ts
│   └── update-access-token-repository.ts
├── survey/
│   ├── add-survey-repository.ts
│   ├── load-surveys-repository.ts
│   └── load-survey-repository-by-id.ts
├── save-survey-result/
└── log/
    └── log-error-repository.ts
```

### Implementações de Casos de Uso (`data/use-cases/`)

Cada caso de uso tem sua própria pasta com três arquivos:

```
data/use-cases/add-account/
├── db-add-account-protocols.ts   # barrel de re-exports
├── db-add-account.ts             # implementação
└── db-add-account.spec.ts        # testes unitários
```

**Padrão barrel de protocolos (`*-protocols.ts`):** Concentra todos os imports necessários para a implementação em um único arquivo, evitando importações dispersas:

```typescript
// db-add-account-protocols.ts
export * from "@/domain/models/account";
export * from "@/domain/use-cases/add-account/add-account-use-case";
export * from "@/data/protocols/criptography/hasher";
export * from "@/data/protocols/db/account/add-account-repository";
export * from "@/data/protocols/db/account/load-account-by-email-repository";
```

**Exemplo de implementação — `DbAddAccount`:**

```typescript
export class DbAddAccount implements AddAccount {
  constructor(
    private readonly encrypter: Hasher,
    private readonly addAccountRepository: AddAccountRepository,
    private readonly loadAccountByEmailRepository: LoadAccountByEmailRepository,
  ) {}

  async add(accountData: AddAccountParams): Promise<AccountModel | null> {
    // 1. Verifica duplicidade de e-mail
    const existing = await this.loadAccountByEmailRepository.loadByEmail(
      accountData.email,
    );
    if (existing) return null;

    // 2. Gera hash da senha
    const hashedPassword = await this.encrypter.hash(accountData.password);

    // 3. Persiste a conta
    return this.addAccountRepository.add({
      ...accountData,
      password: hashedPassword,
    });
  }
}
```

> **Regra:** A classe de dados recebe suas dependências via construtor (Injeção de Dependência). Implementa a interface do `domain` e depende apenas de interfaces, nunca de implementações concretas.

---

## Camada `infra`

**Propósito:** Contém as implementações concretas dos protocolos definidos em `data`. É a única camada que conhece MongoDB, bcrypt, JWT etc.

### Criptografia (`infra/criptography/`)

**`BCrypterAdapter`** — implementa `Hasher` e `HashComparer`:

```typescript
export class BCrypterAdapter implements Hasher, HashComparer {
  constructor(private readonly salt: number) {}
  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.salt);
  }
  async compare(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
```

**`JwtAdapter`** — implementa `Encrypter` e `Decrypter`:

```typescript
export class JwtAdapter implements Encrypter, Decrypter {
  constructor(private readonly secret: string) {}
  async encrypt(value: string): Promise<string> {
    return jwt.sign({ id: value }, this.secret);
  }
  async decrypt(value: string): Promise<string> {
    return jwt.verify(value, this.secret) as any;
  }
}
```

### Banco de Dados (`infra/db/mongodb/`)

**`MongoHelper`** — helper singleton para gerenciar a conexão:

```typescript
export const MongoHelper = {
  client: null as MongoClient | null,
  uri: null as string | null,

  async connect(uri: string): Promise<void> { ... },
  async disconnect(): Promise<void> { ... },
  async getCollection(name: string) {
    // reconecta automaticamente se a conexão cair
    if (!this.client) await this.connect(this.uri || '');
    return this.client?.db()?.collection(name);
  },
  map: (doc: any): any => {
    // transforma _id em id
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  },
};
```

**`AccountMongoRepository`** — implementa múltiplos repositórios em uma única classe:

```typescript
export class AccountMongoRepository
  implements
    AddAccountRepository,
    LoadAccountByEmailRepository,
    UpdateAccessTokenRepository,
    LoadAccountByToken
{
  async add(account: AddAccountParams): Promise<AccountModel | null> { ... }
  async loadByEmail(email: string): Promise<AccountModel> { ... }
  async updateAccessToken(id: string, token: string): Promise<void> { ... }
  async loadByToken(token: string, role?: string): Promise<AccountModel | null> { ... }
}
```

> **Convenção de mapeamento:** Sempre use `MongoHelper.map()` para converter documentos MongoDB antes de retornar. Isso garante que o campo `_id` seja exposto como `id` string.

### Adaptadores (`infra/adapters/`)

```typescript
// email-validator-adapter.ts — wrapper da lib 'validator'
export class EmailValidatorAdapter implements EmailValidator {
  isValid(email: string): boolean {
    return validator.isEmail(email);
  }
}
```

---

## Camada `presentation`

**Propósito:** Trata requests HTTP. Não conhece Express diretamente — opera sobre os tipos `HttpRequest` e `HttpResponse` definidos internamente.

### Protocolos (`presentation/protocols/`)

```typescript
// https.ts
export type HttpRequest = {
  body?: any;
  headers?: any;
  params?: any;
  accountId?: string;
};
export type HttpResponse = { statusCode: number; body?: any };

// controller.ts
export interface Controller {
  handle(httpRequest: HttpRequest): Promise<HttpResponse>;
}

// middleware.ts
export interface Middleware {
  handle(httpRequest: HttpRequest): Promise<HttpResponse>;
}

// validation.ts
export interface Validation {
  validate(input: any): Error | null | undefined;
}
```

### HTTP Helper (`presentation/helpers/http/http-helper.ts`)

Funções puras que criam respostas HTTP padronizadas:

```typescript
export const badRequest = (error: Error): HttpResponse => ({
  statusCode: 400,
  body: error,
});
export const unauthorized = (): HttpResponse => ({
  statusCode: 401,
  body: new UnauthorizedError(),
});
export const forbidden = (error: Error): HttpResponse => ({
  statusCode: 403,
  body: error,
});
export const serverError = (error: Error): HttpResponse => ({
  statusCode: 500,
  body: new ServerError(error.stack),
});
export const success = (data: any): HttpResponse => ({
  statusCode: 200,
  body: data,
});
export const noContent = (): HttpResponse => ({ statusCode: 204, body: null });
```

### Controllers (`presentation/controllers/`)

```
controllers/
├── login/
│   ├── login/     — LoginController
│   └── signup/    — SignUpController
└── survey/
    ├── add-survey/        — AddSurveyController
    ├── load-surveys/      — LoadSurveysController
    └── survey-result/     — SaveSurveyResultController
```

**Padrão de controller:**

1. Injetar `Validation` e casos de uso via construtor
2. No `handle`: validar o body, executar caso de uso, retornar resposta via helper
3. Envolver tudo em `try/catch` → retornar `serverError` em caso de exceção

```typescript
export class SignUpController implements Controller {
  constructor(
    private readonly addAccount: AddAccount,
    private readonly validation: Validation,
    private readonly authentication: Authentication,
  ) {}

  async handle(httpRequest: HttpRequest): Promise<HttpResponse> {
    const error = this.validation.validate(httpRequest.body);
    if (error) return badRequest(error);

    try {
      const { name, email, password } = httpRequest.body;
      const account = await this.addAccount.add({ name, email, password });
      if (!account) return forbidden(new EmailInUseError());
      const accessToken = await this.authentication.auth({ email, password });
      return success({ accessToken });
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
```

**Arquivo de protocolos do controller (`*-protocols.ts`):** Cada controller tem um barrel de re-exports dos tipos que usa:

```typescript
// signup-controller-protocols.ts
export * from "../../../protocols";
export * from "../../../../domain/use-cases/add-account/add-account-use-case";
// ...
```

### Middlewares (`presentation/middlewares/`)

**`AuthMiddleware`** — lê o header `x-access-token`, valida o token via `LoadAccountByToken`, injeta o `accountId` na request:

```typescript
export class AuthMiddleware implements Middleware {
  constructor(
    private readonly loadAccountByToken: LoadAccountByToken,
    private readonly role: string,
  ) {}

  async handle(httpRequest: HttpRequest): Promise<HttpResponse> {
    try {
      const accessToken = httpRequest.headers?.["x-access-token"];
      if (accessToken) {
        const account = await this.loadAccountByToken.loadByToken(
          accessToken,
          this.role,
        );
        if (account) return success({ accountId: account.id });
      }
      return forbidden(new AccessDeniedError());
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
```

### Erros (`presentation/erros/`)

Erros customizados que estendem `Error`:

- `MissingParamError` — campo obrigatório ausente
- `InvalidParamError` — campo com valor inválido
- `EmailInUseError` — e-mail já cadastrado
- `UnauthorizedError` — credenciais inválidas
- `AccessDeniedError` — sem permissão
- `ServerError` — erro interno inesperado

---

## Camada `validation`

**Propósito:** Validadores reutilizáveis que implementam a interface `Validation` da camada `presentation`.

### Validators (`validation/validators/`)

| Classe                | Função                                                 |
| --------------------- | ------------------------------------------------------ |
| `RequiredFields`      | Verifica se um campo está presente no input            |
| `CompareFields`       | Verifica se dois campos têm o mesmo valor              |
| `EmailValidation`     | Valida formato de e-mail usando `EmailValidator`       |
| `ValidationComposite` | Agrega múltiplos validadores — retorna o primeiro erro |

**`ValidationComposite` (Composite Pattern):**

```typescript
export class ValidationComposite implements Validation {
  constructor(private readonly validations: Validation[]) {}
  validate(input: any): Error | null | undefined {
    for (const validation of this.validations) {
      const error = validation.validate(input);
      if (error) return error;
    }
  }
}
```

---

## Camada `main`

**Propósito:** Composição da aplicação. Liga todas as camadas usando Factories e Adapters. É a única camada que instancia classes concretas.

### Servidor (`main/server.ts`)

Ponto de entrada: conecta ao MongoDB antes de inicializar o Express.

```typescript
MongoHelper.connect(env.mongoUrl).then(async () => {
  const { setupApp } = await import("./config/app");
  const app = await setupApp();
  app.listen(env.port, () =>
    console.log(`Listen at port: http://localhost:${env.port}`),
  );
});
```

> O import dinâmico de `setupApp` garante que o app Express só seja configurado após a conexão com o banco estar estabelecida.

### Configuração do App (`main/config/`)

```
config/
├── app.ts          — monta o Express (swagger → middlewares → rotas)
├── middlewares.ts  — registra bodyParser, cors, contentType
├── routes.ts       — carrega automaticamente todos os arquivos *-routes.{ts,js}
├── config-swagger.ts — configura swagger-ui em /api-docs
└── env.ts          — variáveis de ambiente com defaults
```

**Carregamento automático de rotas:**

```typescript
// routes.ts — usa fast-glob para descobrir rotas dinamicamente
const routeFiles = fg.sync("**/*-routes.{ts,js}", {
  cwd: `${__dirname}/../routes`,
});
for (const file of routeFiles) {
  (await import(`../routes/${file}`)).default(router);
}
```

### Adapters (`main/adapters/`)

Ponte entre Express e os protocolos internos:

**`adaptRoute`** — converte um `Controller` em um handler do Express:

```typescript
export const adaptRoute =
  (controller: Controller) => async (req: Request, res: Response) => {
    const httpRequest: HttpRequest = { body: req.body };
    const httpResponse = await controller.handle(httpRequest);
    if (httpResponse.statusCode >= 200 && httpResponse.statusCode <= 299) {
      res.status(httpResponse.statusCode).json(httpResponse.body);
    } else {
      res
        .status(httpResponse.statusCode)
        .json({ error: httpResponse.body.message });
    }
  };
```

**`adaptMiddleware`** — converte um `Middleware` em um middleware do Express, propagando dados da resposta (ex: `accountId`) para o objeto `req`:

```typescript
export const adaptMiddleware =
  (middleware: Middleware) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const httpRequest: HttpRequest = { headers: req.headers };
    const httpResponse = await middleware.handle(httpRequest);
    if (httpResponse.statusCode === 200) {
      Object.assign(req, httpResponse.body); // injeta accountId, etc.
      next();
    } else {
      res
        .status(httpResponse.statusCode)
        .json({ error: httpResponse.body.message });
    }
  };
```

### Factories (`main/factories/`)

As factories são responsáveis por instanciar e compor os objetos. Toda a lógica de construção fica aqui.

```
factories/
├── controllers/
│   ├── login/
│   │   ├── login/     — makeLoginController()
│   │   └── signup/    — makeSingUpController() + makeSingUpValidation()
│   └── survey/
│       ├── add-survey/         — makeAddSurveyController() + makeAddSurveyValidation()
│       ├── load-survey/
│       └── save-survey-result/
├── usecases/
│   ├── account/add-account/    — makeDbAddAccount()
│   ├── authentication/         — makeDbAuthentication()
│   ├── load-account-by-token/
│   └── survey/
├── middlewares/
│   └── auth-middleware-factory.ts — makeAuthMiddleware(role?)
└── decoratos/
    └── log-controller-decotaror-factory.ts — makeLogControllerDecorator(controller)
```

**Exemplo de factory de controller:**

```typescript
// signup-factory.ts
export const makeSingUpController = (): Controller => {
  const controller = new SignUpController(
    makeDbAddAccount(), // use case factory
    makeSingUpValidation(), // validation factory
    makeDbAuthentication(), // use case factory
  );
  return makeLogControllerDecorator(controller); // aplica decorator de log
};
```

**Exemplo de factory de validation:**

```typescript
// signup-validation.ts
export const makeSingUpValidation = (): ValidationComposite => {
  const validations: Validation[] = [];
  for (const field of ["name", "email", "password", "confirmationPassword"]) {
    validations.push(new RequiredFields(field));
  }
  validations.push(new CompareFields("password", "confirmationPassword"));
  validations.push(new EmailValidation(new EmailValidatorAdapter(), "email"));
  return new ValidationComposite(validations);
};
```

**Exemplo de factory de caso de uso:**

```typescript
// db-authentication.ts
export const makeDbAuthentication = (): Authentication => {
  const bcryptAdapter = new BCrypterAdapter(12);
  const jwtAdapter = new JwtAdapter(env.jwtSecret);
  const accountMongoRepository = new AccountMongoRepository();
  return new DbAuthentication(
    accountMongoRepository,
    bcryptAdapter,
    jwtAdapter,
    accountMongoRepository,
  );
};
```

### Decorators (`main/decorators/`)

**`LogControllerDecorator`** — Decorator Pattern aplicado sobre qualquer `Controller`. Intercepta respostas com status 500 e persiste o stack trace no banco:

```typescript
export class LogControllerDecorator implements Controller {
  constructor(
    private readonly controller: Controller,
    private readonly logErrorRepository: LogErrorRepository,
  ) {}

  async handle(httpRequest: HttpRequest): Promise<HttpResponse> {
    const httpResponse = await this.controller.handle(httpRequest);
    if (httpResponse.statusCode === 500) {
      await this.logErrorRepository.logError(httpResponse.body.stack);
    }
    return httpResponse;
  }
}
```

### Rotas (`main/routes/`)

Cada arquivo de rota registra endpoints em um `Router` do Express e aplica middlewares de autenticação quando necessário:

```typescript
// survey-routes.ts
export default (router: Router): void => {
  router.post("/surveys", adminAuth, adaptRoute(makeAddSurveyController()));
  router.get("/surveys", admin, adaptRoute(makeLoadSurveyController()));
};
```

**Middlewares de autenticação:**

- `admin` — usuário autenticado (qualquer role)
- `adminAuth` — requer role de administrador

```typescript
// auth.ts
export const admin = adaptMiddleware(makeAuthMiddleware());
// admin-auth.ts
export const adminAuth = adaptMiddleware(makeAuthMiddleware("admin"));
```

### Variáveis de Ambiente (`main/config/env.ts`)

```typescript
export default {
  mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/clean-node-api",
  port: process.env.PORT || 5050,
  jwtSecret: process.env.JWT_SECRET || "tj670==5h",
};
```

---

## Documentação Swagger (`main/docs/`)

A documentação é montada programaticamente em TypeScript:

```
docs/
├── index.ts      — objeto raiz OpenAPI 3.0
├── paths.ts      — mapa de todos os endpoints
├── schemas.ts    — mapa de todos os schemas
├── components/   — respostas padrão (badRequest, forbidden, serverError...)
├── paths/        — um arquivo por endpoint
└── schemas/      — um arquivo por schema
```

Servida em `/api-docs` com `noCache` middleware.

---

## Estratégia de Testes

| Tipo       | Arquivo     | Configuração                 |
| ---------- | ----------- | ---------------------------- |
| Unitários  | `*.spec.ts` | `jest-unit-config.js`        |
| Integração | `*.test.ts` | `jest-integration-config.js` |

- **Unitários:** isolam a classe sob teste com mocks manuais. Os mocks ficam em `*/test/` e `*/tests/` de cada camada.
- **Integração:** usam `mongodb-memory-server` (via `@shelf/jest-mongodb`) — banco em memória, sem dependência de Docker.
- **Coverage:** exclui `src/main/**` e `**/test/**`.
- **Path alias:** `@/` mapeia para `src/` tanto em runtime quanto nos testes.

**Padrão de mock:**

```typescript
// data/test/mock-db-account.ts
export const mockAddAccountRepository = (): AddAccountRepository => {
  class AddAccountRepositoryStub implements AddAccountRepository {
    async add(account: AddAccountParams): Promise<AccountModel> {
      return mockAccountModel(); // retorna fixture
    }
  }
  return new AddAccountRepositoryStub();
};
```

---

## Fluxo de uma Requisição (end-to-end)

Exemplo: `POST /api/signup`

```
Request HTTP
    │
    ▼
Express Router (main/routes/login/login-routes.ts)
    │  router.post('/signup', adaptRoute(makeSingUpController()))
    │
    ▼
adaptRoute (main/adapters/express-route-adapter.ts)
    │  converte req.body → HttpRequest
    │
    ▼
LogControllerDecorator (main/decorators/log-controller-decorator.ts)
    │  delega para o controller; loga erros 500
    │
    ▼
SignUpController (presentation/controllers/login/signup/)
    │  1. Validation → badRequest se inválido
    │  2. AddAccount.add() → forbidden se e-mail duplicado
    │  3. Authentication.auth() → success com accessToken
    │
    ▼
DbAddAccount (data/use-cases/add-account/)
    │  Hasher.hash() + LoadAccountByEmailRepository + AddAccountRepository
    │
    ▼
AccountMongoRepository / BCrypterAdapter (infra/)
    │  operações reais no MongoDB e bcrypt
    │
    ▼
HttpResponse → adaptRoute → res.status().json()
```

---

## Como Adicionar um Novo Recurso

Siga estes passos para adicionar, por exemplo, um recurso `Product`:

### 1. `domain` — Defina o modelo e o contrato

```typescript
// domain/models/product.ts
export type ProductModel = { id: string; name: string; price: number };

// domain/use-cases/product/add-product.ts
export type AddProductParams = Omit<ProductModel, "id">;
export interface AddProduct {
  add(data: AddProductParams): Promise<ProductModel | null>;
}
```

### 2. `data` — Defina protocolos de repositório e implemente o caso de uso

```typescript
// data/protocols/db/product/add-product-repository.ts
export interface AddProductRepository {
  add(data: AddProductParams): Promise<ProductModel | null>;
}

// data/use-cases/add-product/db-add-product-protocols.ts
export * from "@/domain/models/product";
export * from "@/domain/use-cases/product/add-product";
export * from "@/data/protocols/db/product/add-product-repository";

// data/use-cases/add-product/db-add-product.ts
export class DbAddProduct implements AddProduct {
  constructor(private readonly addProductRepository: AddProductRepository) {}
  async add(data: AddProductParams): Promise<ProductModel | null> {
    return this.addProductRepository.add(data);
  }
}
```

### 3. `infra` — Implemente o repositório MongoDB

```typescript
// infra/db/mongodb/product/product-mongo-repository.ts
export class ProductMongoRepository implements AddProductRepository {
  async add(data: AddProductParams): Promise<ProductModel | null> {
    const col = await MongoHelper.getCollection("products");
    const result = await col?.insertOne(data);
    const doc = await col?.findOne({ _id: result?.insertedId });
    return doc ? MongoHelper.map(doc) : null;
  }
}
```

### 4. `presentation` — Crie o controller

```typescript
// presentation/controllers/product/add-product/add-product-controller.ts
export class AddProductController implements Controller {
  constructor(
    private readonly validation: Validation,
    private readonly addProduct: AddProduct,
  ) {}
  async handle(httpRequest: HttpRequest): Promise<HttpResponse> {
    const error = this.validation.validate(httpRequest.body);
    if (error) return badRequest(error);
    try {
      const product = await this.addProduct.add(httpRequest.body);
      return success(product);
    } catch (e) {
      return serverError(e as Error);
    }
  }
}
```

### 5. `validation` — Crie a factory de validação

```typescript
// main/factories/controllers/product/add-product/add-product-validation.ts
export const makeAddProductValidation = (): ValidationComposite => {
  return new ValidationComposite([
    new RequiredFields("name"),
    new RequiredFields("price"),
  ]);
};
```

### 6. `main` — Factories, rotas e wiring

```typescript
// main/factories/usecases/product/db-add-product.ts
export const makeDbAddProduct = (): AddProduct =>
  new DbAddProduct(new ProductMongoRepository());

// main/factories/controllers/product/add-product/add-product-factory.ts
export const makeAddProductController = (): Controller =>
  makeLogControllerDecorator(
    new AddProductController(makeAddProductValidation(), makeDbAddProduct()),
  );

// main/routes/product/product-routes.ts
export default (router: Router): void => {
  router.post("/products", admin, adaptRoute(makeAddProductController()));
};
```

> O arquivo de rota será descoberto automaticamente pelo `fast-glob` por terminar em `-routes.ts`.

---

## Convenções de Nomenclatura

| Categoria               | Padrão                   | Exemplo                            |
| ----------------------- | ------------------------ | ---------------------------------- |
| Arquivos                | `kebab-case`             | `add-account-repository.ts`        |
| Classes                 | `PascalCase`             | `DbAddAccount`, `SignUpController` |
| Interfaces de domínio   | `PascalCase`             | `AddAccount`, `Authentication`     |
| Implementações de dados | Prefixo `Db`             | `DbAddAccount`, `DbAuthentication` |
| Repositórios (infra)    | Sufixo `MongoRepository` | `AccountMongoRepository`           |
| Adapters (infra)        | Sufixo `Adapter`         | `BCrypterAdapter`, `JwtAdapter`    |
| Factories               | Prefixo `make`           | `makeDbAuthentication()`           |
| Testes unitários        | Sufixo `.spec.ts`        | `db-add-account.spec.ts`           |
| Testes de integração    | Sufixo `.test.ts`        | `login-up.test.ts`                 |
| Barrels de protocolos   | Sufixo `-protocols.ts`   | `db-add-account-protocols.ts`      |

---

## Infraestrutura (Docker)

```yaml
# docker-compose.yml
services:
  mongo:
    image: mongo:5
    ports: ["27017:27017"]
  api:
    build: .
    ports: ["5050:5050", "9222:9222"] # 9222 = debugger
    environment:
      - MONGO_URL=mongodb://mongo:27017/clean-node-api
    command: npm run debug # nodemon com inspect
```

**Scripts úteis:**

| Comando                    | Descrição                       |
| -------------------------- | ------------------------------- |
| `npm run build`            | Compila TypeScript para `dist/` |
| `npm run up`               | Build + `docker-compose up -d`  |
| `npm test`                 | Todos os testes                 |
| `npm run test:unit`        | Watch — apenas `.spec.ts`       |
| `npm run test:integration` | Watch — apenas `.test.ts`       |
| `npm run test:ci`          | Testes com cobertura            |
