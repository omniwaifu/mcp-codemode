# MCP Code Mode

Convert any MCP (Model Context Protocol) server into TypeScript APIs that LLMs can write code against.

Based on Cloudflare's insight: **LLMs write better code than they write tool-calling JSON.**

## Requirements

- Node.js 20, 22, or 23 (even-numbered stable releases)
- Not compatible with Node.js 24+ (odd-numbered/experimental releases)

## Installation

```bash
npm install mcp-codemode
```

## Quick Start

```javascript
const MCPCodeMode = require('mcp-codemode');

// 1. Connect to any MCP server
const mcp = new MCPCodeMode({
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', '/path']
});

await mcp.connect();

// 2. Get TypeScript context for your LLM
const context = mcp.getContext();

// 3. Your LLM writes code (you handle this part)
const code = await yourLLM(context + "List all files");

// 4. Execute the code securely
const result = await mcp.execute(code);
```

## Core API

The library has just 4 main methods:

- `connect()` - Connect to an MCP server
- `getContext()` - Get TypeScript definitions for your LLM
- `execute(code)` - Run code in a secure sandbox
- `MCPCodeMode.extractCode(response)` - Extract code from LLM responses

## Bring Your Own LLM

This library doesn't force any LLM choice. Use whatever you want:

### OpenAI
```javascript
const response = await openai.chat.completions.create({
  messages: [{ role: 'user', content: context + prompt }]
});
const code = MCPCodeMode.extractCode(response.choices[0].message.content);
```

### Anthropic
```javascript
const response = await anthropic.messages.create({
  messages: [{ role: 'user', content: context + prompt }]
});
const code = MCPCodeMode.extractCode(response.content[0].text);
```

### Local Models
```javascript
const response = await ollama.generate({
  model: 'codellama',
  prompt: context + prompt
});
const code = MCPCodeMode.extractCode(response.response);
```

## Features

- ✅ **Universal** - Works with ANY MCP server
- ✅ **Secure** - Runs code in isolated V8 sandbox
- ✅ **Type-Safe** - Optional TypeScript validation
- ✅ **Production-Ready** - Error mapping, memory limits, timeouts
- ✅ **LLM-Agnostic** - Bring your own LLM

## How It Works

1. Connects to any MCP server and discovers available tools
2. Generates TypeScript type definitions from tool schemas
3. Your LLM writes code using these types
4. Code executes in a secure isolated-vm sandbox
5. Returns results or mapped errors

## Examples

See the `/examples` folder for complete examples with:
- OpenAI (`examples/openai.js`)
- Anthropic Claude (`examples/anthropic.js`)
- Custom/Local LLMs (`examples/custom.js`)

## Options

```javascript
new MCPCodeMode(serverConfig, {
  validateTypes: true,    // Validate TypeScript before execution
  memoryLimit: 128,       // Sandbox memory limit (MB)
  timeout: 5000          // Execution timeout (ms)
});
```

## Why Code Instead of Tool Calls?

LLMs have seen millions of code examples but relatively few tool-calling examples. When you let them write code:
- Better quality outputs
- Complex logic flows naturally
- Fewer errors
- Can compose multiple tools easily

## License

MIT