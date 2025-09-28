const ts = require('typescript');
const fs = require('fs').promises;
const path = require('path');

class Validator {
  constructor() {
    this.compilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
      noImplicitAny: true,
      strictNullChecks: true,
      strictFunctionTypes: true,
      strictPropertyInitialization: true,
      noImplicitThis: true,
      alwaysStrict: true,
      skipLibCheck: true,
      allowJs: false,
      checkJs: false,
      esModuleInterop: true,
      resolveJsonModule: true,
      noLib: false
    };
  }

  /**
   * Validates TypeScript code against provided type definitions
   * @param {string} code - The TypeScript code to validate
   * @param {string} types - The TypeScript type definitions
   * @returns {Object} Result with success, output, and errors
   */
  validate(code, types) {
    // Combine types and code into a single source
    const fullSource = `
// Type definitions
${types}

// User code
${code}
`;

    // Use transpileModule which includes default libs
    const result = ts.transpileModule(fullSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        noImplicitAny: true,
        esModuleInterop: true,
        skipLibCheck: false,
        lib: ['es2020']
      },
      reportDiagnostics: true
    });

    // Check for errors in diagnostics
    if (result.diagnostics && result.diagnostics.length > 0) {
      const errors = this.formatDiagnostics(result.diagnostics, fullSource);
      return {
        success: false,
        errors,
        formattedErrors: this.formatErrorMessages(errors)
      };
    }

    // Extract just the user code part (skip type definitions)
    const jsCode = this.extractUserCode(result.outputText, types);

    return {
      success: true,
      output: jsCode,
      sourceMap: result.sourceMapText
    };
  }

  /**
   * Creates a virtual compiler host for in-memory compilation
   */
  createVirtualHost(source) {
    const files = new Map();
    files.set('virtual.ts', source);

    return {
      getSourceFile: (fileName) => {
        if (files.has(fileName)) {
          return ts.createSourceFile(
            fileName,
            files.get(fileName),
            ts.ScriptTarget.ES2020,
            true
          );
        }
        // Return undefined for lib files to use defaults
        return undefined;
      },
      writeFile: () => {},
      getCurrentDirectory: () => process.cwd(),
      getDirectories: () => [],
      fileExists: (fileName) => files.has(fileName),
      readFile: (fileName) => files.get(fileName),
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options)
    };
  }

  /**
   * Formats TypeScript diagnostics into readable error objects
   */
  formatDiagnostics(diagnostics, source) {
    const lines = source.split('\n');

    return diagnostics.map(diagnostic => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );

      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start
        );

        // Get the problematic line of code
        const codeLine = lines[line] || '';

        // Adjust line numbers to account for type definitions
        const userCodeStartLine = lines.findIndex(l => l.includes('// User code')) + 1;
        const adjustedLine = line - userCodeStartLine;

        return {
          message,
          line: adjustedLine,
          column: character,
          code: codeLine.trim(),
          severity: this.getSeverity(diagnostic.category)
        };
      }

      return {
        message,
        severity: this.getSeverity(diagnostic.category)
      };
    });
  }

  /**
   * Gets severity string from diagnostic category
   */
  getSeverity(category) {
    switch (category) {
      case ts.DiagnosticCategory.Error:
        return 'error';
      case ts.DiagnosticCategory.Warning:
        return 'warning';
      case ts.DiagnosticCategory.Suggestion:
        return 'suggestion';
      case ts.DiagnosticCategory.Message:
        return 'info';
      default:
        return 'unknown';
    }
  }

  /**
   * Formats error messages for display
   */
  formatErrorMessages(errors) {
    return errors.map(error => {
      let msg = `${error.severity.toUpperCase()}: ${error.message}`;

      if (error.line !== undefined) {
        msg += ` (line ${error.line + 1}, col ${error.column + 1})`;
      }

      if (error.code) {
        msg += `\n  > ${error.code}`;
      }

      return msg;
    }).join('\n\n');
  }

  /**
   * Extracts just the user code from transpiled output
   */
  extractUserCode(transpiledCode, types) {
    // Remove the type definitions part from the output
    // TypeScript transpiler comments them out but we want clean code
    const lines = transpiledCode.split('\n');
    const userCodeStart = lines.findIndex(l => l.includes('// User code'));

    if (userCodeStart !== -1) {
      return lines.slice(userCodeStart + 1).join('\n').trim();
    }

    // Fallback: return everything after first few lines
    return transpiledCode;
  }

  /**
   * Validates that code uses only allowed MCP tools
   */
  validateMCPUsage(code, availableTools) {
    const toolPattern = /mcp\.(\w+)\(/g;
    const usedTools = new Set();
    let match;

    while ((match = toolPattern.exec(code)) !== null) {
      usedTools.add(match[1]);
    }

    const invalidTools = Array.from(usedTools).filter(
      tool => !availableTools.includes(tool)
    );

    if (invalidTools.length > 0) {
      return {
        success: false,
        error: `Code uses undefined MCP tools: ${invalidTools.join(', ')}`
      };
    }

    return { success: true };
  }
}

module.exports = Validator;