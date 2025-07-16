#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

/**
 * Test script to verify DOM change detection functionality
 * Tests that after clicking the "Login to Shop" button, the agent page
 * is automatically regenerated with the new form fields visible
 */

class DOMChangeDetectionTest {
    constructor() {
        this.supapupProcess = null;
        this.testResults = [];
        this.ecommerceUrl = `file://${path.resolve(__dirname, 'examples/ecommerce/index.html')}`;
    }

    async runTest() {
        console.log('🚀 Starting DOM Change Detection Test');
        console.log('📄 Testing URL:', this.ecommerceUrl);
        
        try {
            // Start the Supapup MCP server
            await this.startSupapupServer();
            
            // Wait a moment for server to initialize
            await this.sleep(2000);
            
            // Test 1: Navigate to ecommerce page
            console.log('\n📍 Test 1: Navigate to ecommerce page');
            const initialPage = await this.sendMCPRequest('browser_navigate', {
                url: this.ecommerceUrl
            });
            
            this.logResult('Navigation', initialPage.success, 
                initialPage.success ? 'Successfully navigated to ecommerce page' : 'Failed to navigate');
            
            // Test 2: Generate initial agent page
            console.log('\n📊 Test 2: Generate initial agent page');
            const agentPageResponse = await this.sendMCPRequest('agent_generate_page', {});
            
            const initialElementCount = this.countElements(agentPageResponse.content);
            console.log(`   Initial elements found: ${initialElementCount}`);
            
            this.logResult('Initial Agent Page', agentPageResponse.success, 
                `Generated agent page with ${initialElementCount} elements`);
            
            // Test 3: Find and click the "Login to Shop" button
            console.log('\n🔘 Test 3: Click "Login to Shop" button');
            const loginButtonId = this.findElementId(agentPageResponse.content, 'Login to Shop');
            
            if (!loginButtonId) {
                this.logResult('Find Login Button', false, 'Could not find Login to Shop button');
                return;
            }
            
            console.log(`   Found login button ID: ${loginButtonId}`);
            
            // Execute the click action - this should trigger DOM changes and auto-regenerate the agent page
            const clickResponse = await this.sendMCPRequest('agent_execute_action', {
                actionId: loginButtonId,
                params: {}
            });
            
            // Test 4: Verify automatic agent page regeneration
            console.log('\n🔄 Test 4: Verify automatic agent page regeneration');
            
            if (clickResponse.success && clickResponse.content) {
                const updatedElementCount = this.countElements(clickResponse.content);
                console.log(`   Updated elements found: ${updatedElementCount}`);
                
                // Should go from 1 element to 13+ elements (form fields become visible)
                const elementsIncreased = updatedElementCount > initialElementCount;
                const hasFormFields = this.hasFormFields(clickResponse.content);
                
                this.logResult('Button Click', true, 'Successfully clicked Login to Shop button');
                this.logResult('DOM Change Detection', elementsIncreased, 
                    `Elements ${elementsIncreased ? 'increased' : 'did not increase'} from ${initialElementCount} to ${updatedElementCount}`);
                this.logResult('Form Fields Visible', hasFormFields, 
                    `Form fields ${hasFormFields ? 'are' : 'are not'} visible in agent page`);
                
                // Test 5: Verify specific form fields are present
                console.log('\n📝 Test 5: Verify specific form fields');
                const expectedFields = ['firstName', 'lastName', 'email', 'phone', 'password'];
                const foundFields = [];
                
                for (const field of expectedFields) {
                    const fieldId = this.findElementId(clickResponse.content, field, true);
                    if (fieldId) {
                        foundFields.push(field);
                    }
                }
                
                this.logResult('Form Fields Detection', foundFields.length === expectedFields.length,
                    `Found ${foundFields.length}/${expectedFields.length} expected form fields: ${foundFields.join(', ')}`);
                
            } else {
                this.logResult('Button Click', false, 'Failed to click Login to Shop button');
                this.logResult('DOM Change Detection', false, 'No response content to analyze');
            }
            
            // Print final test results
            this.printTestResults();
            
        } catch (error) {
            console.error('❌ Test failed with error:', error.message);
            this.logResult('Test Execution', false, error.message);
        } finally {
            // Clean up
            if (this.supapupProcess) {
                console.log('\n🔧 Cleaning up...');
                this.supapupProcess.kill();
            }
        }
    }
    
    async startSupapupServer() {
        console.log('🔧 Starting Supapup MCP server...');
        
        return new Promise((resolve, reject) => {
            // Build the project first
            const buildProcess = spawn('npm', ['run', 'build'], {
                cwd: __dirname,
                stdio: 'pipe'
            });
            
            buildProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Build failed with code ${code}`));
                    return;
                }
                
                // Start the server
                this.supapupProcess = spawn('node', ['dist/index.js'], {
                    cwd: __dirname,
                    stdio: 'pipe'
                });
                
                this.supapupProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('MCP server started')) {
                        resolve();
                    }
                });
                
                this.supapupProcess.stderr.on('data', (data) => {
                    console.error('Supapup error:', data.toString());
                });
                
                // Fallback timeout
                setTimeout(() => {
                    resolve();
                }, 3000);
            });
        });
    }
    
    async sendMCPRequest(tool, params) {
        return new Promise((resolve, reject) => {
            const request = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: `mcp__supapup__${tool}`,
                    arguments: params
                }
            };
            
            const requestStr = JSON.stringify(request) + '\n';
            
            let responseData = '';
            
            const onData = (data) => {
                responseData += data.toString();
                
                // Check if we have a complete JSON response
                try {
                    const lines = responseData.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        const response = JSON.parse(line);
                        if (response.id === request.id) {
                            this.supapupProcess.stdout.removeListener('data', onData);
                            
                            if (response.error) {
                                resolve({ success: false, error: response.error });
                            } else {
                                resolve({ success: true, content: response.result?.content });
                            }
                            return;
                        }
                    }
                } catch (e) {
                    // Not a complete JSON yet, continue listening
                }
            };
            
            this.supapupProcess.stdout.on('data', onData);
            this.supapupProcess.stdin.write(requestStr);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                this.supapupProcess.stdout.removeListener('data', onData);
                reject(new Error('Request timeout'));
            }, 10000);
        });
    }
    
    countElements(content) {
        if (!content || !Array.isArray(content)) return 0;
        
        for (const item of content) {
            if (item.type === 'text' && item.text) {
                // Count action items in the agent page
                const actionMatches = item.text.match(/- \*\*[^*]+\*\*:/g) || [];
                return actionMatches.length;
            }
        }
        return 0;
    }
    
    findElementId(content, searchTerm, partial = false) {
        if (!content || !Array.isArray(content)) return null;
        
        for (const item of content) {
            if (item.type === 'text' && item.text) {
                const lines = item.text.split('\n');
                for (const line of lines) {
                    if (line.includes('**') && line.includes(':')) {
                        const match = line.match(/- \*\*([^*]+)\*\*:/);
                        if (match) {
                            const actionId = match[1];
                            if (partial) {
                                if (actionId.toLowerCase().includes(searchTerm.toLowerCase())) {
                                    return actionId;
                                }
                            } else {
                                if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
                                    return actionId;
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }
    
    hasFormFields(content) {
        if (!content || !Array.isArray(content)) return false;
        
        for (const item of content) {
            if (item.type === 'text' && item.text) {
                const text = item.text.toLowerCase();
                return text.includes('form') && 
                       (text.includes('firstName') || text.includes('email') || text.includes('password'));
            }
        }
        return false;
    }
    
    logResult(testName, success, message) {
        const status = success ? '✅' : '❌';
        console.log(`   ${status} ${testName}: ${message}`);
        this.testResults.push({ testName, success, message });
    }
    
    printTestResults() {
        console.log('\n📋 Test Results Summary:');
        console.log('=' .repeat(50));
        
        let passed = 0;
        let total = this.testResults.length;
        
        for (const result of this.testResults) {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.testName}: ${result.message}`);
            if (result.success) passed++;
        }
        
        console.log('=' .repeat(50));
        console.log(`📊 Overall: ${passed}/${total} tests passed`);
        
        if (passed === total) {
            console.log('🎉 All tests passed! DOM change detection is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. DOM change detection may need attention.');
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
const test = new DOMChangeDetectionTest();
test.runTest().catch(console.error);