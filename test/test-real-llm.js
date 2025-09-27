#!/usr/bin/env node
/**
 * MCP Code Mode - Real LLM Integration Test
 *
 * This demonstrates ACTUAL LLM integration where a real LLM API
 * generates code based on the TypeScript definitions.
 *
 * Supports multiple LLM providers via environment variables.
 */

const { MCPCodeMode } = require('../index.js');
const path = require('path');
const https = require('https');

/**
 * Call an LLM API to generate code
 * Supports OpenAI, Anthropic, or any OpenAI-compatible endpoint
 */
async function callLLM(prompt, apiKey, apiEndpoint = 'https://api.openai.com', model = 'gpt-3.5-turbo') {
  const isAnthropic = apiEndpoint.includes('anthropic');

  const payload = isAnthropic ? {
    model: model || 'claude-3-haiku-20240307',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000
  } : {
    model: model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant that writes JavaScript code. Respond ONLY with code, no explanations or markdown.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3
  };

  const url = new URL(isAnthropic ? `${apiEndpoint}/v1/messages` : `${apiEndpoint}/v1/chat/completions`);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isAnthropic ? {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        } : {
          'Authorization': `Bearer ${apiKey}`
        })
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(`API error: ${json.error?.message || data}`));
            return;
          }
          const content = isAnthropic ?
            json.content[0].text :
            json.choices[0].message.content;

          // Extract code from response (remove markdown if present)
          const code = content
            .replace(/```javascript\n?/g, '')
            .replace(/```js\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          resolve(code);
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function runTest() {
  console.log('🚀 MCP Code Mode - Real LLM Integration Test\n');
  console.log('=' .repeat(60) + '\n');

  // Check for API configuration
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
  const apiEndpoint = process.env.LLM_API_ENDPOINT ||
    (process.env.ANTHROPIC_API_KEY ? 'https://api.anthropic.com' : 'https://api.openai.com');
  const model = process.env.LLM_MODEL ||
    (process.env.ANTHROPIC_API_KEY ? 'claude-3-haiku-20240307' : 'gpt-3.5-turbo');

  if (!apiKey) {
    console.log('❌ No LLM API key found!\n');
    console.log('Please set one of the following environment variables:');
    console.log('  - OPENAI_API_KEY (for OpenAI)');
    console.log('  - ANTHROPIC_API_KEY (for Anthropic Claude)');
    console.log('  - LLM_API_KEY (for custom endpoints)\n');
    console.log('Optional:');
    console.log('  - LLM_API_ENDPOINT (default: OpenAI or Anthropic based on key)');
    console.log('  - LLM_MODEL (default: gpt-3.5-turbo or claude-3-haiku)\n');
    console.log('Example:');
    console.log('  OPENAI_API_KEY=sk-... node test/test-real-llm.js');
    console.log('  ANTHROPIC_API_KEY=sk-ant-... node test/test-real-llm.js\n');
    process.exit(1);
  }

  console.log(`📡 Using LLM: ${model} at ${apiEndpoint}\n`);

  const codeMode = new MCPCodeMode({
    command: 'uv',
    args: ['run', 'spotify-plus-mcp'],
    env: {
      PYTHONPATH: path.resolve(__dirname, '../../spotify-plus-mcp')
    }
  });

  try {
    console.log('Connecting to Spotify MCP server...');
    await codeMode.connect();
    console.log('✅ Connected!\n');

    // Get TypeScript definitions
    const typeDefinitions = codeMode.getTypeDefinitions();

    // Test different tasks
    const tasks = [
      {
        name: "Get current playback",
        prompt: "Check what song is currently playing and show its progress"
      },
      {
        name: "Smart skip",
        prompt: "Skip the current song if it's been playing for more than 45 seconds"
      },
      {
        name: "Playlist analysis",
        prompt: "Find all playlists that have 'rock' or 'metal' in the name and count total tracks"
      },
      {
        name: "Complex workflow",
        prompt: "Search for the artist 'The Beatles', get their top 5 tracks, and add the most popular one to the queue"
      }
    ];

    for (const task of tasks) {
      console.log('=' .repeat(60));
      console.log(`TASK: ${task.name}`);
      console.log('=' .repeat(60) + '\n');
      console.log(`📝 Prompt: "${task.prompt}"\n`);

      // Build the full prompt for the LLM
      const fullPrompt = `Here are the available MCP tools as TypeScript APIs:

${typeDefinitions}

Write JavaScript code to accomplish this task: ${task.prompt}

Important:
- Use the 'mcp' object to call tools (e.g., await mcp.SpotifyPlayback({...}))
- Use console.log to show results
- Handle edge cases appropriately
- Write ONLY code, no explanations`;

      console.log('🤖 Calling LLM to generate code...\n');

      try {
        // Get code from LLM
        const generatedCode = await callLLM(fullPrompt, apiKey, apiEndpoint, model);

        console.log('Generated code:');
        console.log('```javascript');
        console.log(generatedCode);
        console.log('```\n');

        // Execute the generated code
        console.log('📊 Execution result:');
        console.log('-' .repeat(40));

        const result = await codeMode.executeCode(generatedCode);

        if (result.success) {
          result.output.forEach(line => console.log('  ', line));
        } else {
          console.log('❌ Execution error:', result.error);
        }

        console.log('-' .repeat(40) + '\n');

      } catch (error) {
        console.log('❌ LLM Error:', error.message, '\n');
      }

      // Small delay between tasks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('=' .repeat(60));
    console.log('✅ Test Complete!');
    console.log('=' .repeat(60) + '\n');

    console.log('Key Takeaways:');
    console.log('1. The LLM naturally writes JavaScript code using TypeScript types');
    console.log('2. Complex logic and error handling emerge naturally');
    console.log('3. No need for multiple round-trips or state management');
    console.log('4. The LLM leverages its training on millions of code examples\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await codeMode.disconnect();
    console.log('👋 Disconnected from MCP server');
  }
}

// Run from spotify directory for auth
if (require.main === module) {
  if (process.cwd().endsWith('mcp-codemode')) {
    process.chdir(path.resolve(__dirname, '../../spotify-plus-mcp'));
  }
  runTest().catch(console.error);
}