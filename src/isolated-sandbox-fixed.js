/**
 * Isolated V8 Sandbox using isolated-vm - FIXED VERSION
 */

const ivm = require('isolated-vm');

class IsolatedSandbox {
  constructor(options = {}) {
    this.memoryLimit = options.memoryLimit || 128; // MB
    this.timeout = options.timeout || 5000; // ms
    this.isolate = null;
    this.context = null;
  }

  async initialize() {
    // Create isolate with memory limit
    this.isolate = new ivm.Isolate({
      memoryLimit: this.memoryLimit
    });

    // Create context
    this.context = await this.isolate.createContext();

    // Get global object
    const jail = this.context.global;

    // Set up global
    await jail.set('global', jail.derefInto());

    // Set up console.log collecting output
    this.logs = [];
    await jail.set('_logSync', (...args) => {
      const message = args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg);
          } catch {
            return '[Object]';
          }
        }
        return String(arg);
      }).join(' ');
      this.logs.push(message);
    });

    // Bootstrap the environment
    await this.context.eval(`
      global.console = {
        log: (...args) => {
          _logSync(...args);
        },
        error: (...args) => {
          _logSync('ERROR:', ...args);
        },
        warn: (...args) => {
          _logSync('WARN:', ...args);
        }
      };
    `);
  }

  async execute(code, mcpHandler) {
    if (!this.isolate || !this.context) {
      await this.initialize();
    }

    this.logs = [];
    const startTime = Date.now();

    try {
      // Set up MCP proxy if provided
      if (mcpHandler) {
        await this.setupMCPProxy(mcpHandler);
      }

      // Execute code directly and capture result
      await this.context.eval(code, {
        timeout: this.timeout
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        output: this.logs,
        executionTimeMs
      };

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      // Handle timeout specifically
      if (error.message.includes('Script execution timed out')) {
        return {
          success: false,
          error: `Execution timeout (${this.timeout}ms exceeded)`,
          output: this.logs,
          executionTimeMs
        };
      }

      // Handle memory limit
      if (error.message.includes('Isolate was disposed')) {
        this.isolate = null;
        this.context = null;
        return {
          success: false,
          error: `Memory limit exceeded (${this.memoryLimit}MB)`,
          output: this.logs,
          executionTimeMs
        };
      }

      return {
        success: false,
        error: error.message,
        output: this.logs,
        executionTimeMs
      };
    }
  }

  async setupMCPProxy(mcpHandler) {
    const jail = this.context.global;

    // Create async wrapper for MCP calls
    await jail.set('_mcpCallAsync', async (toolName, args) => {
      try {
        const result = await mcpHandler(toolName, args);
        return result;
      } catch (error) {
        throw new Error(error.message);
      }
    });

    // Create the MCP proxy in the sandbox
    await this.context.eval(`
      global.mcp = new Proxy({}, {
        get: (target, prop) => {
          return (args) => {
            return _mcpCallAsync(prop, args);
          };
        }
      });
    `);
  }

  async dispose() {
    if (this.context) {
      this.context.release();
      this.context = null;
    }
    if (this.isolate) {
      this.isolate.dispose();
      this.isolate = null;
    }
  }

  async getMemoryUsage() {
    if (!this.isolate) return null;

    const heap = await this.isolate.getHeapStatistics();
    return {
      used: Math.round(heap.used_heap_size / 1024 / 1024),
      total: Math.round(heap.total_heap_size / 1024 / 1024),
      limit: this.memoryLimit
    };
  }
}

module.exports = { IsolatedSandbox };