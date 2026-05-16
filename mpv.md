MVP V1 — Sistema Inteligente de Pacing para
Corredores
Objetivo da V1
Construir um app capaz de receber um objetivo de corrida, monitorar o corredor em tempo real, calcular o pace
ideal, alertar desvios e prever tempo final.
Escopo da V1
Funcionalidades principais:
• Criar objetivo de corrida
• Tracking em tempo real via GPS
• Comparação do pace atual com objetivo
• Alertas inteligentes
• Previsão de tempo final
Arquitetura Mobile
Stack:
• React Native
• Expo
• TypeScript
Responsabilidades:
• GPS
• Interface do usuário
• Alertas
• Sessão de corrida
• Armazenamento local
Backend
Stack:
• Node.js
• Fastify
• PostgreSQL
Responsabilidades:
• APIs
• Persistência
• Processamento das corridas

APIs Principais
Auth
POST /auth/login
POST /auth/register
Corridas
POST /runs/start
PATCH /runs/:id/update
POST /runs/:id/finish
GET /runs/history
Objetivos
POST /goals
GET /goals
Modelagem Inicial
User
id, name, email
Goal
distanceKm, targetTimeMinutes, targetPace
RunSession
startedAt, endedAt, distanceMeters, avgPace
Fluxo Principal
Pré-corrida:
Usuário define meta e inicia corrida.
Durante corrida:

1. GPS atualizado
2. Cálculo do pace atual
3. Comparação com meta
4. Atualização da previsão final
5. Alertas em tempo real
   Estrutura Frontend
   Telas:
   • Home
   • CreateGoal
   • RunningScreen
   • SummaryScreen
   Algoritmos Base
   Pace Atual:
   pace = tempo / distância
   Desvio:
   desvio = pace_atual - pace_ideal
   Tempo estimado:
   tempo_estimado = pace_médio × distância_restante
   Dados Importantes
   Dados armazenados por checkpoint:
   • latitude
   • longitude
   • timestamp
   • pace
   Fora do Escopo da V1
   • IA
   • Machine Learning
   • Integração smartwatch
   • Potência de corrida
   • Clima
   • Funcionalidades sociais
   Roadmap Futuro
   V2: smartwatch, FC, altimetria, potência
   V3: IA preditiva, coach por voz
   V4: plano de treino automático e recomendações personalizadas

d
