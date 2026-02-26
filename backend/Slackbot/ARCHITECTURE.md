# Doctor AI Assistant - System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                             USERS (Doctors)                         │
│                              via Slack                              │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          SLACK INTERFACE                            │
│                                                                     │
│  - Socket Mode (WebSocket)                                         │
│  - Event Subscriptions (app_mention, message.im)                   │
│  - Slash Commands (/doctor-ai)                                     │
│  - Reactions for UX feedback                                       │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DOCTOR ASSISTANT AGENT                         │
│                     (Primary Entry Point)                           │
│                                                                     │
│  Responsibilities:                                                  │
│  - Natural language understanding                                   │
│  - Intent extraction                                                │
│  - Task delegation                                                  │
│  - Response generation                                              │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP SERVER LAYER                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    TOOL REGISTRY                            │   │
│  │                                                             │   │
│  │  - retrieveMemory      - scheduleSurgery                   │   │
│  │  - storeMemory         - checkAvailability                 │   │
│  │  - sendAgentMessage    - createReminder                    │   │
│  │  - sendSlackMessage    - logAudit                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               CONTEXT INJECTION ENGINE                      │   │
│  │                                                             │   │
│  │  - RAG Context Builder                                     │   │
│  │  - Conversation History                                    │   │
│  │  - Metadata Injection                                      │   │
│  │  - System Prompt Enhancement                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────┬──────────────────────────┬─────────────────────┘
                     │                          │
                     ▼                          ▼
┌──────────────────────────────┐  ┌──────────────────────────────────┐
│   SPECIALIZED AGENTS         │  │      MEMORY & RAG LAYER          │
│                              │  │                                  │
│  ┌────────────────────────┐  │  │  ┌────────────────────────────┐ │
│  │ SurgerySchedulerAgent  │  │  │  │      RAG ENGINE            │ │
│  │                        │  │  │  │                            │ │
│  │ - Availability check   │  │  │  │  - Semantic Search         │ │
│  │ - Conflict detection   │  │  │  │  - Context Building        │ │
│  │ - Appointment creation │  │  │  │  - Relevance Scoring       │ │
│  └────────────────────────┘  │  │  └────────────────────────────┘ │
│                              │  │                                  │
│  ┌────────────────────────┐  │  │  ┌────────────────────────────┐ │
│  │ PatientIntakeAgent     │  │  │  │    EMBEDDING SERVICE       │ │
│  │                        │  │  │  │                            │ │
│  │ - Information gathering│  │  │  │  - OpenAI text-embedding-3 │ │
│  │ - Data validation      │  │  │  │  - Batch processing        │ │
│  │ - Structured storage   │  │  │  │  - Similarity computation  │ │
│  └────────────────────────┘  │  │  └────────────────────────────┘ │
│                              │  │                                  │
│  ┌────────────────────────┐  │  │  ┌────────────────────────────┐ │
│  │ ReminderAgent          │  │  │  │      VECTOR STORE          │ │
│  │                        │  │  │  │                            │ │
│  │ - Scheduled tasks      │  │  │  │  - ChromaDB                │ │
│  │ - Notification delivery│  │  │  │  - Cosine similarity       │ │
│  │ - Status tracking      │  │  │  │  - Collection management   │ │
│  └────────────────────────┘  │  │  └────────────────────────────┘ │
│                              │  │                                  │
│  ┌────────────────────────┐  │  │  ┌────────────────────────────┐ │
│  │ SupervisorAgent        │  │  │  │   STRUCTURED STORAGE       │ │
│  │                        │  │  │  │                            │ │
│  │ - Workflow monitoring  │  │  │  │  - PostgreSQL + Prisma     │ │
│  │ - Health checks        │  │  │  │  - Appointments, Patients  │ │
│  │ - Error recovery       │  │  │  │  - Agent Messages          │ │
│  └────────────────────────┘  │  │  │  - Audit Logs              │ │
└──────────────────────────────┘  │  └────────────────────────────┘ │
                                  └──────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        SECURITY LAYER                               │
│                                                                     │
│  - PHI Encryption (AES-256)                                        │
│  - Automatic Log Masking                                           │
│  - Role-Based Access Control                                       │
│  - Audit Trail (All Actions)                                       │
│  - Schema Validation                                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent Reasoning Loop

Each agent follows the **Thought → Action → Tool → Observation** pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT REASONING LOOP                       │
└─────────────────────────────────────────────────────────────────┘

1. RECEIVE INPUT
   ├─ From Slack message
   ├─ From another agent
   └─ From scheduled task

2. RAG RETRIEVAL
   ├─ Generate query embedding
   ├─ Search vector store
   ├─ Retrieve top K memories
   └─ Build context string

3. ENHANCED PROMPT
   ├─ Base system prompt
   ├─ Agent identity
   ├─ RAG context
   ├─ Conversation history
   ├─ Available tools
   └─ Reasoning instructions

4. LLM REASONING (Iteration)
   │
   ├─ THOUGHT
   │  └─ "I need to check if the time slot is available"
   │
   ├─ ACTION
   │  └─ tool_call | respond | delegate | wait
   │
   ├─ TOOL (if action = tool_call)
   │  └─ Tool name + parameters
   │
   ├─ EXECUTE
   │  └─ MCP Server executes tool
   │
   ├─ OBSERVATION
   │  └─ Tool result injected back
   │
   └─ REPEAT (max 5 iterations)

5. FINAL RESPONSE
   ├─ Store in memory
   ├─ Log audit event
   └─ Return to caller

6. POST-PROCESSING
   ├─ Send Slack message (if needed)
   ├─ Create agent message (if delegating)
   └─ Update database
```

## Agent Communication Flow

```
Doctor says: "Schedule surgery for John Doe Friday 3pm"
       │
       ▼
┌──────────────────────────────────────────────────────┐
│ DoctorAssistantAgent                                 │
│                                                      │
│ Thought: "This is a surgery scheduling request"     │
│ Action: delegate                                     │
│ Tool: sendAgentMessage                               │
│ Parameters: {                                        │
│   to: "SurgerySchedulerAgent",                      │
│   intent: "ScheduleOperation",                      │
│   payload: { patient, time, etc }                   │
│ }                                                    │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ MCPServer.executeTool("sendAgentMessage")           │
│                                                      │
│ - Validates payload                                  │
│ - Stores in database (status: pending)              │
│ - Returns { success: true, messageId }              │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ AgentManager (Background Polling)                    │
│                                                      │
│ - Queries pending messages every 5s                  │
│ - Finds message for SurgerySchedulerAgent            │
│ - Calls agent.processAgentMessage()                  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│ SurgerySchedulerAgent                                │
│                                                      │
│ RAG: Retrieve context about John Doe, schedules     │
│                                                      │
│ Thought: "Need to verify availability"              │
│ Action: tool_call                                    │
│ Tool: checkAvailability                              │
│ Result: { available: true }                         │
│                                                      │
│ Thought: "Slot is free, schedule it"                │
│ Action: tool_call                                    │
│ Tool: scheduleSurgery                                │
│ Result: { success: true, appointmentId }            │
│                                                      │
│ Thought: "Create reminder"                          │
│ Action: tool_call                                    │
│ Tool: createReminder                                 │
│ Result: { success: true, reminderId }               │
│                                                      │
│ Thought: "Confirm with doctor"                      │
│ Action: tool_call                                    │
│ Tool: sendSlackMessage                               │
│ Result: { success: true }                           │
│                                                      │
│ Action: respond                                      │
│ Response: "Surgery scheduled successfully"          │
└──────────────────────────────────────────────────────┘
```

## Data Flow

### Memory Storage Flow

```
Event Occurs (Slack message, appointment, etc)
       │
       ▼
Extract text content
       │
       ▼
Generate embedding (OpenAI)
       │
       ├─────────────┬──────────────┐
       ▼             ▼              ▼
PostgreSQL      ChromaDB      Agent Context
(structured)    (vector)      (immediate use)
       │             │              │
       │             │              │
       └─────────────┴──────────────┘
                     │
                     ▼
           Available for RAG retrieval
```

### RAG Retrieval Flow

```
Agent receives input
       │
       ▼
Generate query embedding
       │
       ▼
Search ChromaDB (cosine similarity)
       │
       ▼
Rank results by similarity score
       │
       ▼
Filter by threshold (0.7)
       │
       ▼
Fetch full content from PostgreSQL
       │
       ▼
Format as context string
       │
       ▼
Inject into system prompt
       │
       ▼
LLM reasoning with context
```

## Technology Stack

- **Runtime**: Node.js 20+, TypeScript
- **Framework**: Custom agent framework based on LLM reasoning
- **LLM**: OpenAI GPT-4 Turbo
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector DB**: ChromaDB
- **Relational DB**: PostgreSQL + Prisma
- **Messaging**: Slack Bolt SDK (Socket Mode)
- **Security**: AES encryption, log masking
- **Deployment**: Docker Compose

## Key Design Decisions

### 1. LLM-Native Architecture
- No hardcoded routing or business logic
- LLM decides all actions dynamically
- Reasoning loop exposed through structured format

### 2. Agent Autonomy
- Each agent is self-contained
- Independent reasoning and decision-making
- Coordinated through message passing

### 3. MCP as Communication Bus
- All tool calls go through MCP
- Agents communicate via MCP messages
- No direct method invocation

### 4. RAG-First Approach
- Context retrieval before every reasoning step
- All interactions stored in memory
- Semantic search for relevance

### 5. Security by Design
- PHI encryption at rest
- Automatic log masking
- Comprehensive audit trail
- Role-based access (future)

## Scalability Considerations

### Horizontal Scaling
- Stateless agent design
- Database connection pooling
- Message queue can be replaced with Redis/RabbitMQ

### Performance
- Batch embedding generation
- Vector search optimization
- LLM response caching (future)
- Agent message processing parallelization

### Monitoring
- Winston logging to files
- Audit logs in database
- Health check endpoints (future)
- Metrics collection (future)
