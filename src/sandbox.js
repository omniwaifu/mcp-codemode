/**
 * Sandbox for executing TypeScript/JavaScript code with MCP access
 * Uses Node.js Worker Threads for isolation
 */

const { Worker } = require('worker_threads');

class CodeSandbox {
  /**
   * Execute code in an isolated Worker Thread
   * @param {string} code - The JavaScript/TypeScript code to execute
   * @param {Function} mcpHandler - Function to handle MCP tool calls
   * @param {Object} options - Execution options
   * @returns {Promise<{success: boolean, output: string[], error?: string}>}
   */
  async execute(code, mcpHandler, options = {}) {
    const timeoutMs = options.timeoutMs || 30000; // 30 seconds default
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Create worker code that sets up the environment
      const workerCode = `
        const { parentPort } = require('worker_threads');

        // Capture console output
        const logs = [];
        const originalConsole = { ...console };

        // Override console methods to capture output
        ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
          console[method] = (...args) => {
            const formatted = args.map(arg => {
              if (typeof arg === 'object') {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch (e) {
                  return '[object]';
                }
              }
              return String(arg);
            }).join(' ');
            logs.push(formatted);
          };
        });

        // Create MCP proxy object
        const mcp = new Proxy({}, {
          get: (target, prop) => {
            if (typeof prop === 'string') {
              return async (input) => {
                // Send MCP request to parent thread
                parentPort.postMessage({
                  type: 'mcp-call',
                  method: prop,
                  args: input
                });

                // Wait for response
                return new Promise((resolve, reject) => {
                  const handler = (msg) => {
                    if (msg.type === 'mcp-result' && msg.method === prop) {
                      parentPort.off('message', handler);
                      if (msg.error) {
                        reject(new Error(msg.error));
                      } else {
                        resolve(msg.result);
                      }
                    }
                  };
                  parentPort.on('message', handler);
                });
              };
            }
          }
        });

        // Make mcp available globally
        global.mcp = mcp;

        // Execute the user code
        (async () => {
          try {
            // Execute the code
            await (async function() {
              ${code}
            })();
          } catch (error) {
            logs.push('Error: ' + (error.stack || error.message || error));
          }

          // Send logs and exit
          parentPort.postMessage({
            type: 'complete',
            logs: logs
          });
        })();
      `;

      // Create worker with the code
      const worker = new Worker(workerCode, { eval: true });
      let completed = false;

      // Set timeout
      const timeout = setTimeout(() => {
        if (!completed) {
          worker.terminate();
          resolve({
            success: false,
            output: [],
            error: 'Execution timeout',
            executionTimeMs: timeoutMs
          });
        }
      }, timeoutMs);

      // Handle messages from worker
      worker.on('message', async (msg) => {
        if (msg.type === 'mcp-call') {
          // Execute MCP call in parent thread
          try {
            const result = await mcpHandler(msg.method, msg.args);
            worker.postMessage({
              type: 'mcp-result',
              method: msg.method,
              result: result
            });
          } catch (error) {
            worker.postMessage({
              type: 'mcp-result',
              method: msg.method,
              error: error.message
            });
          }
        } else if (msg.type === 'complete') {
          // Execution complete
          completed = true;
          clearTimeout(timeout);
          worker.terminate();
          resolve({
            success: true,
            output: msg.logs,
            executionTimeMs: Date.now() - startTime
          });
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        completed = true;
        clearTimeout(timeout);
        resolve({
          success: false,
          output: [],
          error: error.message,
          executionTimeMs: Date.now() - startTime
        });
      });

      // Handle worker exit
      worker.on('exit', (code) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          if (code !== 0) {
            resolve({
              success: false,
              output: [],
              error: `Worker exited with code ${code}`,
              executionTimeMs: Date.now() - startTime
            });
          }
        }
      });
    });
  }
}

module.exports = { CodeSandbox };