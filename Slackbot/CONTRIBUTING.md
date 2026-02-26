# Contributing to Doctor AI Assistant

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing patterns in BaseAgent
- Add JSDoc comments for public methods
- Use meaningful variable names

### Agent Development

When creating a new agent:

1. Extend `BaseAgent`
2. Define clear identity and system prompt
3. List required tools
4. Enable RAG and memory
5. Let LLM make decisions (no hardcoded routing)

### Tool Development

When creating a new tool:

1. Define clear, specific purpose
2. Use Zod schemas for validation (optional but recommended)
3. Return structured responses
4. Handle errors gracefully
5. Add audit logging

### Testing

- Test agent reasoning with various inputs
- Verify tool execution
- Check RAG retrieval quality
- Validate security measures

### Pull Request Process

1. Create feature branch
2. Write clear commit messages
3. Update README if needed
4. Test thoroughly
5. Submit PR with description

### Architectural Principles

**MUST FOLLOW:**

1. **LLM decides routing** - No `if/else` routing logic
2. **Agents are autonomous** - They reason independently
3. **Communication via MCP** - No direct agent method calls
4. **RAG before reasoning** - Always retrieve context first
5. **Memory everything** - Store all interactions
6. **Audit all actions** - Log for compliance

**DON'T:**

- Don't add hardcoded routing logic
- Don't bypass MCP for agent communication
- Don't skip RAG retrieval
- Don't forget security (encryption, masking)
- Don't add tools without clear purpose

## Questions?

Open an issue or start a discussion!
