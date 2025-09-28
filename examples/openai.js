const MCPCodeMode = require('../index');
const https = require('https');

/**
 * Example: Using MCP Code Mode with OpenAI
 *
 * This shows how to integrate MCPCodeMode with OpenAI's API.
 * You bring your own LLM integration, the library handles the rest.
 */

async function callOpenAI(prompt, apiKey) {
  const payload = {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  };

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (res.statusCode !== 200) {
          reject(new Error(json.error?.message || data));
        } else {
          resolve(json.choices[0].message.content);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function main() {
  // 1. Initialize MCP Code Mode with your MCP server
  const mcp = new MCPCodeMode({
    command: 'node',
    args: ['path/to/your/mcp-server.js']
  });

  await mcp.connect();
  console.log('Connected to MCP server');

  // 2. Get the TypeScript context for your LLM
  const context = mcp.getContext();

  // 3. Create your prompt
  const task = "Check what song is currently playing";
  const fullPrompt = `${context}\n\nWrite code to: ${task}`;

  // 4. Call your LLM (you control this)
  const apiKey = process.env.OPENAI_API_KEY;
  const llmResponse = await callOpenAI(fullPrompt, apiKey);

  // 5. Extract code from LLM response
  const code = MCPCodeMode.extractCode(llmResponse);

  // 6. Execute the code
  const result = await mcp.execute(code);

  if (result.success) {
    console.log('Output:', result.output);
  } else {
    console.log('Error:', result.error);
  }

  await mcp.disconnect();
}

main().catch(console.error);