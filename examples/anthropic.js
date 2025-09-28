const MCPCodeMode = require('../index');
const https = require('https');

/**
 * Example: Using MCP Code Mode with Anthropic Claude
 *
 * Shows integration with Claude API.
 * The pattern is the same: you handle the LLM, library handles MCP.
 */

async function callClaude(prompt, apiKey) {
  const payload = {
    model: 'claude-3-haiku-20240307',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.3
  };

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (res.statusCode !== 200) {
          reject(new Error(json.error?.message || data));
        } else {
          resolve(json.content[0].text);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function main() {
  // 1. Connect to your MCP server
  const mcp = new MCPCodeMode({
    command: 'python',
    args: ['-m', 'your_mcp_server']
  });

  await mcp.connect();

  // 2. Build prompt with context
  const context = mcp.getContext();
  const task = "Find all playlists with 'rock' in the name";
  const prompt = `${context}\n\nTask: ${task}\n\nRespond with JavaScript code only.`;

  // 3. Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const response = await callClaude(prompt, apiKey);

  // 4. Extract and execute
  const code = MCPCodeMode.extractCode(response);
  const result = await mcp.execute(code);

  console.log('Result:', result);

  await mcp.disconnect();
}

main().catch(console.error);