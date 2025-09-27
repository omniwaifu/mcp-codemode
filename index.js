/**
 * MCP Code Mode - Convert MCP tools to TypeScript APIs for LLMs
 *
 * Based on Cloudflare's approach: LLMs are better at writing code
 * to call MCP than at calling MCP directly.
 */

const { MCPBridge } = require('./src/mcp-bridge.js');
const { CodeSandbox } = require('./src/sandbox.js');
const { IsolatedSandbox } = require('./src/isolated-sandbox.js');

class MCPCodeMode {
  constructor(serverConfig, options = {}) {
    this.bridge = new MCPBridge(serverConfig);

    // Choose sandbox implementation
    // Default to isolated-vm for better security
    const sandboxType = options.sandbox || 'isolated';

    if (sandboxType === 'isolated') {
      this.sandbox = new IsolatedSandbox({
        memoryLimit: options.memoryLimit || 128,
        timeout: options.timeout || 5000
      });
    } else if (sandboxType === 'worker') {
      this.sandbox = new CodeSandbox();
    } else {
      throw new Error(`Unknown sandbox type: ${sandboxType}. Use 'isolated' or 'worker'`);
    }

    this.sandboxType = sandboxType;
    this.connected = false;
  }

  /**
   * Connect to the MCP server and generate TypeScript definitions
   */
  async connect() {
    await this.bridge.connect();
    this.connected = true;
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    await this.bridge.disconnect();

    // Dispose of isolated sandbox if used
    if (this.sandboxType === 'isolated' && this.sandbox.dispose) {
      await this.sandbox.dispose();
    }

    this.connected = false;
  }

  /**
   * Get the TypeScript type definitions for the MCP tools
   * This should be shown to the LLM as context
   */
  getTypeDefinitions() {
    return this.bridge.getTypeDefinitions();
  }

  /**
   * Get list of available tools
   */
  getTools() {
    return this.bridge.getTools();
  }

  /**
   * Execute TypeScript/JavaScript code with access to MCP tools
   * @param {string} code - The code written by the LLM
   * @param {Object} options - Execution options
   * @returns {Promise<{success: boolean, output: string[], error?: string}>}
   */
  async executeCode(code, options = {}) {
    if (!this.connected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    // Handler for MCP calls from the sandbox
    const mcpHandler = async (methodName, args) => {
      return this.bridge.callTool(methodName, args);
    };

    // Execute the code in sandbox
    return this.sandbox.execute(code, mcpHandler, options);
  }

  /**
   * Helper method to show how an LLM would use this
   * Returns the context that should be provided to the LLM
   */
  getLLMContext() {
    const types = this.getTypeDefinitions();
    const tools = this.getTools();

    return `// Available MCP Tools
// You can call these tools using the 'mcp' object in your code.
// For example: const result = await mcp.toolName({ param: value });

${types}

// Available tools: ${tools.map(t => t.name).join(', ')}
// Write TypeScript/JavaScript code that uses these tools to accomplish the task.`;
  }
}

// Export the main class and utilities
module.exports = {
  MCPCodeMode,
  MCPBridge,
  CodeSandbox,
  IsolatedSandbox
};