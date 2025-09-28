const MCPCodeMode = require('../index');

/**
 * Example: Using MCP Code Mode with any LLM
 *
 * This shows the basic pattern that works with any LLM:
 * - Local models (Ollama, LlamaCpp)
 * - Cloud providers (Gemini, Cohere, etc.)
 * - Custom models
 */

async function main() {
  // 1. Connect to MCP server
  const mcp = new MCPCodeMode({
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem', '/path/to/files']
  }, {
    validateTypes: true,  // Enable TypeScript validation
    memoryLimit: 256,     // Sandbox memory limit
    timeout: 10000        // Execution timeout
  });

  await mcp.connect();

  // 2. Get context for your LLM
  const context = mcp.getContext();

  // This context includes:
  // - TypeScript type definitions for all MCP tools
  // - Instructions on how to use the 'mcp' object
  // - List of available tools

  // 3. Call your LLM however you want
  const code = await yourCustomLLM({
    systemPrompt: "You are a coding assistant. Generate JavaScript code only.",
    userPrompt: `${context}\n\nWrite code to: list all files in the current directory`,
    // Your LLM-specific options...
  });

  // 4. Extract code if LLM returns markdown
  const cleanCode = MCPCodeMode.extractCode(code);

  // 5. Execute with full production features:
  // - TypeScript validation (if enabled)
  // - Isolated VM sandbox
  // - Error mapping with helpful messages
  const result = await mcp.execute(cleanCode);

  if (result.success) {
    console.log('Success! Output:');
    result.output.forEach(line => console.log(' ', line));
  } else {
    console.error('Execution failed:', result.error);
    if (result.validationErrors) {
      console.error('TypeScript errors:', result.validationErrors);
    }
  }

  // 6. Clean up
  await mcp.disconnect();
}

/**
 * Example LLM integration (you implement this)
 */
async function yourCustomLLM({ systemPrompt, userPrompt }) {
  // Could be:
  // - REST API call to your model
  // - Local model via node-llama-cpp
  // - Ollama API
  // - LangChain
  // - Anything that returns code

  // For demo, returning example code
  return `
    const files = await mcp.readDirectory({ path: '.' });
    files.forEach(file => {
      console.log(file.name);
    });
  `;
}

main().catch(console.error);