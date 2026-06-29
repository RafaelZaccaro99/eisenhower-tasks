# Eisenhower Tasks

Gerenciador de tarefas baseado na **Matriz de Eisenhower** com agenda semanal, gestão de pessoas, integração com Slack e classificação automática por IA.

## Funcionalidades

- **Matriz 2×2** — organiza tarefas nos quadrantes Fazer agora / Agendar / Delegar / Eliminar
- **Agenda semanal** — grade de horários com blocos recorrentes e vinculação de tarefas
- **Pessoas** — cadastro de equipe com hierarquia, contato rápido via Slack e WhatsApp
- **Assistente de classificação** — sugere o quadrante certo ao criar uma tarefa
  - Modo local: palavras-chave e prazo configuráveis
  - Modo IA: Anthropic Claude, OpenAI, Groq ou Google Gemini
- **Servidor de dados local** — REST API em `localhost:3001` para persistência fora do browser
- **MCP Server** — expõe tarefas e contexto para agentes de IA via Model Context Protocol
- **Modo Electron** — app desktop nativo com banco JSON local

## Como rodar

### Pré-requisitos

```bash
node >= 18
npm install
```

### Web (dev)

```bash
# Terminal 1 — servidor de dados (opcional, mas recomendado)
npm run data-server

# Terminal 2 — app React
npm run dev
```

Acesse `http://localhost:5173`.

> Sem o servidor de dados, tudo é salvo no `localStorage` do browser.

### Electron (dev)

```bash
npm run electron:dev
```

### MCP Server

```bash
npm run mcp
```

Conecte ao agente de IA no endereço `http://localhost:3002/mcp`.

## Build

```bash
# Web
npm run build          # gera dist/

# Electron (instalador)
npm run electron:build # gera release/
```

## Estrutura do projeto

```
src/
  App.jsx                  # Raiz, navegação entre views
  components/
    Matrix.jsx             # Grade dos 4 quadrantes
    Agenda.jsx             # Agenda semanal com TimeGrid
    People.jsx             # Cadastro de pessoas
    TaskModal.jsx          # Modal criar/editar tarefa + assistente IA
    Settings.jsx           # Configurações do assistente e integrações
    Onboarding.jsx         # Wizard de configuração inicial
    SlackComposer.jsx      # Composer de mensagens Slack
  hooks/
    useTasks.js            # Estado e CRUD de tarefas (IPC / servidor / localStorage)
    usePeople.js           # Estado e CRUD de pessoas (IPC / servidor / localStorage)
    useSettings.js         # Configurações salvas no localStorage
  utils/
    classifier.js          # Classificador local por palavras-chave
    aiClassifier.js        # Classificação via API de IA (multi-provider)
    dataApi.js             # Cliente HTTP para o servidor local
    slack.js               # Envio de DMs via Slack API
electron/
  main.js                  # Processo principal Electron + IPC handlers
  preload.js               # Bridge contextIsolation
data-server.mjs            # Servidor REST Express (tasks, people, blocks)
mcp-server.mjs             # MCP Server para agentes de IA
```

## Modos de persistência

| Modo | Quando ativo | Onde salva |
|---|---|---|
| Electron IPC | Rodando como app desktop | JSON em `userData` do SO |
| Servidor local | `data-server.mjs` respondendo em `:3001` | `data/tasks.json`, `data/people.json`, `data/blocks.json` |
| localStorage | Nenhum dos anteriores | Browser local |

## Configuração de IA

Na tela **Configurações**, ative "Usar IA" e informe a chave de API do provedor desejado. A chave é salva apenas localmente no `localStorage`.

| Provedor | Modelos disponíveis |
|---|---|
| Anthropic | Claude Haiku 4.5, Sonnet 4.6, Opus 4.8 |
| OpenAI | GPT-4o Mini, GPT-4o |
| Groq | Llama 3.1 8B, Llama 3.3 70B, Gemma 2 9B |
| Google | Gemini 2.0 Flash, 1.5 Flash, 1.5 Pro |

## Integração Slack

1. Crie um app em `api.slack.com/apps`
2. Em **OAuth & Permissions → Bot Token Scopes**, adicione: `chat:write`, `im:write`, `im:history`
3. Instale no workspace e copie o **Bot User OAuth Token**
4. Cole o token em **Configurações → Slack**
5. Em cada pessoa, informe o **Slack Member ID** (perfil → `···` → Copiar ID do membro)
