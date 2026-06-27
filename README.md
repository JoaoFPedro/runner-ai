# runner.ai

API backend para autenticação e gerenciamento de contas, construída com TypeScript seguindo os princípios de Clean Architecture.

---

## Tecnologias

- **TypeScript** — linguagem principal
- **Express** — servidor HTTP
- **Prisma** — ORM para PostgreSQL
- **Jest** — testes unitários e de integração
- **bcrypt** — hash de senhas
- **jsonwebtoken** — geração de tokens JWT
- **validator** — validação de e-mail

---

## Pré-requisitos

- Node.js 18+
- PostgreSQL rodando localmente ou via Docker
- npm

---

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/runner_ai"
```

3. Rode as migrations do banco:

```bash
npx prisma migrate dev
```

4. Gere o Prisma Client:

```bash
npx prisma generate
```

---

## Comandos

### Testes

```bash
# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Todos os testes
npm run test:all

# Modo watch (re-executa ao salvar)
npm run test:watch

# Cobertura de testes
npm run test:coverage
```

### Banco de dados

```bash
# Criar e aplicar nova migration
npx prisma migrate dev --name nome_da_migration

# Aplicar migrations em produção
npx prisma migrate deploy

# Abrir Prisma Studio (interface visual do banco)
npx prisma studio

# Resetar banco de dados (apaga tudo e recria)
npx prisma migrate reset
```

---

## Estrutura de pastas

```
src/
├── domain/              # Regras de negócio e contratos (sem dependências externas)
│   ├── models/          # Tipos e entidades (ex: Account)
│   └── use-cases/       # Interfaces dos casos de uso (ex: Authentication)
│
├── data/                # Implementações dos casos de uso
│   ├── protocols/       # Interfaces de infraestrutura (DB, criptografia)
│   └── use-cases/       # Lógica que orquestra domínio + infra
│
├── infra/               # Implementações concretas (banco, libs externas)
│   ├── db/prisma/       # Helpers e repositórios Prisma
│   └── adapters/        # Adaptadores de libs externas (ex: EmailValidatorAdapter)
│
├── presentation/        # Camada HTTP (controllers, helpers, erros)
│   ├── controllers/     # Recebem requests e retornam responses
│   ├── helpers/         # Funções auxiliares (badRequest, success, etc.)
│   ├── protocols/       # Interfaces HTTP (HttpRequest, HttpResponse, Controller)
│   └── erros/           # Classes de erro da aplicação
│
└── validation/          # Validações reutilizáveis
    └── validators/
        ├── required-fields/       # Verifica se campo existe no input
        ├── email-validation/      # Verifica formato do e-mail
        └── validation-composite/  # Orquestra múltiplas validações
```

---

## Arquitetura de Validação

A validação segue o **Composite Pattern**: cada validação é independente e implementa a mesma interface `Validation`. O `ValidationComposite` as encadeia e para no primeiro erro.

### Fluxo completo de uma requisição de login

```
HTTP Request { email, password }
        │
        ▼
LoginController.handle()
        │
        ▼
ValidationComposite.validator(body)
    ├── RequiredFields("email")      → MissingParamError se vazio/ausente
    ├── RequiredFields("password")   → MissingParamError se vazio/ausente
    └── EmailValidation("email")
              │
              ▼
        EmailValidatorAdapter.isValid()
              │
              ▼
        validator.isEmail()  ← lib npm
              │
              └── InvalidParamError se formato inválido
        │
        ├── Erro encontrado → 400 badRequest
        │
        └── Sem erros ──▶ Authentication.auth(body)
                                │
                                ├── null → 401 unauthorized
                                └── token → 200 success(accessToken)
```

### Por que esse design?

Cada camada conhece apenas a interface da camada abaixo, nunca a implementação concreta:

- `LoginController` só conhece a interface `Validation` — não sabe quantas validações existem
- `EmailValidation` só conhece a interface `EmailValidator` — não sabe que é o `validator` do npm
- `EmailValidatorAdapter` é o único acoplado à lib externa — trocar a lib significa alterar só esse arquivo

---

## Modelo de dados

```prisma
model Account {
  id       String @id @default(uuid())
  name     String
  email    String @unique
  password String

  @@map("accounts")
}
```

---

## Padrões utilizados

| Padrão | Onde | Por quê |
|---|---|---|
| **Composite** | `ValidationComposite` | Encadeia validações sem o controller saber quantas são |
| **Adapter** | `EmailValidatorAdapter` | Isola a lib `validator` do restante do código |
| **Dependency Injection** | Todos os construtores | Facilita testes e troca de implementações |
| **Repository** | `LoadAccountByEmailRepository` | Desacopla o caso de uso do banco de dados |
