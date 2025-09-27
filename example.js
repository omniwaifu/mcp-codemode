/**
 * MCP Code Mode Example
 *
 * This shows how to use MCP Code Mode with any MCP server.
 * The key insight: LLMs write better TypeScript code than tool-calling JSON.
 */

const { MCPCodeMode } = require('./index.js');

async function main() {
  // Configure your MCP server here
  // This example shows different ways to connect:

  const codeMode = new MCPCodeMode({
    // Example 1: Python MCP server with uv
    // command: 'uv',
    // args: ['run', 'your-mcp-server'],

    // Example 2: Node.js MCP server
    // command: 'node',
    // args: ['path/to/your/server.js'],

    // Example 3: Binary MCP server
    // command: './your-mcp-binary',
    // args: [],

    // For this example, we'll use a test server
    // Replace with your actual MCP server
    command: 'echo',
    args: ['No MCP server configured - replace with your server'],
    env: {}
  });

  try {
    console.log('🚀 MCP Code Mode Example\n');
    console.log('Connecting to MCP server...');
    await codeMode.connect();

    // Get the TypeScript definitions
    // THIS IS WHAT YOU SHOW TO THE LLM
    const context = codeMode.getLLMContext();
    console.log('\n📋 LLM Context (show this to your LLM):\n');
    console.log(context);

    // Get available tools
    const tools = codeMode.getTools();
    console.log('\n🔧 Available tools:', tools.map(t => t.name).join(', ') || 'None');

    // Example: Execute code that an LLM would write
    // The LLM writes TypeScript code using the type definitions above
    console.log('\n💻 Executing LLM-generated code:\n');

    const code = `
      // This is what the LLM writes - regular TypeScript/JavaScript code
      console.log('Hello from the sandbox!');

      // Example of calling an MCP tool (replace with actual tool name)
      // const result = await mcp.someToolName({ param: 'value' });
      // console.log('Tool result:', result);

      console.log('Code execution complete');
    `;

    const result = await codeMode.executeCode(code);

    console.log('✅ Execution result:');
    console.log('Success:', result.success);
    console.log('Execution time:', result.executionTimeMs, 'ms');
    console.log('\nOutput:');
    result.output.forEach(line => console.log('  ', line));

    if (result.error) {
      console.error('\n❌ Error:', result.error);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await codeMode.disconnect();
    console.log('\n👋 Disconnected');
  }
}

// How to use with an actual LLM:
function exampleLLMUsage() {
  /*
  1. Connect to your MCP server:
     const codeMode = new MCPCodeMode({ command: 'your-server', args: [] });
     await codeMode.connect();

  2. Get the TypeScript context for the LLM:
     const context = codeMode.getLLMContext();

  3. Send to your LLM with a prompt like:
     "Here are the available MCP tools as TypeScript APIs:
      ${context}

      Write TypeScript code to accomplish: [user's task]"

  4. Execute the LLM's code:
     const result = await codeMode.executeCode(llmGeneratedCode);

  5. Show results to user:
     console.log(result.output);
  */
}

if (require.main === module) {
  main().catch(console.error);
}