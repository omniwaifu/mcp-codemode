/**
 * Converts MCP tool schemas to TypeScript type definitions
 * Following the Cloudflare approach of generating proper TypeScript interfaces
 */

function sanitizeName(name) {
  // Convert tool names to valid TypeScript identifiers
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function toPascalCase(str) {
  return str.split(/[-_]/).map(part =>
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  ).join('');
}

/**
 * Convert JSON Schema to TypeScript type
 */
function jsonSchemaToTypeScript(schema, indent = 0) {
  const spaces = ' '.repeat(indent);

  if (!schema) return 'unknown';

  // Handle anyOf/oneOf/allOf
  if (schema.anyOf) {
    return schema.anyOf.map(s => jsonSchemaToTypeScript(s, indent)).join(' | ');
  }
  if (schema.oneOf) {
    return schema.oneOf.map(s => jsonSchemaToTypeScript(s, indent)).join(' | ');
  }
  if (schema.allOf) {
    // For allOf, we'd need intersection types, simplify for now
    return jsonSchemaToTypeScript(schema.allOf[0], indent);
  }

  // Handle basic types
  switch (schema.type) {
    case 'string':
      if (schema.enum) {
        return schema.enum.map(v => `"${v}"`).join(' | ');
      }
      return 'string';

    case 'number':
    case 'integer':
      return 'number';

    case 'boolean':
      return 'boolean';

    case 'null':
      return 'null';

    case 'array':
      const itemType = schema.items
        ? jsonSchemaToTypeScript(schema.items, indent)
        : 'unknown';
      return `${itemType}[]`;

    case 'object':
      if (!schema.properties) {
        // Generic object
        if (schema.additionalProperties === false) {
          return '{}';
        }
        return 'Record<string, unknown>';
      }

      // Build interface properties
      const props = Object.entries(schema.properties).map(([key, propSchema]) => {
        const required = schema.required?.includes(key) ?? false;
        const optionalMark = required ? '' : '?';
        const description = propSchema.description;

        // Add JSDoc comment if description exists
        const comment = description
          ? `${spaces}  /**\n${spaces}   * ${description.replace(/\n/g, `\n${spaces}   * `)}\n${spaces}   */\n`
          : '';

        const propType = jsonSchemaToTypeScript(propSchema, indent + 2);
        return `${comment}${spaces}  ${key}${optionalMark}: ${propType};`;
      }).join('\n');

      // Handle additionalProperties
      let additionalProps = '';
      if (schema.additionalProperties && schema.additionalProperties !== false) {
        const additionalType = typeof schema.additionalProperties === 'object'
          ? jsonSchemaToTypeScript(schema.additionalProperties, indent + 2)
          : 'unknown';
        additionalProps = `\n${spaces}  [key: string]: ${additionalType};`;
      }

      return `{\n${props}${additionalProps}\n${spaces}}`;

    default:
      return 'unknown';
  }
}

/**
 * Generate TypeScript definitions from MCP tools
 */
function generateTypeScriptDefinitions(tools) {
  const interfaces = [];
  const toolMethods = [];

  for (const tool of tools) {
    const safeName = sanitizeName(tool.name);
    const pascalName = toPascalCase(tool.name);

    // Generate input interface
    const inputInterfaceName = `${pascalName}Input`;
    const inputSchema = tool.inputSchema || { type: 'object', properties: {} };
    const inputType = jsonSchemaToTypeScript(inputSchema);

    interfaces.push(`interface ${inputInterfaceName} ${inputType}`);

    // Generate output interface (MCP doesn't provide output schemas, so we use a generic type)
    const outputInterfaceName = `${pascalName}Output`;
    interfaces.push(`interface ${outputInterfaceName} {\n  [key: string]: any;\n}`);

    // Generate method signature with JSDoc
    const description = tool.description
      ? `  /**\n   * ${tool.description.replace(/\n/g, '\n   * ')}\n   */\n`
      : '';

    toolMethods.push(
      `${description}  ${safeName}: (\n    input: ${inputInterfaceName}\n  ) => Promise<${outputInterfaceName}>;`
    );
  }

  // Build the complete TypeScript declaration
  const typeDefinitions = `// TypeScript definitions for MCP tools
${interfaces.join('\n\n')}

declare const mcp: {
${toolMethods.join('\n\n')}
};`;

  return typeDefinitions;
}

module.exports = {
  generateTypeScriptDefinitions,
  jsonSchemaToTypeScript,
  sanitizeName,
  toPascalCase
};