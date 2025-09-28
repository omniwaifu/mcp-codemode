
const MCPBridge = require('./src/mcp-bridge');
const IsolatedSandbox = require('./src/isolated-sandbox');
const Validator = require('./src/validator');
const ErrorMapper = require('./src/error-mapper');

class MCPCodeMode {
  constructor(serverConfig, options = {}) {
    this.bridge = new MCPBridge(serverConfig);

    this.sandbox = new IsolatedSandbox({
      memoryLimit: options.memoryLimit || 128,
      timeout: options.timeout || 5000
    });

    this.validateTypes = options.validateTypes !== false;
    this.validator = this.validateTypes ? new Validator() : null;
    this.errorMapper = new ErrorMapper();

    this.connected = false;
    this.typeDefinitions = '';
    this.availableTools = [];
  }

  async connect() {
    await this.bridge.connect();
    this.typeDefinitions = this.bridge.getTypeDefinitions();
    this.availableTools = this.bridge.getTools().map(t => t.name);
    this.connected = true;
  }

  async disconnect() {
    await this.bridge.disconnect();
    if (this.sandbox && this.sandbox.dispose) {
      await this.sandbox.dispose();
    }
    this.connected = false;
  }

  getTypeDefinitions() {
    return this.bridge.getTypeDefinitions();
  }

  getTools() {
    return this.bridge.getTools();
  }

  async executeCode(code, options = {}) {
    if (!this.connected) {
      throw new Error('Not connected to MCP server. Call connect() first.');
    }

    let processedCode = code;
    let validationResult = null;

    if (this.validateTypes && !options.skipValidation) {
      validationResult = this.validator.validate(code, this.typeDefinitions);

      if (!validationResult.success) {
        return {
          success: false,
          error: 'TypeScript validation failed',
          validationErrors: validationResult.formattedErrors,
          output: []
        };
      }

      processedCode = validationResult.output;

      const mcpValidation = this.validator.validateMCPUsage(processedCode, this.availableTools);
      if (!mcpValidation.success) {
        return {
          success: false,
          error: mcpValidation.error,
          output: []
        };
      }
    }

    const mcpHandler = async (methodName, args) => {
      return this.bridge.callTool(methodName, args);
    };

    let result;
    try {
      result = await this.sandbox.execute(processedCode, mcpHandler, options);
    } catch (error) {
      const mappedError = this.errorMapper.mapError(error, code, this.typeDefinitions);
      return {
        success: false,
        error: this.errorMapper.formatError(mappedError),
        rawError: error.message,
        output: [],
        debugging: mappedError
      };
    }

    if (validationResult && validationResult.sourceMap) {
      result.sourceMap = validationResult.sourceMap;
    }

    return result;
  }

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

  // Alias for better API
  getContext() {
    return this.getLLMContext();
  }

  // Alias for cleaner API
  async execute(code, options) {
    return this.executeCode(code, options);
  }

  /**
   * Static utility to extract code from LLM responses
   * Handles markdown code blocks and various LLM response formats
   */
  static extractCode(llmResponse) {
    if (!llmResponse) return '';

    // Try to extract from markdown code block
    const codeBlockMatch = llmResponse.match(/```(?:javascript|js|typescript|ts)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // No code block found, return trimmed response
    // (assumes the entire response is code)
    return llmResponse.trim();
  }
}

module.exports = MCPCodeMode;