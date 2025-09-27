/**
 * Isolated V8 Sandbox using isolated-vm
 *
 * Provides true V8 isolation like Cloudflare Workers
 * with memory limits and CPU timeouts.
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
    // Use setSync with plain function - isolated-vm automatically creates Callback
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

    // Set up setTimeout for async support
    await jail.set('_setTimeout', (fn, delay) => {
      setTimeout(() => {
        fn.applyIgnored(undefined, []);
      }, delay);
    });

    // Bootstrap the environment
    await this.context.eval(`
      global.console = {
        log: (...args) => {
          _logSync.apply(undefined, args, { arguments: { copy: true } });
        },
        error: (...args) => {
          _logSync.apply(undefined, ['ERROR:', ...args], { arguments: { copy: true } });
        },
        warn: (...args) => {
          _logSync.apply(undefined, ['WARN:', ...args], { arguments: { copy: true } });
        }
      };

      global.setTimeout = (fn, delay) => {
        _setTimeout.apply(undefined, [fn, delay]);
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

      // Wrap code in async function to support await
      const wrappedCode = `
        (async () => {
          ${code}
        })();
      `;

      // Execute code and handle promise
      await this.context.eval(wrappedCode, {
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
          output: this.output,
          executionTimeMs
        };
      }

      // Handle memory limit
      if (error.message.includes('Isolate was disposed')) {
        // Isolate was killed due to memory limit
        this.isolate = null;
        this.context = null;
        return {
          success: false,
          error: `Memory limit exceeded (${this.memoryLimit}MB)`,
          output: this.output,
          executionTimeMs
        };
      }

      return {
        success: false,
        error: error.message,
        output: this.output,
        executionTimeMs
      };
    }
  }

  async setupMCPProxy(mcpHandler) {
    const jail = this.context.global;

    // Create async wrapper for MCP calls
    await jail.set('_mcpCallAsync', new ivm.Reference(async (toolName, args) => {
      try {
        const result = await mcpHandler(toolName, args);
        return result;
      } catch (error) {
        throw new Error(error.message);
      }
    }));

    // Create the MCP proxy in the sandbox
    await this.context.eval(`
      global.mcp = new Proxy({}, {
        get: (target, prop) => {
          return (args) => {
            return _mcpCallAsync.apply(undefined, [prop, args], {
              arguments: { copy: true },
              result: { promise: true, copy: true }
            });
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

  // Get memory usage statistics
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