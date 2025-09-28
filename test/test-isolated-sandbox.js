/**
 * Test the isolated-vm sandbox implementation
 */

const IsolatedSandbox = require('../src/isolated-sandbox.js');

async function testBasicExecution() {
  console.log('Testing basic code execution...');
  const sandbox = new IsolatedSandbox();

  const result = await sandbox.execute(`
    console.log('Hello from isolated sandbox!');
    const sum = 5 + 3;
    console.log('5 + 3 =', sum);
  `);

  console.log('Result:', result);
  await sandbox.dispose();
}

async function testMemoryLimit() {
  console.log('\nTesting memory limit...');
  const sandbox = new IsolatedSandbox({ memoryLimit: 8 }); // 8MB limit

  const result = await sandbox.execute(`
    console.log('Attempting to allocate large array...');
    const bigArray = [];
    for (let i = 0; i < 1000000; i++) {
      bigArray.push(new Array(100).fill('x'.repeat(100)));
    }
    console.log('This should not print');
  `);

  console.log('Result:', result);
  await sandbox.dispose();
}

async function testTimeout() {
  console.log('\nTesting execution timeout...');
  const sandbox = new IsolatedSandbox({ timeout: 100 }); // 100ms timeout

  const result = await sandbox.execute(`
    console.log('Starting infinite loop...');
    while (true) {
      // Infinite loop
    }
    console.log('This should not print');
  `);

  console.log('Result:', result);
  await sandbox.dispose();
}

async function testMCPProxy() {
  console.log('\nTesting MCP proxy...');
  const sandbox = new IsolatedSandbox();

  // Mock MCP handler
  const mcpHandler = async (toolName, args) => {
    console.log(`  MCP Call: ${toolName}`, args);
    return { result: `Mocked response for ${toolName}` };
  };

  const result = await sandbox.execute(`
    console.log('Calling MCP tool...');
    const result = await mcp.testTool({ param: 'value' });
    console.log('MCP Result:', result);
  `, mcpHandler);

  console.log('Result:', result);
  await sandbox.dispose();
}

async function testAsyncCode() {
  console.log('\nTesting async/await code...');
  const sandbox = new IsolatedSandbox();

  const result = await sandbox.execute(`
    async function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    console.log('Starting async operation...');
    await delay(10);
    console.log('Async operation completed!');
  `);

  console.log('Result:', result);
  await sandbox.dispose();
}

async function testMemoryUsage() {
  console.log('\nTesting memory usage tracking...');
  const sandbox = new IsolatedSandbox({ memoryLimit: 128 });

  await sandbox.execute(`
    const data = new Array(1000).fill('x'.repeat(1000));
    console.log('Allocated some memory');
  `);

  const memoryUsage = await sandbox.getMemoryUsage();
  console.log('Memory usage:', memoryUsage);

  await sandbox.dispose();
}

async function runAllTests() {
  console.log('=' .repeat(60));
  console.log('Isolated Sandbox Tests');
  console.log('=' .repeat(60) + '\n');

  try {
    await testBasicExecution();
    await testMemoryLimit();
    await testTimeout();
    await testMCPProxy();
    await testAsyncCode();
    await testMemoryUsage();

    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests completed!');
    console.log('=' .repeat(60));
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

if (require.main === module) {
  runAllTests().catch(console.error);
}