# Doctor AI Assistant System

A **Slack-based, MCP-driven, multi-agent AI assistant system** for doctors that follows an LLM-native architecture with RAG (Retrieval-Augmented Generation) and autonomous agent coordination.

## 🏗️ Architecture Overview

This system implements a modern, LLM-native architecture where:

1. **LLM is the primary decision-maker** - All routing and decision logic happens through LLM reasoning
2. **Agents are autonomous** - Each agent operates independently with its own reasoning loop
3. **Tools are registered via MCP** - Model Context Protocol manages all tool access
4. **Context is injected dynamically** - RAG retrieval happens before every reasoning step
5. **Memory is persistent** - All interactions are stored and retrieved semantically
6. **Agent-to-agent communication** - Agents coordinate through MCP message passing
7. **No hardcoded routing** - All flow decisions are made by the LLM

```
┌─────────────────────────────────────────────────────────────────┐ 
│                         SLACK INTERFACE                         │
│                    (Bolt SDK - Socket Mode)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DOCTOR ASSISTANT AGENT                      │
│              (Primary Entry Point for Doctors)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MCP SERVER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Tool Registry│  │Context Inject│  │  RAG Engine  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             ▼                                    ▼
┌─────────────────────────┐        ┌─────────────────────────────┐
│   SPECIALIZED AGENTS    │        │      MEMORY LAYER           │
│  ┌─────────────────┐    │        │  ┌──────────────────────┐  │
│  │ Surgery         │    │        │  │ Vector Store         │  │
│  │ Scheduler       │    │        │  │ (Pinecone)           │  │
│  ├─────────────────┤    │        │  ├──────────────────────┤  │
│  │ Patient         │    │        │  │ Embeddings           │  │
│  │ Intake          │    │        │  │ (Gemini)             │  │
│  ├─────────────────┤    │        │  ├──────────────────────┤  │
│  │ Reminder        │    │        │  │ PostgreSQL           │  │
│  ├─────────────────┤    │        │  │ (Structured Data)    │  │
│  │ Supervisor      │    │        │  └──────────────────────┘  │
│  └─────────────────┘    │        └─────────────────────────────┘
└─────────────────────────┘
```

## 📚 What is MCP (Model Context Protocol)?

**Model Context Protocol (MCP)** is an architectural pattern for building LLM-native applications. In this system, MCP serves as:

1. **Tool Registry** - A centralized registry where all tools (functions) are registered with their schemas
2. **Context Injection Layer** - Dynamically injects relevant context (RAG results, conversation history) into prompts
3. **Agent Communication Bus** - Enables agents to send structured messages to each other
4. **Execution Engine** - Handles tool calls with validation and error handling

### Key MCP Components

- **MCPServer**: Central coordinator that manages tools and context
- **Tool Registry**: Collection of available tools with type-safe schemas
- **Context Builder**: Retrieves RAG context and builds enhanced prompts
- **Agent Message Queue**: Asynchronous message passing between agents

## 🧠 How RAG (Retrieval-Augmented Generation) Works

RAG enhances LLM responses by retrieving relevant information from memory before generating responses.

### RAG Flow

1. **Embedding Generation**
   - User input is converted to a vector embedding using Gemini's `text-embedding-004` model
   - Same process for storing: all memories are embedded when stored

2. **Semantic Search**
   - Query embedding is compared against stored embeddings in Pinecone
   - Cosine similarity determines relevance
   - Top K most relevant memories are retrieved

3. **Context Injection**
   - Retrieved memories are formatted into a context string
   - Context is prepended to the system prompt
   - LLM now has relevant historical information

4. **Response Generation**
   - LLM reasons with both the query and retrieved context
   - Generates more informed, contextual responses

### What Gets Stored in RAG Memory?

- Slack conversations with doctors
- Appointment history and schedules
- Patient intake information
- Agent-to-agent messages
- System events and decisions

## 🤖 Agent-to-Agent Communication

Agents communicate **exclusively through MCP tool calls** - no direct method invocation.

### Communication Flow

```
┌──────────────────┐
│ Agent A          │
│ (Doctor Assist)  │
└────────┬─────────┘
         │
         │ 1. Calls sendAgentMessage tool
         │    via MCP Server
         ▼
┌──────────────────┐
│ MCP Server       │
│ Stores message   │
│ in database      │
└────────┬─────────┘
         │
         │ 2. AgentManager polls for
         │    pending messages
         ▼
┌──────────────────┐
│ Agent B          │
│ (Surgery Sched)  │
│                  │
│ 3. Retrieves RAG │
│    context       │
│                  │
│ 4. LLM reasons   │
│    about message │
│                  │
│ 5. Executes      │
│    tools         │
└──────────────────┘
```

### Example Message

```typescript
sendAgentMessage({
  to: "SurgerySchedulerAgent",
  intent: "ScheduleOperation",
  payload: {
    patientId: "patient-123",
    doctorId: "doctor-456",
    scheduledAt: "2024-03-15T14:00:00Z",
    duration: 120,
    notes: "Appendectomy procedure"
  }
})
```

The receiving agent:
1. **Retrieves** relevant context via RAG
2. **Reasons** about the request using its LLM
3. **Decides** what actions to take (use tools, respond, delegate further)
4. **Executes** the necessary tool calls
5. **Stores** the interaction in memory

## 🔧 System Components

### 1. Slack Interface Layer
- **Technology**: Slack Bolt SDK (Socket Mode)
- **Purpose**: Primary user interface for doctors
- **Features**:
  - App mentions: `@DoctorAI schedule surgery for John Doe`
  - Direct messages
  - Slash commands: `/doctor-ai help`

### 2. MCP Server
- **Location**: `src/mcp/mcp-server.ts`
- **Purpose**: Central tool registry and context injection
- **Key Methods**:
  - `registerTool()` - Register new tools
  - `executeTool()` - Execute tool with validation
  - `buildMCPContext()` - Build context with RAG
  - `injectContext()` - Inject context into prompts

### 3. Agent Framework
- **Base Class**: `src/agents/base-agent.ts`
- **Reasoning Loop**: Thought → Action → Tool → Observation
- **Key Features**:
  - Autonomous decision-making
  - RAG context retrieval
  - Tool execution
  - Memory storage
  - Audit logging

### 4. RAG Engine
- **Components**:
  - `EmbeddingService` - Gemini `text-embedding-004` embeddings
  - `VectorStore` - Pinecone for similarity search
  - `RAGEngine` - Orchestrates retrieval and storage
- **Features**:
  - Semantic memory storage
  - Context-aware retrieval
  - Multi-source memory (Slack, appointments, agents)

### 5. Database Layer
- **PostgreSQL**: Structured data (appointments, patients, doctors)
- **Prisma ORM**: Type-safe database access
- **Audit Logs**: All actions logged for compliance

### 6. Security Layer
- **PHI Encryption**: AES encryption for sensitive data
- **Log Masking**: Automatic redaction of sensitive information
- **Role-Based Access**: Permission validation
- **Audit Trail**: Complete action history

## 🤖 Agents

### 1. DoctorAssistantAgent
**Role**: Primary interface between doctors and the system

**Responsibilities**:
- Understand natural language requests
- Extract relevant information
- Delegate to specialized agents
- Provide helpful responses

**Tools**: retrieveMemory, storeMemory, sendAgentMessage, sendSlackMessage

### 2. SurgerySchedulerAgent
**Role**: Manage surgical procedures and scheduling

**Responsibilities**:
- Check availability
- Schedule surgeries
- Validate conflicts
- Create reminders

**Tools**: checkAvailability, scheduleSurgery, createReminder, sendSlackMessage

### 3. PatientIntakeAgent
**Role**: Collect and structure patient information

**Responsibilities**:
- Gather patient details
- Record chief complaints
- Document medical history
- Validate completeness

**Tools**: storeMemory, sendSlackMessage, sendAgentMessage

### 4. ReminderAgent
**Role**: Manage reminders and notifications

**Responsibilities**:
- Create scheduled reminders
- Send timely notifications
- Track reminder status
- Handle modifications

**Tools**: createReminder, sendSlackMessage, storeMemory

### 5. SupervisorAgent
**Role**: Monitor and coordinate agent workflows

**Responsibilities**:
- Monitor agent health
- Detect workflow issues
- Coordinate complex operations
- Handle escalations

**Tools**: retrieveMemory, sendAgentMessage, sendSlackMessage

## 🚀 Setup Guide

### Prerequisites

- Node.js 20+
- Slack workspace with admin access
- [Google AI Studio](https://aistudio.google.com/) account (Gemini API key)
- [Neon](https://neon.tech) account (free serverless PostgreSQL)
- [Pinecone](https://app.pinecone.io) account (free vector database)

### 1. Clone and Install

```bash
git clone <repository-url>
cd doctor-ai-assistant
npm install --legacy-peer-deps
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in `.env` with your credentials:

```env
# Slack — from https://api.slack.com/apps
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Gemini — from https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash

# Neon PostgreSQL — from https://neon.tech (connection string)
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# Pinecone — from https://app.pinecone.io (dimensions: 768, metric: cosine)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX=doctor-ai-memory

# Environment
NODE_ENV=development
LOG_LEVEL=info
PHI_ENCRYPTION_ENABLED=false
```

### 3. Slack App Setup

#### Step 1: Create Slack App
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → From scratch
2. Name it and choose your workspace

#### Step 2: Enable Socket Mode
1. Sidebar → **Socket Mode** → Enable
2. Generate App-Level Token (scope: `connections:write`) → copy to `SLACK_APP_TOKEN`

#### Step 3: Configure Bot Scopes
1. Sidebar → **OAuth & Permissions** → Bot Token Scopes → add:
   ```
   app_mentions:read  chat:write  channels:history
   im:history  im:write  users:read  users:read.email
   reactions:write  commands
   ```
2. **Install to Workspace** → copy **Bot User OAuth Token** → `SLACK_BOT_TOKEN`

#### Step 4: Enable Events
1. Sidebar → **Event Subscriptions** → Enable
2. Subscribe to: `app_mention`, `message.im`
3. Save Changes

#### Step 5: Signing Secret
1. **Basic Information** → App Credentials → copy **Signing Secret** → `SLACK_SIGNING_SECRET`

### 4. Create Pinecone Index
1. Go to [app.pinecone.io](https://app.pinecone.io) → **Create Index**
2. Settings: Name `doctor-ai-memory`, Dimensions **768**, Metric **cosine**
3. Copy API Key → `PINECONE_API_KEY`

## 🏃 Running the Project

### First-time setup

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Generate Prisma client
npx prisma generate

# 3. Push schema to Neon database (creates all tables)
npx prisma db push
```

### Development

```bash
# Start with hot-reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start compiled app
npm start
```

### Docker (app only — DB and vector store are online)

```bash
# Build and run
docker-compose up --build

# View logs
docker-compose logs -f app
```

## 📝 Adding a New Agent

1. **Create Agent Class**

```typescript
// src/agents/new-agent.agent.ts
import { BaseAgent } from './base-agent';
import { AgentConfig } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';

export class NewAgent extends BaseAgent {
  constructor(mcpServer: MCPServer, ragEngine: RAGEngine) {
    const config: AgentConfig = {
      name: 'NewAgent',
      identity: 'You are a specialized agent for...',
      systemPrompt: `
        Your responsibilities:
        1. ...
        2. ...
      `,
      tools: ['retrieveMemory', 'storeMemory', ...],
      enableRAG: true,
      enableMemory: true,
    };

    super(config, mcpServer, ragEngine);
  }
}
```

2. **Register in Agent Manager**

```typescript
// src/agents/agent-manager.ts
import { NewAgent } from './new-agent.agent';

async initialize(): Promise<void> {
  // ... existing agents ...
  const newAgent = new NewAgent(this.mcpServer, this.ragEngine);
  this.agents.set(newAgent.getName(), newAgent);
}
```

3. **Agent is now available** for delegation via `sendAgentMessage` tool!

## 🛠️ Adding a New Tool

1. **Create Tool Definition**

```typescript
// src/mcp/tool-registry.ts
export class ToolRegistry {
  static createMyCustomTool(): MCPTool {
    return {
      name: 'myCustomTool',
      description: 'Does something useful',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'First parameter',
          },
        },
        required: ['param1'],
      },
      handler: async (params) => {
        // Implementation
        return { success: true, result: '...' };
      },
    };
  }
}
```

2. **Register Tool**

```typescript
// src/index.ts
private registerBaseTools(): void {
  // ... existing tools ...
  this.mcpServer.registerTool(ToolRegistry.createMyCustomTool());
}
```

3. **Add to Agent Config**

```typescript
tools: [
  'retrieveMemory',
  'myCustomTool',  // Now available
  ...
]
```

## 📊 Database Schema

### Key Models

- **Doctor**: Slack users mapped to doctor profiles
- **Patient**: Patient information (PHI encrypted)
- **Appointment**: Scheduled procedures
- **Reminder**: Notifications and reminders
- **AgentMessage**: Inter-agent communication queue
- **MemoryEmbedding**: RAG vector storage
- **AuditLog**: Compliance and activity tracking

### Prisma Commands

```bash
# Generate client
npx prisma generate

# Create migration
npx prisma migrate dev --name description

# View database
npx prisma studio

# Deploy to production
npx prisma migrate deploy
```

## 🔒 Security Features

### PHI Protection
- AES encryption for sensitive fields
- Automatic log masking
- Secure key management

### Audit Trail
- All agent actions logged
- Tool executions tracked
- User interactions recorded

### Access Control
- Role-based permissions
- Tool payload validation
- Resource access checks

## 🚀 Production Deployment

### 1. Set production env vars
```env
NODE_ENV=production
LOG_LEVEL=info
```

### 2. Run database migrations
```bash
npx prisma generate
npx prisma db push
```

### 3. Build and start
```bash
npm run build
npm start
```

### 4. Or deploy with Docker
```bash
docker-compose up --build -d
docker-compose logs -f app
```

## 📈 Workflow Example

**Doctor says in Slack:**
> @DoctorAI Schedule operation for John Doe next Friday at 3pm

**System Flow:**

1. **SlackBot** receives message
2. **DoctorAssistantAgent** processes request:
   - **Thought**: "I need to schedule a surgery"
   - **Action**: tool_call
   - **Tool**: sendAgentMessage
   - **Parameters**: 
     ```json
     {
       "to": "SurgerySchedulerAgent",
       "intent": "ScheduleOperation",
       "payload": {
         "patientName": "John Doe",
         "scheduledAt": "2024-03-15T15:00:00Z"
       }
     }
     ```

3. **AgentManager** detects pending message

4. **SurgerySchedulerAgent** receives message:
   - Retrieves RAG context (previous surgeries, schedule)
   - **Thought**: "Need to verify availability first"
   - **Action**: tool_call
   - **Tool**: checkAvailability
   - Validates time slot
   - **Action**: tool_call
   - **Tool**: scheduleSurgery
   - Creates appointment
   - **Action**: tool_call
   - **Tool**: createReminder
   - Sets reminder for 24h before
   - **Action**: tool_call
   - **Tool**: sendSlackMessage
   - Confirms with doctor

5. **SupervisorAgent** monitors workflow completion

6. **Doctor receives confirmation** in Slack

## 🧪 Testing

### Manual Testing via Slack

1. Start system
2. Open Slack
3. DM the bot or mention it:
   - `@DoctorAI help`
   - `@DoctorAI schedule surgery for patient X`
   - `@DoctorAI what appointments do I have today?`

### Check Logs

```bash
# Application logs (local dev)
npm run dev

# Application logs (Docker)
docker-compose logs -f app
```

## 🐛 Troubleshooting

### Slack Not Responding
- Verify Socket Mode is enabled in [api.slack.com/apps](https://api.slack.com/apps)
- Check `SLACK_APP_TOKEN` starts with `xapp-`
- Ensure bot is invited to the channel with `/invite @bot-name`
- Check event subscriptions include `app_mention` and `message.im`

### Neon Database Connection Failed
- Verify `DATABASE_URL` includes `?sslmode=require` at the end
- Check the Neon project is not suspended (free tier auto-suspends)
- Re-run: `npx prisma db push`

### Pinecone Issues
- Verify index dimensions are **768** (matches Gemini `text-embedding-004`)
- Check index name matches `PINECONE_INDEX` in `.env`
- Verify `PINECONE_API_KEY` is correct in [app.pinecone.io](https://app.pinecone.io)

### Agent Not Responding

Check agent message queue:
```typescript
// In Prisma Studio or psql
SELECT * FROM agent_messages WHERE status = 'pending';
```

## 📚 Additional Resources

- [Slack Bolt SDK Documentation](https://slack.dev/bolt-js)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [Pinecone Documentation](https://docs.pinecone.io)
- [Neon Documentation](https://neon.tech/docs)

## 📄 License

MIT License - See LICENSE file for details

## 👥 Contributing

Contributions welcome! Please follow the architectural principles:
1. LLM makes routing decisions
2. Agents communicate via MCP
3. RAG before every reasoning step
4. No hardcoded logic

---

**Built with ❤️ for the medical community**
