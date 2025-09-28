const fs = require('fs').promises;
const path = require('path');

/**
 * Maps errors back to original source code with helpful context
 */
class ErrorMapper {
  constructor() {
    this.sourceCache = new Map();
  }

  /**
   * Maps an error to the original source with context
   */
  mapError(error, code, types = '') {
    const result = {
      message: error.message,
      stack: error.stack,
      type: error.constructor.name
    };

    // Parse stack trace to find location
    const location = this.parseStackTrace(error.stack, code);

    if (location) {
      result.location = location;
      result.context = this.getCodeContext(code, location.line);
      result.suggestion = this.getSuggestion(error, code, location);
    }

    return result;
  }

  /**
   * Parse stack trace to find error location
   */
  parseStackTrace(stack, code) {
    if (!stack) return null;

    const lines = stack.split('\n');

    // Look for lines that reference user code
    for (const line of lines) {
      // Match patterns like "at <anonymous>:2:5" or "at user-code.js:10:15"
      const match = line.match(/at\s+(?:.*?)\s*[(<]?(?:.*?):(\d+):(\d+)/);

      if (match) {
        const lineNum = parseInt(match[1]);
        const column = parseInt(match[2]);

        // Verify this is within the user code bounds
        const codeLines = code.split('\n');
        if (lineNum > 0 && lineNum <= codeLines.length) {
          return {
            line: lineNum,
            column: column,
            code: codeLines[lineNum - 1]
          };
        }
      }
    }

    return null;
  }

  /**
   * Get code context around error
   */
  getCodeContext(code, errorLine, contextLines = 3) {
    const lines = code.split('\n');
    const start = Math.max(0, errorLine - contextLines - 1);
    const end = Math.min(lines.length, errorLine + contextLines);

    const context = [];

    for (let i = start; i < end; i++) {
      const lineNum = i + 1;
      const prefix = lineNum === errorLine ? '> ' : '  ';
      const line = lines[i];

      context.push({
        number: lineNum,
        text: line,
        isError: lineNum === errorLine
      });
    }

    return context;
  }

  /**
   * Generate helpful suggestions based on error type
   */
  getSuggestion(error, code, location) {
    const suggestions = [];
    const errorMessage = error.message.toLowerCase();

    // Type errors
    if (error.name === 'TypeError') {
      if (errorMessage.includes('is not a function')) {
        const match = error.message.match(/(\w+) is not a function/);
        if (match) {
          suggestions.push(`Check that '${match[1]}' is defined and is actually a function`);
          suggestions.push(`Did you mean to await an async function?`);
        }
      } else if (errorMessage.includes('cannot read')) {
        suggestions.push(`The object you're trying to access might be null or undefined`);
        suggestions.push(`Consider adding a null check: if (obj && obj.property)`);
      } else if (errorMessage.includes('is not iterable')) {
        suggestions.push(`Make sure you're trying to iterate over an array or iterable object`);
        suggestions.push(`Check if the value is an array: Array.isArray(value)`);
      }
    }

    // Reference errors
    if (error.name === 'ReferenceError') {
      const match = error.message.match(/(\w+) is not defined/);
      if (match) {
        const varName = match[1];

        // Check if it's an MCP tool
        if (code.includes(`mcp.${varName}`)) {
          suggestions.push(`'${varName}' is not a recognized MCP tool`);
          suggestions.push(`Check available tools with the listTools() method`);
        } else {
          suggestions.push(`'${varName}' is not defined. Did you forget to declare it?`);
          suggestions.push(`Check for typos in the variable name`);
        }
      }
    }

    // Syntax errors
    if (error.name === 'SyntaxError') {
      if (errorMessage.includes('unexpected token')) {
        suggestions.push(`Check for missing parentheses, brackets, or braces`);
        suggestions.push(`Ensure all strings are properly closed`);
      } else if (errorMessage.includes('await is only valid')) {
        suggestions.push(`Await can only be used inside async functions`);
        suggestions.push(`Make sure your code is wrapped in an async function`);
      }
    }

    // Timeout errors
    if (errorMessage.includes('timeout')) {
      suggestions.push(`The code execution exceeded the time limit`);
      suggestions.push(`Check for infinite loops or very slow operations`);
      suggestions.push(`Consider breaking the task into smaller chunks`);
    }

    // Memory errors
    if (errorMessage.includes('memory')) {
      suggestions.push(`The code exceeded memory limits`);
      suggestions.push(`Avoid creating very large arrays or objects`);
      suggestions.push(`Consider processing data in chunks`);
    }

    // MCP specific errors
    if (errorMessage.includes('mcp')) {
      if (errorMessage.includes('not found')) {
        suggestions.push(`The requested MCP tool doesn't exist`);
        suggestions.push(`Use only the tools provided in the TypeScript definitions`);
      } else if (errorMessage.includes('failed')) {
        suggestions.push(`The MCP tool call failed. Check your arguments`);
        suggestions.push(`Ensure the MCP server is running and responsive`);
      }
    }

    // Add line-specific context if available
    if (location && location.code) {
      const codeLine = location.code.trim();

      // Check for common patterns
      if (codeLine.includes('await') && !code.includes('async')) {
        suggestions.push(`You're using 'await' but the function might not be async`);
      }

      if (codeLine.includes('.map') || codeLine.includes('.filter')) {
        suggestions.push(`Make sure you're calling array methods on an actual array`);
      }

      if (codeLine.includes('mcp.') && !codeLine.includes('await')) {
        suggestions.push(`MCP tool calls are async - did you forget 'await'?`);
      }
    }

    return suggestions;
  }

  /**
   * Format error for display
   */
  formatError(mappedError) {
    const lines = [];

    // Main error message
    lines.push(`❌ ${mappedError.type}: ${mappedError.message}`);
    lines.push('');

    // Location if available
    if (mappedError.location) {
      lines.push(`📍 Location: line ${mappedError.location.line}, column ${mappedError.location.column}`);
      lines.push('');
    }

    // Code context
    if (mappedError.context) {
      lines.push('Code context:');
      lines.push('─'.repeat(50));

      for (const ctxLine of mappedError.context) {
        const marker = ctxLine.isError ? '→' : ' ';
        const lineNum = String(ctxLine.number).padStart(4);
        lines.push(`${marker} ${lineNum} | ${ctxLine.text}`);
      }

      lines.push('─'.repeat(50));
      lines.push('');
    }

    // Suggestions
    if (mappedError.suggestion && mappedError.suggestion.length > 0) {
      lines.push('💡 Suggestions:');
      for (const suggestion of mappedError.suggestion) {
        lines.push(`   • ${suggestion}`);
      }
      lines.push('');
    }

    // Stack trace (abbreviated)
    if (mappedError.stack) {
      lines.push('Stack trace:');
      const stackLines = mappedError.stack.split('\n').slice(1, 4);
      for (const line of stackLines) {
        lines.push(`  ${line.trim()}`);
      }
      if (mappedError.stack.split('\n').length > 4) {
        lines.push('  ...');
      }
    }

    return lines.join('\n');
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(error) {
    // Syntax errors are usually not recoverable
    if (error.name === 'SyntaxError') return false;

    // Memory/timeout errors might be recoverable with different inputs
    if (error.message.includes('memory') || error.message.includes('timeout')) {
      return true;
    }

    // Type and reference errors might be fixable
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return true;
    }

    return false;
  }
}

module.exports = ErrorMapper;