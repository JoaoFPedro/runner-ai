# Guia de Implementacao Guiada — Feature Login em .NET

> Reescrevendo a feature de login que ja existe em Node/TypeScript para .NET 8,
> seguindo a mesma Clean Architecture do projeto atual.
> Cada passo mostra o arquivo original em TS e o equivalente em C#.

---

## Indice

- [Visao Geral da Feature](#visao-geral-da-feature)
- [Mapa de Equivalencia TS → .NET](#mapa-de-equivalencia)
- [Passo 0 — Setup do Projeto .NET](#passo-0--setup-do-projeto-net)
- [Passo 1 — Domain: Entidade e Contrato](#passo-1--domain-entidade-e-contrato)
- [Passo 2 — Data: Protocolos de Criptografia](#passo-2--data-protocolos-de-criptografia)
- [Passo 3 — Data: Protocolo de Repositorio](#passo-3--data-protocolo-de-repositorio)
- [Passo 4 — Data: Use Case DbAuthentication](#passo-4--data-use-case-dbauthentication)
- [Passo 5 — Infra: BcryptAdapter](#passo-5--infra-bcryptadapter)
- [Passo 6 — Infra: JwtAdapter](#passo-6--infra-jwtadapter)
- [Passo 7 — Infra: Repositorio + DbContext (Prisma → EF Core)](#passo-7--infra-repositorio--dbcontext)
- [Passo 8 — Presentation: Erros Customizados](#passo-8--presentation-erros-customizados)
- [Passo 9 — Presentation: Protocolos HTTP](#passo-9--presentation-protocolos-http)
- [Passo 10 — Presentation: HTTP Helpers](#passo-10--presentation-http-helpers)
- [Passo 11 — Validation: Validators](#passo-11--validation-validators)
- [Passo 12 — Presentation: LoginController](#passo-12--presentation-logincontroller)
- [Passo 13 — Main: Factories e Composicao (DI)](#passo-13--main-factories-e-composicao)
- [Passo 14 — Main: Rotas e Server](#passo-14--main-rotas-e-server)
- [Passo 15 — Testes](#passo-15--testes)
- [Passo 16 — Rodar](#passo-16--rodar)
- [Glossario TS → C#](#glossario-ts--c)

---

## Visao Geral da Feature

O que a feature de login faz hoje:

```
POST /api/login  { email, password }

1. Valida campos obrigatorios (email, password)
2. Valida formato do email
3. Busca conta por email no banco (Prisma/PostgreSQL)
4. Compara senha com hash (bcrypt)
5. Gera token JWT
6. Retorna 200 + token  |  401  |  400
```

Arquivos envolvidos (16 arquivos):

```
domain/models/account/account.ts
domain/use-cases/authentication/authentication.ts
data/protocols/criptography/encrypt.ts
data/protocols/criptography/hash-comparer.ts
data/protocols/db/account/load-account-by-email-repository.ts
data/use-cases/authentication/db-authentication.ts
data/use-cases/authentication/db-authentication.spec.ts
data/protocols/db/prisma/account/account-prisma-repository.ts
data/protocols/db/prisma/account/account-prisma-repository.spec.ts
infra/criptography/bcrypter/bcrypter-adapter.ts (+spec)
infra/criptography/jwt-adapter/jwt-adapter.ts (+spec)
infra/db/prisma/helpers/prisma-helpers.ts
presentation/erros/*.ts (4 arquivos)
presentation/protocols/index.ts
presentation/helpers/http/http-helpers.ts
presentation/controllers/login/login-controllers.ts (+spec)
validation/validators/required-fields/required-fields.ts (+spec)
validation/validators/email-validation/email-validation.ts (+spec)
validation/validators/validation-composite/validation-composite.ts (+spec)
main/config/env.ts
main/config/app.ts
main/config/routes.ts
main/adapters/express-route-adapter.ts
main/factories/controllers/login/login-controller-factory.ts
main/factories/controllers/login/login-validation-factory.ts
main/factories/usecases/authentication/db-authentication-factory.ts
main/routes/login/login-routes.ts
main/server.ts
```

---

## Mapa de Equivalencia

| Camada | Arquivo TS | Arquivo .NET | O que muda |
|--------|-----------|-------------|------------|
| domain | `account.ts` (type) | `Account.cs` (class) | Type → classe com propriedades |
| domain | `authentication.ts` (interface) | `IAuthentication.cs` (interface) | Mesma ideia, prefixo `I` |
| data | `encrypt.ts` (interface) | `IEncrypter.cs` | `Promise<string>` → `Task<string>` |
| data | `hash-comparer.ts` (interface) | `IHashComparer.cs` | Idem |
| data | `load-account-by-email-repository.ts` | `ILoadAccountByEmailRepository.cs` | Idem |
| data | `db-authentication.ts` (class) | `DbAuthentication.cs` | Construtor com DI identico |
| infra | `bcrypter-adapter.ts` | `BcryptAdapter.cs` | bcrypt → BCrypt.Net-Next |
| infra | `jwt-adapter.ts` | `JwtAdapter.cs` | jsonwebtoken → System.IdentityModel.Tokens.Jwt |
| infra | `account-prisma-repository.ts` | `AccountEfRepository.cs` | Prisma → Entity Framework Core |
| infra | `prisma-helpers.ts` | `AppDbContext.cs` | PrismaClient → DbContext |
| presentation | erros/*.ts | Exceptions ou Result pattern | Error class → Exception |
| presentation | `index.ts` (protocols) | `IController.cs`, `IValidation.cs` | Mesmos contratos |
| presentation | `http-helpers.ts` | `HttpHelper.cs` | Funcoes puras identicas |
| presentation | `login-controllers.ts` | `LoginController.cs` | Mesma estrutura |
| validation | `required-fields.ts` | `RequiredFieldsValidation.cs` | Reflexao ou dict |
| validation | `email-validation.ts` | `EmailValidation.cs` | Regex ou MailAddress |
| validation | `validation-composite.ts` | `ValidationComposite.cs` | Composite pattern identico |
| main | factories + routes + server | `Program.cs` + DI container | Factories → DI nativo do .NET |

---

## Passo 0 — Setup do Projeto .NET

### O que existe hoje (Node)

```
npm init → package.json
npm install express bcrypt jsonwebtoken prisma ...
tsconfig.json
```

### Equivalente .NET

Rode na raiz do repositorio (fora da pasta `src/`):

```bash
# Criar pasta da solucao .NET ao lado do projeto Node
mkdir runner-ai-dotnet && cd runner-ai-dotnet

# Criar solucao
dotnet new sln -n RunnerAi

# Criar projetos por camada (mesma logica do src/ em TS)
dotnet new classlib -o src/RunnerAi.Domain
dotnet new classlib -o src/RunnerAi.Data
dotnet new classlib -o src/RunnerAi.Infra
dotnet new classlib -o src/RunnerAi.Presentation
dotnet new classlib -o src/RunnerAi.Validation
dotnet new webapi   -o src/RunnerAi.Main --use-controllers --no-https
dotnet new xunit    -o tests/RunnerAi.Data.Tests
dotnet new xunit    -o tests/RunnerAi.Infra.Tests
dotnet new xunit    -o tests/RunnerAi.Presentation.Tests

# Registrar todos na solution
dotnet sln add src/RunnerAi.Domain
dotnet sln add src/RunnerAi.Data
dotnet sln add src/RunnerAi.Infra
dotnet sln add src/RunnerAi.Presentation
dotnet sln add src/RunnerAi.Validation
dotnet sln add src/RunnerAi.Main
dotnet sln add tests/RunnerAi.Data.Tests
dotnet sln add tests/RunnerAi.Infra.Tests
dotnet sln add tests/RunnerAi.Presentation.Tests
```

### Configurar dependencias entre camadas

A regra é a mesma do projeto TS: dependencias de fora pra dentro.
`Main → Infra/Presentation → Data → Domain`. Domain nunca referencia ninguém.

```bash
# Data depende de Domain (usa AccountModel, Authentication)
dotnet add src/RunnerAi.Data reference src/RunnerAi.Domain

# Infra depende de Data (implementa os protocolos) e Domain (usa entidades)
dotnet add src/RunnerAi.Infra reference src/RunnerAi.Data
dotnet add src/RunnerAi.Infra reference src/RunnerAi.Domain

# Presentation depende de Domain (usa interfaces de use case)
dotnet add src/RunnerAi.Presentation reference src/RunnerAi.Domain

# Validation depende de Presentation (usa interface Validation)
dotnet add src/RunnerAi.Validation reference src/RunnerAi.Presentation

# Main (composicao) depende de tudo
dotnet add src/RunnerAi.Main reference src/RunnerAi.Domain
dotnet add src/RunnerAi.Main reference src/RunnerAi.Data
dotnet add src/RunnerAi.Main reference src/RunnerAi.Infra
dotnet add src/RunnerAi.Main reference src/RunnerAi.Presentation
dotnet add src/RunnerAi.Main reference src/RunnerAi.Validation

# Testes
dotnet add tests/RunnerAi.Data.Tests reference src/RunnerAi.Data
dotnet add tests/RunnerAi.Data.Tests reference src/RunnerAi.Domain
dotnet add tests/RunnerAi.Infra.Tests reference src/RunnerAi.Infra
dotnet add tests/RunnerAi.Infra.Tests reference src/RunnerAi.Data
dotnet add tests/RunnerAi.Infra.Tests reference src/RunnerAi.Domain
dotnet add tests/RunnerAi.Presentation.Tests reference src/RunnerAi.Presentation
dotnet add tests/RunnerAi.Presentation.Tests reference src/RunnerAi.Domain
```

### Instalar pacotes NuGet

```bash
# Infra: EF Core, BCrypt, JWT
dotnet add src/RunnerAi.Infra package Microsoft.EntityFrameworkCore
dotnet add src/RunnerAi.Infra package Npgsql.EntityFrameworkCore.PostgreSQL
dotnet add src/RunnerAi.Infra package BCrypt.Net-Next
dotnet add src/RunnerAi.Infra package System.IdentityModel.Tokens.Jwt
dotnet add src/RunnerAi.Infra package Microsoft.IdentityModel.Tokens

# Main: EF Design (migrations), JWT Bearer auth
dotnet add src/RunnerAi.Main package Microsoft.EntityFrameworkCore.Design
dotnet add src/RunnerAi.Main package Microsoft.AspNetCore.Authentication.JwtBearer

# Testes: mocking e assertions
dotnet add tests/RunnerAi.Data.Tests package NSubstitute
dotnet add tests/RunnerAi.Data.Tests package FluentAssertions
dotnet add tests/RunnerAi.Infra.Tests package NSubstitute
dotnet add tests/RunnerAi.Infra.Tests package FluentAssertions
dotnet add tests/RunnerAi.Presentation.Tests package NSubstitute
dotnet add tests/RunnerAi.Presentation.Tests package FluentAssertions
```

**Conceito .NET:** Em Node voce instala pacotes com `npm install`. Em .NET
voce usa `dotnet add package`. Packages ficam no NuGet (equivalente ao npm registry).
References entre projetos (`dotnet add reference`) sao a forma do .NET
dizer "este projeto pode usar classes daquele outro".

**Ao terminar, sua estrutura fica:**
```
runner-ai-dotnet/
  RunnerAi.sln
  src/
    RunnerAi.Domain/
    RunnerAi.Data/
    RunnerAi.Infra/
    RunnerAi.Presentation/
    RunnerAi.Validation/
    RunnerAi.Main/
  tests/
    RunnerAi.Data.Tests/
    RunnerAi.Infra.Tests/
    RunnerAi.Presentation.Tests/
```

Limpe os arquivos de exemplo (Class1.cs, WeatherForecast*, etc) que o `dotnet new` gera automaticamente.

---

## Passo 1 — Domain: Entidade e Contrato

### Arquivo original: `domain/models/account/account.ts`

```typescript
export type AccountModel = {
  id: string;
  name: string;
  email: string;
  password: string;
};
```

### Equivalente .NET: `RunnerAi.Domain/Models/AccountModel.cs`

```csharp
namespace RunnerAi.Domain.Models;

public class AccountModel
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
```

**O que mudou:**
- `type` do TS vira `class` em C#. Tipos do TS sao apenas shapes; em C# usamos classes concretas.
- Propriedades precisam de `get; set;`. Nao existe "campo publico implícito" como no TS.
- `string.Empty` como default evita nulls (mesma ideia de inicializar string no TS).

---

### Arquivo original: `domain/use-cases/authentication/authentication.ts`

```typescript
export type AuthenticationParams = {
  email: string;
  password: string;
};
export interface Authentication {
  auth(params: AuthenticationParams): Promise<string | null>;
}
```

### Equivalente .NET: `RunnerAi.Domain/UseCases/Authentication/IAuthentication.cs`

```csharp
namespace RunnerAi.Domain.UseCases.Authentication;

public class AuthenticationParams
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public interface IAuthentication
{
    Task<string?> Auth(AuthenticationParams parameters);
}
```

**O que mudou:**
- `interface` no TS → `interface` no C# com prefixo `I` (convencao .NET).
- `Promise<string | null>` → `Task<string?>`. `Task` é o equivalente de `Promise`.
  `string?` indica que pode ser null (nullable reference type).
- Metodos em C# usam PascalCase: `auth` → `Auth`.

---

## Passo 2 — Data: Protocolos de Criptografia

### Arquivo original: `data/protocols/criptography/encrypt.ts`

```typescript
export interface Encrypter {
  encrypt(value: string): Promise<string>;
}
```

### Equivalente .NET: `RunnerAi.Data/Protocols/Criptography/IEncrypter.cs`

```csharp
namespace RunnerAi.Data.Protocols.Criptography;

public interface IEncrypter
{
    Task<string> Encrypt(string value);
}
```

---

### Arquivo original: `data/protocols/criptography/hash-comparer.ts`

```typescript
export interface HashComparer {
  compare(value: string, hash: string): Promise<boolean>;
}
```

### Equivalente .NET: `RunnerAi.Data/Protocols/Criptography/IHashComparer.cs`

```csharp
namespace RunnerAi.Data.Protocols.Criptography;

public interface IHashComparer
{
    Task<bool> Compare(string value, string hash);
}
```

**Padrao:** Toda interface da camada `data/protocols` segue o mesmo mapeamento:
`Promise<T>` → `Task<T>`, nome com prefixo `I`, PascalCase nos metodos.

---

## Passo 3 — Data: Protocolo de Repositorio

### Arquivo original: `data/protocols/db/account/load-account-by-email-repository.ts`

```typescript
import { AccountModel } from "../../../../domain/models/account/account";

export interface LoadAccountByEmailRepository {
  loadByEmail(email: string): Promise<AccountModel | null>;
}
```

### Equivalente .NET: `RunnerAi.Data/Protocols/Db/Account/ILoadAccountByEmailRepository.cs`

```csharp
using RunnerAi.Domain.Models;

namespace RunnerAi.Data.Protocols.Db.Account;

public interface ILoadAccountByEmailRepository
{
    Task<AccountModel?> LoadByEmail(string email);
}
```

**O que mudou:**
- `import` do TS → `using` do C#.
- `AccountModel | null` → `AccountModel?` (tipo nullable).
- O `namespace` reproduz a hierarquia de pastas, exatamente como o import path do TS.

---

## Passo 4 — Data: Use Case DbAuthentication

### Arquivo original: `data/use-cases/authentication/db-authentication.ts`

```typescript
import { Authentication, AuthenticationParams }
  from "../../../domain/use-cases/authentication/authentication";
import { Encrypter } from "../../protocols/criptography/encrypt";
import { HashComparer } from "../../protocols/criptography/hash-comparer";
import { LoadAccountByEmailRepository }
  from "../../protocols/db/account/load-account-by-email-repository";

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
```

### Equivalente .NET: `RunnerAi.Data/UseCases/Authentication/DbAuthentication.cs`

```csharp
using RunnerAi.Data.Protocols.Criptography;
using RunnerAi.Data.Protocols.Db.Account;
using RunnerAi.Domain.UseCases.Authentication;

namespace RunnerAi.Data.UseCases.Authentication;

public class DbAuthentication : IAuthentication
{
    private readonly ILoadAccountByEmailRepository _loadAccountByEmailRepository;
    private readonly IHashComparer _hashComparer;
    private readonly IEncrypter _encrypter;

    public DbAuthentication(
        ILoadAccountByEmailRepository loadAccountByEmailRepository,
        IHashComparer hashComparer,
        IEncrypter encrypter)
    {
        _loadAccountByEmailRepository = loadAccountByEmailRepository;
        _hashComparer = hashComparer;
        _encrypter = encrypter;
    }

    public async Task<string?> Auth(AuthenticationParams parameters)
    {
        var account = await _loadAccountByEmailRepository.LoadByEmail(parameters.Email);
        if (account is null) return null;

        var isValid = await _hashComparer.Compare(parameters.Password, account.Password);
        if (!isValid) return null;

        return await _encrypter.Encrypt(account.Id);
    }
}
```

**Conceitos .NET importantes aqui:**
- `implements` do TS → `: IAuthentication` (heranca/implementacao com `:`).
- `private readonly` no construtor do TS → campo `private readonly` + construtor separado no C#.
  Em TS, `private readonly x: Type` no construtor ja cria o campo. Em C# voce precisa declarar o campo
  e atribuir no construtor explicitamente.
- `is null` ao inves de `!account`: pattern matching do C# (mais idiomatico que `== null`).
- `async/await` funciona igual; troque `Promise` por `Task`.
- Prefixo `_` em campos privados é convencao .NET (como nao ter prefixo no TS).

---

## Passo 5 — Infra: BcryptAdapter

### Arquivo original: `infra/criptography/bcrypter/bcrypter-adapter.ts`

```typescript
import { HashComparer } from "../../../data/protocols/criptography/hash-comparer";
import bcrypt from "bcrypt";

export class BcrypterAdapter implements HashComparer {
  constructor(private readonly salt: number) {}
  async compare(value: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(value, hash);
  }
}
```

### Equivalente .NET: `RunnerAi.Infra/Criptography/Bcrypter/BcryptAdapter.cs`

```csharp
using RunnerAi.Data.Protocols.Criptography;

namespace RunnerAi.Infra.Criptography.Bcrypter;

public class BcryptAdapter : IHashComparer
{
    public Task<bool> Compare(string value, string hash)
    {
        var result = BCrypt.Net.BCrypt.Verify(value, hash);
        return Task.FromResult(result);
    }
}
```

**O que mudou:**
- `npm install bcrypt` → `dotnet add package BCrypt.Net-Next`.
- `bcrypt.compare(value, hash)` → `BCrypt.Net.BCrypt.Verify(value, hash)`.
  A API do BCrypt.Net e sincrona, entao envolvemos com `Task.FromResult`.
- O salt nao precisa ser passado no `compare`, so no `HashPassword` (nao usado aqui no login).

---

## Passo 6 — Infra: JwtAdapter

### Arquivo original: `infra/criptography/jwt-adapter/jwt-adapter.ts`

```typescript
import { Encrypter } from "../../../data/protocols/criptography/encrypt";
import jwt from "jsonwebtoken";

export class JwtAdapter implements Encrypter {
  constructor(private readonly secret: string) {}
  async encrypt(value: string): Promise<string> {
    const token = await jwt.sign(value, this.secret);
    return token;
  }
}
```

### Equivalente .NET: `RunnerAi.Infra/Criptography/JwtAdapter/JwtAdapter.cs`

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using RunnerAi.Data.Protocols.Criptography;

namespace RunnerAi.Infra.Criptography.JwtAdapter;

public class JwtAdapter : IEncrypter
{
    private readonly string _secret;

    public JwtAdapter(string secret)
    {
        _secret = secret;
    }

    public Task<string> Encrypt(string value)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, value)
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: credentials
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return Task.FromResult(tokenString);
    }
}
```

**O que mudou:**
- `npm install jsonwebtoken` → pacote nativo `System.IdentityModel.Tokens.Jwt`.
- `jwt.sign(value, secret)` vira mais verboso no .NET: precisa criar `SymmetricSecurityKey`,
  `SigningCredentials`, `Claims`, `JwtSecurityToken`, depois `WriteToken`.
  Essa é uma diferença de filosofia: a lib JS e minimalista, a lib .NET e explicita.
- `jwt.sign` do Node aceita qualquer payload; no .NET voce trabalha com `Claims`
  (pares chave-valor padronizados). `Sub` (subject) e o claim padrao para ID.

---

## Passo 7 — Infra: Repositorio + DbContext

### Arquivo original: `infra/db/prisma/helpers/prisma-helpers.ts`

```typescript
import { PrismaClient } from "../../../../generated/prisma/client";

export const PrismaHelper = {
  client: new PrismaClient(),
  async connect(): Promise<void> { await this.client.$connect(); },
  async disconnect(): Promise<void> { await this.client.$disconnect(); },
};
```

### Equivalente .NET: `RunnerAi.Infra/Db/EfCore/Helpers/AppDbContext.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using RunnerAi.Domain.Models;

namespace RunnerAi.Infra.Db.EfCore.Helpers;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options) { }

    public DbSet<AccountModel> Accounts => Set<AccountModel>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AccountModel>(entity =>
        {
            entity.ToTable("accounts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(36);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Email).IsRequired();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Password).IsRequired();
        });
    }
}
```

**Equivalencia Prisma → EF Core:**
- `PrismaClient` → `DbContext` (conexao e queries).
- `schema.prisma` (modelo declarativo) → `OnModelCreating` (configuracao fluente)
  ou Data Annotations. Aqui usamos a API fluente que e mais parecida com Prisma.
- `prisma migrate dev` → `dotnet ef migrations add` + `dotnet ef database update`.
- `PrismaClient.account.findUnique(...)` → `DbContext.Accounts.FirstOrDefaultAsync(...)`.
- `@@map("accounts")` do Prisma → `.ToTable("accounts")` no EF Core.

---

### Arquivo original: `data/protocols/db/prisma/account/account-prisma-repository.ts`

```typescript
import { PrismaHelper } from "../../../../../infra/db/prisma/helpers/prisma-helpers";
import { LoadAccountByEmailRepository }
  from "../../account/load-account-by-email-repository";

export class AccountPrismaRepository implements LoadAccountByEmailRepository {
  async loadByEmail(email: string) {
    const account = await PrismaHelper.client.account.findUnique({
      where: { email },
    });
    if (!account) return null;
    return account;
  }
}
```

### Equivalente .NET: `RunnerAi.Infra/Db/EfCore/Account/AccountEfRepository.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using RunnerAi.Data.Protocols.Db.Account;
using RunnerAi.Domain.Models;
using RunnerAi.Infra.Db.EfCore.Helpers;

namespace RunnerAi.Infra.Db.EfCore.Account;

public class AccountEfRepository : ILoadAccountByEmailRepository
{
    private readonly AppDbContext _context;

    public AccountEfRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<AccountModel?> LoadByEmail(string email)
    {
        return await _context.Accounts
            .FirstOrDefaultAsync(a => a.Email == email);
    }
}
```

**O que mudou:**
- `PrismaHelper.client.account.findUnique({ where: { email } })` →
  `_context.Accounts.FirstOrDefaultAsync(a => a.Email == email)`.
- O `DbContext` e injetado pelo construtor (DI nativo .NET), ao inves de usar singleton como o `PrismaHelper`.
- `FirstOrDefaultAsync` retorna `null` se nao encontrar, exatamente como `findUnique` do Prisma.

---

## Passo 8 — Presentation: Erros Customizados

### Arquivos originais

```typescript
// missing-param-error.ts
export class MissingParamError extends Error {
  constructor(paramName: string) {
    super(`Missing param: ${paramName}`);
    this.name = "MissingParamError";
  }
}

// invalid-param-error.ts
export class InvalidParamError extends Error {
  constructor(paramName: string) {
    super(`Invalid param: ${paramName}`);
    this.name = "InvalidParamError";
  }
}

// unauthorizedError-error.ts
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

// server-error.ts
export class ServerError extends Error {
  constructor(stack?: string) {
    super("Internal Server Error");
    this.name = "ServerError";
    this.stack = stack;
  }
}
```

### Equivalentes .NET: `RunnerAi.Presentation/Errors/`

```csharp
// MissingParamError.cs
namespace RunnerAi.Presentation.Errors;

public class MissingParamError : Exception
{
    public MissingParamError(string paramName)
        : base($"Missing param: {paramName}") { }
}

// InvalidParamError.cs
namespace RunnerAi.Presentation.Errors;

public class InvalidParamError : Exception
{
    public InvalidParamError(string paramName)
        : base($"Invalid param: {paramName}") { }
}

// UnauthorizedError.cs
namespace RunnerAi.Presentation.Errors;

public class UnauthorizedError : Exception
{
    public UnauthorizedError()
        : base("Unauthorized") { }
}

// ServerError.cs
namespace RunnerAi.Presentation.Errors;

public class ServerError : Exception
{
    public ServerError(string? stack = null)
        : base("Internal Server Error")
    {
        if (stack is not null)
            Data["OriginalStack"] = stack;
    }
}
```

**O que mudou:**
- `extends Error` → `: Exception`. Em C# a classe base de erros e `Exception`.
- `super(message)` → `: base(message)` (chamar construtor da classe pai).
- Template string `${var}` → string interpolada `$"{var}"` (mesmo conceito, sintaxe diferente).
- Nao existe `this.stack = stack` direto; usamos `Data` (dicionario de metadados da Exception).

---

## Passo 9 — Presentation: Protocolos HTTP

### Arquivo original: `presentation/protocols/index.ts`

```typescript
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
```

### Equivalentes .NET: `RunnerAi.Presentation/Protocols/`

```csharp
// IValidation.cs
namespace RunnerAi.Presentation.Protocols;

public interface IValidation
{
    Exception? Validate(object input);
}

// HttpRequest.cs
namespace RunnerAi.Presentation.Protocols;

public class HttpRequest
{
    public object? Body { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public Dictionary<string, string>? Params { get; set; }
    public string? AccountId { get; set; }
}

// HttpResponse.cs
namespace RunnerAi.Presentation.Protocols;

public class HttpResponse
{
    public int StatusCode { get; set; }
    public object? Body { get; set; }
}

// IController.cs
namespace RunnerAi.Presentation.Protocols;

public interface IController
{
    Task<HttpResponse> Handle(HttpRequest httpRequest);
}
```

**O que mudou:**
- `any` do TS → `object` no C#. Ambos representam "qualquer tipo", mas em C# `object` e o tipo
  base de tudo. Em TS `any` desliga a checagem de tipo, em C# `object` mantém type safety
  (voce precisara de cast para usar).
- `Error | undefined | null` → `Exception?`. O `?` cobre tanto null quanto "sem valor".
- Propriedades opcionais `body?: any` → `Body { get; set; }` com tipo nullable `object?`.

---

## Passo 10 — Presentation: HTTP Helpers

### Arquivo original: `presentation/helpers/http/http-helpers.ts`

```typescript
export const badRequest = (error: Error): HttpResponse => ({
  statusCode: 400, body: error,
});
export const unauthorized = (): HttpResponse => ({
  statusCode: 401, body: new UnauthorizedError(),
});
export const success = (data: any): HttpResponse => ({
  statusCode: 200, body: data,
});
export const serverError = (error: Error): HttpResponse => ({
  statusCode: 500, body: new ServerError(error.stack),
});
```

### Equivalente .NET: `RunnerAi.Presentation/Helpers/Http/HttpHelper.cs`

```csharp
using RunnerAi.Presentation.Errors;
using RunnerAi.Presentation.Protocols;

namespace RunnerAi.Presentation.Helpers.Http;

public static class HttpHelper
{
    public static HttpResponse BadRequest(Exception error) =>
        new() { StatusCode = 400, Body = error };

    public static HttpResponse Unauthorized() =>
        new() { StatusCode = 401, Body = new UnauthorizedError() };

    public static HttpResponse Success(object data) =>
        new() { StatusCode = 200, Body = data };

    public static HttpResponse ServerError(Exception error) =>
        new() { StatusCode = 500, Body = new ServerError(error.StackTrace) };
}
```

**O que mudou:**
- Funcoes standalone do TS (`export const f = ...`) → metodos `static` em uma `static class`.
  C# nao tem funcoes soltas; tudo precisa estar dentro de uma classe.
- Arrow function `() => ({ ... })` → expression-bodied member `=> new() { ... }`.
- `error.stack` → `error.StackTrace` (propriedade equivalente no .NET).

---

## Passo 11 — Validation: Validators

### Arquivo original: `validation/validators/required-fields/required-fields.ts`

```typescript
import { MissingParamError } from "../../../presentation/erros/missing-param-error";
import { Validation } from "../../../presentation/protocols";

export class RequiredFields implements Validation {
  constructor(private readonly fieldName: string) {}
  validator(input: any): Error | null {
    if (!input[this.fieldName]) return new MissingParamError(this.fieldName);
    return null;
  }
}
```

### Equivalente .NET: `RunnerAi.Validation/Validators/RequiredFieldsValidation.cs`

```csharp
using RunnerAi.Presentation.Errors;
using RunnerAi.Presentation.Protocols;

namespace RunnerAi.Validation.Validators;

public class RequiredFieldsValidation : IValidation
{
    private readonly string _fieldName;

    public RequiredFieldsValidation(string fieldName)
    {
        _fieldName = fieldName;
    }

    public Exception? Validate(object input)
    {
        var dict = input as IDictionary<string, object>;
        if (dict is null || !dict.ContainsKey(_fieldName) || dict[_fieldName] is null)
            return new MissingParamError(_fieldName);

        var value = dict[_fieldName]?.ToString();
        if (string.IsNullOrWhiteSpace(value))
            return new MissingParamError(_fieldName);

        return null;
    }
}
```

**O que mudou:**
- `input[this.fieldName]` no TS acessa qualquer propriedade de um objeto dinamicamente.
  Em C# precisamos de `IDictionary<string, object>` ou reflexao. Dicionario e mais simples.
- `!input[field]` (falsy check do JS) → checagem explicita de `null`, `ContainsKey`, e `IsNullOrWhiteSpace`.
  JS tem truthy/falsy implicito; C# exige checagem explicita.

---

### Arquivo original: `validation/validators/email-validation/email-validation.ts`

```typescript
export interface EmailValidator {
  isValid(email: string): boolean;
}
export class EmailValidation implements Validation {
  constructor(
    private readonly fieldName: string,
    private readonly emailValidator: EmailValidator,
  ) {}
  validator(input: any): Error | null {
    const isValid = this.emailValidator.isValid(input[this.fieldName]);
    if (!isValid) return new InvalidParamError(this.fieldName);
    return null;
  }
}
```

### Equivalente .NET: `RunnerAi.Validation/Validators/EmailValidation.cs`

```csharp
using System.Net.Mail;
using RunnerAi.Presentation.Errors;
using RunnerAi.Presentation.Protocols;

namespace RunnerAi.Validation.Validators;

public class EmailValidation : IValidation
{
    private readonly string _fieldName;

    public EmailValidation(string fieldName)
    {
        _fieldName = fieldName;
    }

    public Exception? Validate(object input)
    {
        var dict = input as IDictionary<string, object>;
        var email = dict?[_fieldName]?.ToString();

        if (email is null) return new InvalidParamError(_fieldName);

        try
        {
            _ = new MailAddress(email);
            return null;
        }
        catch
        {
            return new InvalidParamError(_fieldName);
        }
    }
}
```

**O que mudou:**
- No TS, a validacao de email e injetada via `EmailValidator` (adapter para a lib `validator`).
  No .NET nao precisamos de lib externa: `System.Net.Mail.MailAddress` ja faz a validacao.
  Se o email for invalido, o construtor lanca excecao. Isso simplifica e elimina o adapter.
- A interface `EmailValidator` do TS some completamente no .NET — a stdlib resolve.

---

### Arquivo original: `validation/validators/validation-composite/validation-composite.ts`

```typescript
export class ValidationComposite implements Validation {
  constructor(private readonly validations: Validation[]) {}
  validator(input: any): Error | undefined | null {
    for (const validation of this.validations) {
      const error = validation.validator(input);
      if (error) return error;
    }
  }
}
```

### Equivalente .NET: `RunnerAi.Validation/Validators/ValidationComposite.cs`

```csharp
using RunnerAi.Presentation.Protocols;

namespace RunnerAi.Validation.Validators;

public class ValidationComposite : IValidation
{
    private readonly IEnumerable<IValidation> _validations;

    public ValidationComposite(IEnumerable<IValidation> validations)
    {
        _validations = validations;
    }

    public Exception? Validate(object input)
    {
        foreach (var validation in _validations)
        {
            var error = validation.Validate(input);
            if (error is not null) return error;
        }
        return null;
    }
}
```

**O que mudou:**
- `Validation[]` → `IEnumerable<IValidation>`. Em .NET preferimos a interface `IEnumerable`
  ao inves do array concreto (principio de depender de abstracoes).
- `for...of` → `foreach`. Mesma semantica.
- Retorno implicito `undefined` no final do metodo TS → retorno explicito `return null` no C#.

---

## Passo 12 — Presentation: LoginController

### Arquivo original: `presentation/controllers/login/login-controllers.ts`

```typescript
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
```

### Equivalente .NET: `RunnerAi.Presentation/Controllers/Login/LoginController.cs`

```csharp
using RunnerAi.Domain.UseCases.Authentication;
using RunnerAi.Presentation.Helpers.Http;
using RunnerAi.Presentation.Protocols;

namespace RunnerAi.Presentation.Controllers.Login;

public class LoginController : IController
{
    private readonly IValidation _validation;
    private readonly IAuthentication _authentication;

    public LoginController(IValidation validation, IAuthentication authentication)
    {
        _validation = validation;
        _authentication = authentication;
    }

    public async Task<HttpResponse> Handle(HttpRequest httpRequest)
    {
        try
        {
            var error = _validation.Validate(httpRequest.Body!);
            if (error is not null) return HttpHelper.BadRequest(error);

            var authParams = httpRequest.Body as AuthenticationParams;
            var accessToken = await _authentication.Auth(authParams!);

            if (accessToken is null) return HttpHelper.Unauthorized();

            return HttpHelper.Success(accessToken);
        }
        catch (Exception ex)
        {
            return HttpHelper.ServerError(ex);
        }
    }
}
```

**O que mudou:**
- A estrutura e identica: construtor com DI, validate, auth, try/catch.
- `httpRequest.body` (dinamico no TS) → precisa de cast `as AuthenticationParams` no C#.
- `catch (error)` → `catch (Exception ex)`. C# exige tipar a variavel do catch.
- Funcoes helpers `badRequest()` → `HttpHelper.BadRequest()` (metodos estaticos).

---

## Passo 13 — Main: Factories e Composicao

### Arquivos originais

No TS a composicao e feita manualmente com factories:

```typescript
// login-controller-factory.ts
export const makeLoginController = (): LoginController => {
  return new LoginController(makeLoginValidation(), makeDbAuthentication());
};

// login-validation-factory.ts
export const makeLoginValidation = (): ValidationComposite => {
  return new ValidationComposite([
    new RequiredFields("email"),
    new RequiredFields("password"),
    new EmailValidation("email", new EmailValidatorAdapter()),
  ]);
};

// db-authentication-factory.ts
export const makeDbAuthentication = (): DbAuthentication => {
  return new DbAuthentication(
    new AccountPrismaRepository(),
    new BcrypterAdapter(12),
    new JwtAdapter(env.jwtSecret),
  );
};
```

### Equivalente .NET: DI nativo no `Program.cs`

Em .NET, o container de DI do framework substitui todas as factories.
Nao precisamos criar factories manuais — o `Program.cs` faz esse papel.

`RunnerAi.Main/Program.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using RunnerAi.Data.Protocols.Criptography;
using RunnerAi.Data.Protocols.Db.Account;
using RunnerAi.Data.UseCases.Authentication;
using RunnerAi.Domain.UseCases.Authentication;
using RunnerAi.Infra.Criptography.Bcrypter;
using RunnerAi.Infra.Criptography.JwtAdapter;
using RunnerAi.Infra.Db.EfCore.Account;
using RunnerAi.Infra.Db.EfCore.Helpers;
using RunnerAi.Presentation.Protocols;
using RunnerAi.Validation.Validators;

var builder = WebApplication.CreateBuilder(args);

// --- Equivalente ao PrismaHelper.connect() ---
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// --- Equivalente ao makeDbAuthentication() ---
// Cada "bind" abaixo e uma linha da factory:
//   new AccountPrismaRepository()  →  bind interface → implementacao
//   new BcrypterAdapter(12)        →  idem
//   new JwtAdapter(env.jwtSecret)  →  idem
builder.Services.AddScoped<ILoadAccountByEmailRepository, AccountEfRepository>();
builder.Services.AddScoped<IHashComparer, BcryptAdapter>();
builder.Services.AddScoped<IEncrypter>(provider =>
{
    var config = provider.GetRequiredService<IConfiguration>();
    var secret = config["Jwt:Secret"] ?? "default_secret";
    return new JwtAdapter(secret);
});
builder.Services.AddScoped<IAuthentication, DbAuthentication>();

// --- Equivalente ao makeLoginValidation() ---
// Em vez de new RequiredFields("email"), registramos os validadores
// e compomos o ValidationComposite
builder.Services.AddScoped<IValidation>(provider =>
{
    var validations = new IValidation[]
    {
        new RequiredFieldsValidation("email"),
        new RequiredFieldsValidation("password"),
        new EmailValidation("email"),
    };
    return new ValidationComposite(validations);
});

builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
```

**Conceito fundamental: DI Container**
- No TS deste projeto, a composicao e manual: factories criam objetos com `new`.
- No .NET, o framework tem um container de DI embutido.
  `builder.Services.AddScoped<IInterface, ClasseConcreta>()` diz:
  "quando alguem pedir `IInterface`, crie uma `ClasseConcreta`".
- `AddScoped` = uma instancia por request HTTP (equivalente a criar `new` a cada chamada no Node).
- O container resolve a arvore de dependencias automaticamente. Se `DbAuthentication`
  precisa de `IHashComparer` no construtor, o container injeta o `BcryptAdapter` registrado.

---

## Passo 14 — Main: Rotas e Server

### Arquivos originais

```typescript
// login-routes.ts — registra rota manualmente
export default (router: Router): void => {
  router.post("/login", adaptRoute(makeLoginController()));
};

// express-route-adapter.ts — converte Controller → handler Express
export const adaptRoute = (controller: Controller) => {
  return async (req: Request, res: Response): Promise<void> => {
    const httpRequest = { body: req.body };
    const httpResponse = await controller.handle(httpRequest);
    if (httpResponse.statusCode >= 200 && httpResponse.statusCode <= 299) {
      res.status(httpResponse.statusCode).json(httpResponse.body);
      return;
    }
    res.status(httpResponse.statusCode).json({ error: httpResponse.body.message });
  };
};

// server.ts — ponto de entrada
PrismaHelper.connect().then(async () => {
  const app = await setupApp();
  app.listen(env.port, () => { console.log(`Server running at PORT: ${env.port}`); });
});
```

### Equivalente .NET

No .NET com ASP.NET Core, **nao existem esses tres conceitos separados**:

1. **Rotas:** Sao declaradas com atributos `[HttpPost("login")]` direto no controller.
   Nao precisa de arquivo de rotas nem de `adaptRoute`.

2. **Adapter Express → Controller interno:** Nao precisa. O ASP.NET Core ja converte
   o request HTTP em parametros do metodo e serializa a resposta automaticamente.

3. **Server:** O `Program.cs` (que ja escrevemos no passo 13) ja e o server.

Portanto, o controller na **camada Main** (o que o usuario ve) fica assim:

`RunnerAi.Main/Controllers/LoginApiController.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using RunnerAi.Domain.UseCases.Authentication;
using RunnerAi.Presentation.Protocols;

namespace RunnerAi.Main.Controllers;

[ApiController]
[Route("api")]
public class LoginApiController : ControllerBase
{
    private readonly IValidation _validation;
    private readonly IAuthentication _authentication;

    public LoginApiController(IValidation validation, IAuthentication authentication)
    {
        _validation = validation;
        _authentication = authentication;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var input = new Dictionary<string, object>
        {
            { "email", request.Email },
            { "password", request.Password }
        };

        var error = _validation.Validate(input);
        if (error is not null)
            return BadRequest(new { error = error.Message });

        var token = await _authentication.Auth(
            new AuthenticationParams { Email = request.Email, Password = request.Password });

        if (token is null)
            return Unauthorized(new { error = "Unauthorized" });

        return Ok(new { accessToken = token });
    }
}

public record LoginRequest(string Email, string Password);
```

**Mapeamento direto:**
| TS (Express) | .NET (ASP.NET Core) |
|---|---|
| `router.post("/login", ...)` | `[HttpPost("login")]` |
| `adaptRoute(controller)` | Nao precisa (framework faz) |
| `req.body` | `[FromBody] LoginRequest` (tipado!) |
| `res.status(200).json(data)` | `return Ok(data)` |
| `res.status(400).json(...)` | `return BadRequest(...)` |
| `res.status(401).json(...)` | `return Unauthorized(...)` |
| `app.listen(port)` | `app.Run()` (no Program.cs) |
| `PrismaHelper.connect()` | `AddDbContext<>()` (no Program.cs) |

---

## Passo 15 — Testes

### Arquivo original: `data/use-cases/authentication/db-authentication.spec.ts`

```typescript
const makeLoadByAccountEmailRepository = (): LoadAccountByEmailRepository => {
  class LoadAccountByEmailRepositoryStub implements LoadAccountByEmailRepository {
    async loadByEmail(email: string) {
      return { id: "any_id", name: "valid_name", email: "any_email@mail.com", password: "hashed_password" };
    }
  }
  return new LoadAccountByEmailRepositoryStub();
};

const makeHashComparerRepository = (): HashComparer => {
  class HashComparerRepositoryStub implements HashComparer {
    async compare(value: string, hash: string) { return true; }
  }
  return new HashComparerRepositoryStub();
};

const makeEncrypterRepository = (): Encrypter => {
  class HashComparerRepositoryStub implements Encrypter {
    async encrypt(value: string) { return "any_token"; }
  }
  return new HashComparerRepositoryStub();
};

describe("DbAuthentication", () => {
  test("should return null if LoadAccountByEmailRepository returns null", async () => {
    const { sut, loadAccuntByEmailRepositoryStub } = makeSut();
    jest.spyOn(loadAccuntByEmailRepositoryStub, "loadByEmail").mockResolvedValueOnce(null);
    const httpResponse = await sut.auth({ email: "any_email@mail.com", password: "any_password" });
    expect(httpResponse).toBeNull();
  });
  // ... mais testes
});
```

### Equivalente .NET: `RunnerAi.Data.Tests/UseCases/Authentication/DbAuthenticationTests.cs`

```csharp
using FluentAssertions;
using NSubstitute;
using RunnerAi.Data.Protocols.Criptography;
using RunnerAi.Data.Protocols.Db.Account;
using RunnerAi.Data.UseCases.Authentication;
using RunnerAi.Domain.Models;
using RunnerAi.Domain.UseCases.Authentication;

namespace RunnerAi.Data.Tests.UseCases.Authentication;

public class DbAuthenticationTests
{
    // --- Setup (equivalente ao makeSut) ---
    private readonly ILoadAccountByEmailRepository _loadAccountRepo;
    private readonly IHashComparer _hashComparer;
    private readonly IEncrypter _encrypter;
    private readonly DbAuthentication _sut;

    public DbAuthenticationTests()
    {
        _loadAccountRepo = Substitute.For<ILoadAccountByEmailRepository>();
        _hashComparer = Substitute.For<IHashComparer>();
        _encrypter = Substitute.For<IEncrypter>();

        // Comportamento default dos mocks (equivalente aos stubs do TS)
        _loadAccountRepo.LoadByEmail(Arg.Any<string>())
            .Returns(new AccountModel
            {
                Id = "any_id",
                Name = "valid_name",
                Email = "any_email@mail.com",
                Password = "hashed_password"
            });
        _hashComparer.Compare(Arg.Any<string>(), Arg.Any<string>())
            .Returns(true);
        _encrypter.Encrypt(Arg.Any<string>())
            .Returns("any_token");

        _sut = new DbAuthentication(_loadAccountRepo, _hashComparer, _encrypter);
    }

    // --- Testes ---

    [Fact] // equivalente ao test() do Jest
    public async Task Should_Call_LoadByEmail_With_Correct_Email()
    {
        await _sut.Auth(new AuthenticationParams
        {
            Email = "any_email@mail.com",
            Password = "any_password"
        });

        // equivalente ao expect(spy).toHaveBeenCalledWith("any_email@mail.com")
        await _loadAccountRepo.Received(1).LoadByEmail("any_email@mail.com");
    }

    [Fact]
    public async Task Should_Return_Null_If_LoadByEmail_Returns_Null()
    {
        _loadAccountRepo.LoadByEmail(Arg.Any<string>())
            .Returns((AccountModel?)null); // equivalente ao mockResolvedValueOnce(null)

        var result = await _sut.Auth(new AuthenticationParams
        {
            Email = "any_email@mail.com",
            Password = "any_password"
        });

        result.Should().BeNull(); // equivalente ao expect(result).toBeNull()
    }

    [Fact]
    public async Task Should_Call_HashComparer_With_Correct_Values()
    {
        await _sut.Auth(new AuthenticationParams
        {
            Email = "any_email@mail.com",
            Password = "any_password"
        });

        await _hashComparer.Received(1).Compare("any_password", "hashed_password");
    }

    [Fact]
    public async Task Should_Return_Null_If_HashComparer_Returns_False()
    {
        _hashComparer.Compare(Arg.Any<string>(), Arg.Any<string>())
            .Returns(false);

        var result = await _sut.Auth(new AuthenticationParams
        {
            Email = "any_email@mail.com",
            Password = "any_password"
        });

        result.Should().BeNull();
    }

    [Fact]
    public async Task Should_Call_Encrypter_With_Correct_Id()
    {
        await _sut.Auth(new AuthenticationParams
        {
            Email = "any_email@mail.com",
            Password = "any_password"
        });

        await _encrypter.Received(1).Encrypt("any_id");
    }

    [Fact]
    public async Task Should_Return_Token_On_Success()
    {
        var result = await _sut.Auth(new AuthenticationParams
        {
            Email = "any_email@mail.com",
            Password = "any_password"
        });

        result.Should().Be("any_token");
    }
}
```

**Mapeamento de testes Jest → xUnit:**

| Jest (TS) | xUnit + NSubstitute + FluentAssertions (C#) |
|---|---|
| `describe("X", () => {...})` | `public class XTests { }` |
| `test("should ...", async () => {...})` | `[Fact] public async Task Should_...()` |
| `jest.fn()` / class stub manual | `Substitute.For<IInterface>()` |
| `jest.spyOn(obj, "method").mockResolvedValueOnce(val)` | `obj.Method(Arg.Any<>()).Returns(val)` |
| `expect(spy).toHaveBeenCalledWith(val)` | `await obj.Received(1).Method(val)` |
| `expect(result).toBeNull()` | `result.Should().BeNull()` |
| `expect(result).toBe("x")` | `result.Should().Be("x")` |
| `expect(result).toBeTruthy()` | `result.Should().NotBeNull()` |

**Rodar testes:**

```bash
# Equivalente a npm test
dotnet test

# Equivalente a npm run test:unit -- --watch (nao tem watch nativo, mas pode usar dotnet-watch)
dotnet watch test --project tests/RunnerAi.Data.Tests
```

---

## Passo 16 — Rodar

### Configurar connection string e JWT

`RunnerAi.Main/appsettings.Development.json`:
```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Port=5432;Database=runner_ai;Username=postgres;Password=postgres"
  },
  "Jwt": {
    "Secret": "sua-chave-secreta-com-pelo-menos-32-caracteres"
  }
}
```

### Criar migration (equivalente a `npx prisma migrate dev`)

```bash
cd runner-ai-dotnet

# Equivalente a prisma migrate dev --name init
dotnet ef migrations add Init \
  --project src/RunnerAi.Infra \
  --startup-project src/RunnerAi.Main

# Equivalente a prisma migrate deploy
dotnet ef database update \
  --project src/RunnerAi.Infra \
  --startup-project src/RunnerAi.Main
```

### Rodar o server

```bash
# Equivalente a npm run dev / ts-node src/main/server.ts
cd src/RunnerAi.Main
dotnet run

# Ou com hot reload (equivalente a nodemon):
dotnet watch run
```

### Testar

```bash
# Mesmo request que funciona no projeto TS atual
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@mail.com", "password": "123456"}'
```

---

## Glossario TS → C#

| TypeScript | C# | Nota |
|---|---|---|
| `type X = { ... }` | `class X { get; set; }` | Types sao shapes; classes sao concretas |
| `interface X` | `interface IX` | Convencao de prefixo `I` |
| `implements` | `:` | Mesma sintaxe de heranca |
| `Promise<T>` | `Task<T>` | Equivalentes asincronos |
| `async/await` | `async/await` | Identico |
| `T \| null` | `T?` | Nullable types |
| `any` | `object` | Tipo generico |
| `export` | `public` | Visibilidade |
| `private readonly` (construtor) | `private readonly` + atribuicao | C# exige declaracao separada |
| `import X from 'y'` | `using Namespace` | C# resolve por namespace, nao por arquivo |
| `constructor(private x: T)` | campo + construtor explicito | TS tem shorthand; C# nao |
| `export const f = () => ...` | `public static T F() => ...` | Nao existe funcao solta em C# |
| `for...of` | `foreach` | Mesma semantica |
| `npm install` | `dotnet add package` | Gerenciador de pacotes |
| `npm test` | `dotnet test` | Runner de testes |
| `npx prisma migrate dev` | `dotnet ef migrations add` | ORM migrations |
| `.env` + `dotenv` | `appsettings.json` | Config do ambiente |
| `jest.spyOn()` | `Substitute.For<>()` | Mock/spy |
| `describe/test` | `class/[Fact]` | Organizacao de testes |
| `expect().toBe()` | `.Should().Be()` | Assertions |
