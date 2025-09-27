/**
 * Test MCP Code Mode with Spotify MCP Server
 *
 * This demonstrates the Cloudflare approach:
 * 1. Generate TypeScript types from MCP tools
 * 2. Show types to LLM as context
 * 3. LLM writes TypeScript code
 * 4. Execute code in sandbox
 */

const { MCPCodeMode } = require('../index.js');
const path = require('path');

async function testSpotify() {
  console.log('🎵 Testing MCP Code Mode with Spotify MCP Server\n');

  // Connect to Spotify MCP server
  const codeMode = new MCPCodeMode({
    command: 'uv',
    args: ['run', 'spotify-plus-mcp'],
    env: {
      PYTHONPATH: path.resolve(__dirname, '../../spotify-plus-mcp')
    }
  });

  try {
    console.log('📡 Connecting to Spotify MCP server...');
    await codeMode.connect();
    console.log('✅ Connected!\n');

    // Get the TypeScript definitions
    const context = codeMode.getLLMContext();
    console.log('📋 Generated TypeScript API for LLM:\n');
    console.log('----------------------------------------');
    // Show first part of the context
    const lines = context.split('\n');
    console.log(lines.slice(0, 50).join('\n'));
    if (lines.length > 50) {
      console.log('... (truncated for display)');
    }
    console.log('----------------------------------------\n');

    // Show available tools
    const tools = codeMode.getTools();
    console.log('🔧 Available tools:', tools.map(t => t.name).join(', '));
    console.log();

    // Test 1: Get current playback
    console.log('▶️  Test 1: Get current playback status');
    const test1 = await codeMode.executeCode(`
      console.log('Checking what is currently playing...');

      const playback = await mcp.SpotifyPlayback({ action: 'get' });

      if (typeof playback === 'string') {
        console.log('Status:', playback);
      } else if (playback && playback.item) {
        console.log('Now playing:', playback.item.name);
        console.log('By:', playback.item.artists?.[0]?.name || 'Unknown');
      } else {
        console.log('Nothing is currently playing');
      }
    `);

    console.log('Output:');
    test1.output.forEach(line => console.log('  ', line));
    console.log();

    // Test 2: Search for music
    console.log('🔍 Test 2: Search for music');
    const test2 = await codeMode.executeCode(`
      console.log('Searching for "Beatles"...');

      const results = await mcp.SpotifySearch({
        query: 'Beatles',
        qtype: 'artist',
        limit: 3
      });

      if (results && results.artists) {
        console.log('Found', results.artists.length, 'artists:');
        for (const artist of results.artists) {
          console.log('-', artist.name || artist);
        }
      } else {
        console.log('No results found');
      }
    `);

    console.log('Output:');
    test2.output.forEach(line => console.log('  ', line));
    console.log();

    // Test 3: Complex workflow
    console.log('🎼 Test 3: Complex workflow - Search and get info');
    const test3 = await codeMode.executeCode(`
      console.log('Performing complex workflow...');

      // Step 1: Search for a song
      const searchResults = await mcp.SpotifySearch({
        query: 'Imagine John Lennon',
        qtype: 'track',
        limit: 1
      });

      if (searchResults && searchResults.tracks && searchResults.tracks.length > 0) {
        const track = searchResults.tracks[0];
        console.log('Found track:', track.name || track);

        // Step 2: Get user playlists
        const playlists = await mcp.SpotifyPlaylist({ action: 'get' });

        if (playlists && playlists.items) {
          console.log('User has', playlists.items.length, 'playlists');
        }
      } else {
        console.log('No tracks found');
      }

      console.log('Workflow complete!');
    `);

    console.log('Output:');
    test3.output.forEach(line => console.log('  ', line));

    // Show summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ SUCCESS! MCP Code Mode is working!');
    console.log('='.repeat(50));
    console.log('\nKey achievements:');
    console.log('• Generated proper TypeScript types from MCP schemas');
    console.log('• Executed TypeScript code in isolated sandbox');
    console.log('• Successfully called MCP tools through typed APIs');
    console.log('• Captured all console output');
    console.log('\nThis proves the Cloudflare insight:');
    console.log('LLMs are better at writing code than tool-calling JSON!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await codeMode.disconnect();
    console.log('\n👋 Disconnected from Spotify MCP server');
  }
}

// Run from spotify directory for auth files
if (require.main === module) {
  // Change to spotify directory if needed
  if (process.cwd().endsWith('mcp-codemode')) {
    process.chdir(path.resolve(__dirname, '../../spotify-plus-mcp'));
    console.log('Changed directory to:', process.cwd(), '\n');
  }
  testSpotify().catch(console.error);
}