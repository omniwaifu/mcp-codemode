/**
 * MCP Bridge - Connects to MCP servers and generates TypeScript APIs
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { generateTypeScriptDefinitions, sanitizeName } = require('./schema-to-types.js');

class MCPBridge {
  constructor(serverConfig) {
    this.serverConfig = serverConfig;
    this.client = null;
    this.transport = null;
    this.tools = [];
    this.typeDefinitions = '';
  }

  /**
   * Connect to the MCP server
   */
  async connect() {
    if (this.client) {
      throw new Error('Already connected to MCP server');
    }

    const { command, args = [], env = {} } = this.serverConfig;

    // Create stdio transport
    this.transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env }
    });

    // Create client
    this.client = new Client({
      name: 'mcp-codemode',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Connect
    await this.client.connect(this.transport);

    // Get available tools
    const response = await this.client.listTools();
    this.tools = response.tools || [];

    // Generate TypeScript definitions
    this.typeDefinitions = generateTypeScriptDefinitions(this.tools);
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    this.tools = [];
    this.typeDefinitions = '';
  }

  /**
   * Get the generated TypeScript definitions
   */
  getTypeDefinitions() {
    return this.typeDefinitions;
  }

  /**
   * Get available tools
   */
  getTools() {
    return [...this.tools];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName, args) {
    if (!this.client) {
      throw new Error('Not connected to MCP server');
    }

    // Find the original tool name (before sanitization)
    const tool = this.tools.find(t =>
      sanitizeName(t.name) === toolName || t.name === toolName
    );

    if (!tool) {
      throw new Error(`Unknown MCP tool: ${toolName}`);
    }

    try {
      const result = await this.client.callTool({
        name: tool.name,
        arguments: args || {}
      });

      // Extract content from MCP response
      if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const content = result.content[0];

        // Handle text content
        if (typeof content === 'object' && 'text' in content) {
          try {
            // Try to parse as JSON
            return JSON.parse(content.text);
          } catch {
            // Return as text if not JSON
            return content.text;
          }
        }

        return content;
      }

      return null;
    } catch (error) {
      throw new Error(`MCP tool call failed: ${error.message}`);
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.client !== null;
  }
}

module.exports = { MCPBridge };