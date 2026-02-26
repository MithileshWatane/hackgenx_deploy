import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentConfig, ReasoningStep, RAGContext } from '../types';
import { MCPServer } from '../mcp/mcp-server';
import { RAGEngine } from '../rag/rag-engine.service';
import { logger } from '../utils/logger';
import { AuditService } from '../database/audit.service';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected mcpServer: MCPServer;
  protected ragEngine: RAGEngine;
  private conversationHistory: string[] = [];

  constructor(
    config: AgentConfig,
    mcpServer: MCPServer,
    ragEngine: RAGEngine
  ) {
    this.config = config;
    this.mcpServer = mcpServer;
    this.ragEngine = ragEngine;
  }

  /**
   * Main reasoning loop using Thought/Action/Tool/Observation pattern
   */
  async reason(input: string, context?: Record<string, any>): Promise<string> {
    logger.info(`${this.config.name} starting reasoning`, { input: input.substring(0, 100) });

    try {
      // Step 1: Retrieve RAG context if enabled
      let ragContext: RAGContext | undefined;
      if (this.config.enableRAG) {
        ragContext = await this.ragEngine.buildContext(input, {
          limit: 5,
          minSimilarity: 0.7,
        });
      }

      // Step 2: Build enhanced system prompt with context
      const systemPrompt = this.buildSystemPrompt(ragContext, context);

      // Step 3: Reasoning loop
      let maxIterations = 5;
      let iteration = 0;
      let finalResponse = '';
      const reasoningSteps: ReasoningStep[] = [];

      while (iteration < maxIterations) {
        iteration++;
        logger.info(`${this.config.name} iteration ${iteration}`);

        // Get LLM response
        const llmResponse = await this.callLLM(systemPrompt, input, reasoningSteps);

        // Parse reasoning step
        const step = this.parseReasoningStep(llmResponse);
        reasoningSteps.push(step);

        logger.info(`${this.config.name} - Thought: ${step.thought}`);
        logger.info(`${this.config.name} - Action: ${step.action}`);

        // Execute action based on reasoning
        if (step.action === 'respond') {
          finalResponse = step.observation || llmResponse;
          break;
        } else if (step.action === 'tool_call' && step.tool && step.toolInput) {
          // Execute tool
          try {
            const toolResult = await this.mcpServer.executeTool(step.tool, step.toolInput);
            step.observation = JSON.stringify(toolResult);
            logger.info(`${this.config.name} - Tool result: ${step.observation.substring(0, 200)}`);
          } catch (error: any) {
            step.observation = `Tool execution failed: ${error.message}`;
            logger.error(`${this.config.name} - Tool error:`, error);
          }
        } else if (step.action === 'delegate') {
          // Delegate to another agent via MCP
          if (step.toolInput) {
            await this.mcpServer.executeTool('sendAgentMessage', {
              ...step.toolInput,
              from: this.config.name,
            });
            step.observation = 'Message sent to another agent';
          }
        } else if (step.action === 'wait') {
          // Wait for more information
          finalResponse = step.observation || 'I need more information to proceed.';
          break;
        }

        // Safety check
        if (iteration >= maxIterations) {
          finalResponse = 'I\'ve reached my reasoning limit. Let me summarize what I found.';
        }
      }

      // Step 4: Store interaction in memory if enabled
      if (this.config.enableMemory) {
        await this.ragEngine.storeMemory({
          content: `${this.config.name} processed: ${input} -> ${finalResponse}`,
          source: 'agent_message',
          metadata: {
            agentName: this.config.name,
            iterations: iteration,
          },
        });
      }

      // Step 5: Audit log
      await AuditService.logAudit({
        agentName: this.config.name,
        action: 'reasoning_completed',
        details: {
          input: input.substring(0, 200),
          iterations: iteration,
          steps: reasoningSteps.length,
        },
      });

      logger.info(`${this.config.name} reasoning completed`, { iterations: iteration });
      return finalResponse;

    } catch (error) {
      logger.error(`${this.config.name} reasoning failed:`, error);
      throw error;
    }
  }

  /**
   * Build enhanced system prompt with RAG context
   */
  private buildSystemPrompt(ragContext?: RAGContext, context?: Record<string, any>): string {
    let prompt = `${this.config.identity}\n\n${this.config.systemPrompt}`;

    // Add RAG context
    if (ragContext) {
      prompt += `\n\n${ragContext.contextString}`;
    }

    // Add additional context
    if (context) {
      prompt += `\n\nAdditional context: ${JSON.stringify(context)}`;
    }

    // Add reasoning instructions
    prompt += `\n\nYou must reason using this format:
Thought: [Your internal reasoning about what to do next]
Action: [Choose one: tool_call, respond, delegate, wait]
Tool: [If action is tool_call, specify the tool name]
ToolInput: [If action is tool_call, provide the JSON input]
Observation: [After tool execution, note the result]

Continue reasoning until you have enough information to respond.
When ready to respond to the user, use Action: respond.`;

    // Add available tools
    const toolDefinitions = this.mcpServer.getToolDefinitions(this.config.tools);
    if (toolDefinitions.length > 0) {
      prompt += `\n\nAvailable tools:\n${JSON.stringify(toolDefinitions, null, 2)}`;
    }

    return prompt;
  }

  /**
   * Call Gemini LLM with current context
   */
  private async callLLM(
    systemPrompt: string,
    userInput: string,
    previousSteps: ReasoningStep[]
  ): Promise<string> {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      systemInstruction: systemPrompt,
    });

    // Build the user message, including conversation history and previous steps
    let userMessage = '';

    if (this.conversationHistory.length > 0) {
      userMessage += this.conversationHistory.join('\n') + '\n\n';
    }

    userMessage += userInput;

    if (previousSteps.length > 0) {
      const stepsText = previousSteps.map(s =>
        `Thought: ${s.thought}\nAction: ${s.action}\n${s.tool ? `Tool: ${s.tool}\n` : ''}${s.observation ? `Observation: ${s.observation}\n` : ''}`
      ).join('\n');
      userMessage += `\n\nPrevious reasoning steps:\n${stepsText}`;
    }

    const result = await model.generateContent(userMessage);
    return result.response.text();
  }

  /**
   * Parse LLM response into reasoning step
   */
  private parseReasoningStep(response: string): ReasoningStep {
    const thoughtMatch = response.match(/Thought:\s*(.+?)(?=\n|$)/i);
    const actionMatch = response.match(/Action:\s*(.+?)(?=\n|$)/i);
    const toolMatch = response.match(/Tool:\s*(.+?)(?=\n|$)/i);
    const toolInputMatch = response.match(/ToolInput:\s*(\{[\s\S]*?\})\s*(?=\n\w+:|$)/i);
    const observationMatch = response.match(/Observation:\s*(.+?)(?=\n|$)/is);

    const step: ReasoningStep = {
      thought: thoughtMatch?.[1]?.trim() || 'Analyzing the situation',
      action: this.parseAction(actionMatch?.[1]?.trim() || 'respond'),
    };

    if (step.action === 'tool_call') {
      step.tool = toolMatch?.[1]?.trim();
      if (toolInputMatch) {
        try {
          const jsonStr = toolInputMatch[1].trim();
          step.toolInput = JSON.parse(jsonStr);
        } catch (error) {
          logger.error('Failed to parse tool input:', toolInputMatch[1]);
          // Try to extract JSON from the response more aggressively
          const jsonMatch = response.match(/\{[\s\S]*"to"[\s\S]*"intent"[\s\S]*"payload"[\s\S]*\}/);
          if (jsonMatch) {
            try {
              step.toolInput = JSON.parse(jsonMatch[0]);
            } catch (e) {
              logger.error('Failed secondary JSON parse attempt');
            }
          }
        }
      }
    }

    if (observationMatch) {
      step.observation = observationMatch[1]?.trim();
    }

    return step;
  }

  private parseAction(actionStr: string): 'tool_call' | 'respond' | 'delegate' | 'wait' {
    const normalized = actionStr.toLowerCase();
    if (normalized.includes('tool')) return 'tool_call';
    if (normalized.includes('delegate')) return 'delegate';
    if (normalized.includes('wait')) return 'wait';
    return 'respond';
  }

  /**
   * Process incoming agent message
   */
  async processAgentMessage(message: {
    from: string;
    intent: string;
    payload: Record<string, any>;
  }): Promise<any> {
    logger.info(`${this.config.name} received message from ${message.from}`, {
      intent: message.intent,
    });

    const input = `Agent ${message.from} sent a message with intent: ${message.intent}. Payload: ${JSON.stringify(message.payload)}`;
    return this.reason(input, { fromAgent: message.from, intent: message.intent });
  }

  /**
   * Add to conversation history
   */
  protected addToHistory(message: string): void {
    this.conversationHistory.push(message);
    if (this.conversationHistory.length > 10) {
      this.conversationHistory.shift();
    }
  }

  getName(): string {
    return this.config.name;
  }
}
