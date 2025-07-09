import { Page, CDPSession } from 'puppeteer';

export class DebuggingTools {
  private page: Page;
  private pausedParams: any = null;
  private client: CDPSession | null = null;
  private pausedHandler: (params: any) => void = () => {};

  constructor(page: Page) {
    this.page = page;
    this.initializeCDP();
  }

  private async initializeCDP() {
    try {
      // Create proper CDP session
      this.client = await this.page.target().createCDPSession();
      
      // Enable debugger domain
      await this.client.send('Debugger.enable');
      
      // Store handler for cleanup
      this.pausedHandler = (params: any) => {
        this.pausedParams = params;
        const callFrame = params.callFrames[0];
        // console.error(`🛑 Breakpoint hit at ${callFrame.url}:${callFrame.location.lineNumber}`);
        // console.error(`📍 Function: ${callFrame.functionName || 'anonymous'}`);
        // console.error(`🔍 Reason: ${params.reason}`);
      };
      
      // Handle debugger paused events
      this.client.on('Debugger.paused', this.pausedHandler);
    } catch (err) {
      // console.error('[DebuggingTools] CDP initialization error:', err);
    }
  }

  // Cleanup method to remove event listeners and close CDP session
  public async cleanup() {
    if (this.client) {
      if (this.pausedHandler) {
        this.client.off('Debugger.paused', this.pausedHandler);
      }
      try {
        await this.client.detach();
      } catch (err) {
        // Ignore cleanup errors
      }
      this.client = null;
    }
  }

  async setBreakpoint(args: any) {
    try {
      const { lineNumber, url = '', condition } = args;
      
      await this.page.evaluate(() => {
        if (!(window as any).chrome?.runtime) {
          (window as any).chrome = { runtime: {} };
        }
      });

      if (!this.client) throw new Error('CDP session not initialized');
      // Debugger already enabled in constructor

      // Build location object according to CDP spec
      const location: any = {
        lineNumber: lineNumber - 1,
        columnNumber: 0
      };

      if (url && url !== 'inline') {
        // Use setBreakpointByUrl for URL-based breakpoints
        const result = await this.client.send('Debugger.setBreakpointByUrl', {
          lineNumber: lineNumber - 1,
          url: url,
          columnNumber: 0,
          condition: condition
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `🎯 Breakpoint set!\n\n` +
                    `📍 Location: ${url}:${lineNumber}\n` +
                    `🆔 ID: ${result.breakpointId}\n` +
                    `⚡ Condition: ${condition || 'none'}\n`
            },
          ],
        };
      } else {
        // For inline scripts, we need to wait for the script to be parsed and use its scriptId
        // First, enable script parsing events
        await this.client.send('Debugger.enable');
        
        // Get all parsed scripts
        const scripts: any[] = [];
        this.client.on('Debugger.scriptParsed', (params) => {
          scripts.push(params);
        });
        
        // Force a page evaluation to ensure scripts are parsed
        await this.page.evaluate(() => { /* Force script parsing */ });
        
        // Try using setBreakpointByUrl with the current page URL
        // This should work for inline scripts in HTML files
        const currentUrl = await this.page.url();
        
        try {
          const result = await this.client.send('Debugger.setBreakpointByUrl', {
            lineNumber: lineNumber - 1,
            url: currentUrl,
            urlRegex: undefined,
            scriptHash: undefined,
            columnNumber: 0,
            condition: condition
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `🎯 Breakpoint set!\n\n` +
                      `📍 Location: ${currentUrl}:${lineNumber}\n` +
                      `🆔 ID: ${result.breakpointId}\n` +
                      `📌 Locations: ${result.locations?.length || 0} resolved\n` +
                      `⚡ Condition: ${condition || 'none'}\n\n` +
                      `⚠️ Note: For inline scripts, ensure line numbers are correct relative to the HTML file.`
              },
            ],
          };
        } catch (error) {
          // If that fails, provide helpful error message
          throw new Error(
            `Failed to set breakpoint for inline script at line ${lineNumber}. ` +
            `This is a Chrome DevTools Protocol limitation. ` +
            `Consider moving your script to an external file or ensure the line number is correct.`
          );
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to set breakpoint: ${error.message}`);
    }
  }

  async removeBreakpoint(args: any) {
    try {
      const { breakpointId } = args;
      if (!this.client) throw new Error('CDP session not initialized');
      
      await this.client.send('Debugger.removeBreakpoint', { breakpointId });

      return {
        content: [
          {
            type: 'text',
            text: `🗑️ Breakpoint ${breakpointId} removed`
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to remove breakpoint: ${error.message}`);
    }
  }

  async debugContinue() {
    try {
      if (!this.client) throw new Error('CDP session not initialized');
      await this.client.send('Debugger.resume');
      this.pausedParams = null;

      return {
        content: [
          {
            type: 'text',
            text: '▶️ Execution resumed\n✅ Breakpoints cleaned up'
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to continue execution: ${error.message}`);
    }
  }

  async debugStepOver() {
    try {
      if (!this.client) throw new Error('CDP session not initialized');
      await this.client.send('Debugger.stepOver');

      return {
        content: [
          {
            type: 'text',
            text: '👉 Stepped over to next line'
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to step over: ${error.message}`);
    }
  }

  async debugStepInto() {
    try {
      if (!this.client) throw new Error('CDP session not initialized');
      await this.client.send('Debugger.stepInto');

      return {
        content: [
          {
            type: 'text',
            text: '🔍 Stepped into function'
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to step into: ${error.message}`);
    }
  }

  async debugEvaluate(args: any) {
    try {
      const { expression } = args;
      if (!this.client) throw new Error('CDP session not initialized');
      
      const { result } = await this.client.send('Runtime.evaluate', {
        expression,
        contextId: this.pausedParams?.callFrames[0]?.callFrameId
      });

      const value = result.value !== undefined ? result.value : result.description;

      return {
        content: [
          {
            type: 'text',
            text: `🔍 Evaluation Result:\n\n` +
                  `📝 Expression: ${expression}\n` +
                  `📊 Result: ${JSON.stringify(value, null, 2)}\n` +
                  `🏷️ Type: ${(result as any).type || 'unknown'}`
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
  }

  async debugGetVariables() {
    try {
      if (!this.pausedParams) {
        throw new Error('Not currently paused in debugger');
      }

      if (!this.client) throw new Error('CDP session not initialized');
      const callFrame = this.pausedParams.callFrames[0];
      const { functionName, location } = callFrame;
      
      const variables: any = {};
      for (const scope of callFrame.scopeChain) {
        const { result } = await this.client.send('Runtime.getProperties', {
          objectId: scope.object.objectId
        });
        
        result.forEach((prop: any) => {
          if (prop.value) {
            variables[prop.name] = prop.value.value || prop.value.description;
          }
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: `🐛 Debug Context:\n\n` +
                  `📍 Location: ${callFrame.url}:${location.lineNumber + 1}\n` +
                  `🔍 Function: ${functionName}\n\n` +
                  `📊 Local Variables:\n${JSON.stringify(variables, null, 2)}\n\n`
          },
        ],
      };
    } catch (error: any) {
      throw new Error(`Failed to get variables: ${error.message}`);
    }
  }

  async debugFunction(args: any) {
    try {
      const { lineNumber, triggerAction } = args;
      
      // Get current page URL for breakpoint
      const url = await this.page.url();
      
      // Set breakpoint with URL
      const breakpointResult = await this.setBreakpoint({ lineNumber, url });
      const breakpointId = breakpointResult.content[0].text.match(/🆔 ID: ([^\n]+)/)?.[1];
      
      // Try to trigger the action if provided
      let actionToTrigger = triggerAction;
      if (!actionToTrigger) {
        const actions = await this.page.evaluate(() => {
          const agentPage = (window as any).__AGENT_PAGE__;
          return agentPage?.manifest?.elements?.map((el: any) => el.id) || [];
        });
        actionToTrigger = actions[0] || 'click-first-button';
      }

      // Execute action and wait for breakpoint
      const actionPromise = this.page.evaluate((actionId) => {
        const agentPage = (window as any).__AGENT_PAGE__;
        if (agentPage?.execute) {
          return agentPage.execute(actionId, {});
        }
        return null;
      }, actionToTrigger);

      // Wait for debugger to pause or action to complete
      const pausePromise = new Promise((resolve) => {
        const checkPause = () => {
          if (this.pausedParams) {
            resolve(this.pausedParams);
          } else {
            setTimeout(checkPause, 100);
          }
        };
        checkPause();
      });

      const result = await Promise.race([
        pausePromise,
        actionPromise.then(() => ({ actionCompleted: true }))
      ]);

      if ((result as any).actionCompleted) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ Breakpoint at line ${lineNumber} was not triggered by action ${actionToTrigger}.\n` +
                    `The action completed without hitting the breakpoint.\n`
            },
          ],
        };
      }

      // Get current variables
      const variablesResult = await this.debugGetVariables();
      const variables = JSON.parse(variablesResult.content[0].text.split('📊 Local Variables:\n')[1].split('\n\n')[0]);
      const callFrame = this.pausedParams.callFrames[0];

      return {
        content: [
          {
            type: 'text',
            text: `🐛 DEBUG SESSION ACTIVE\n\n` +
                  `📍 Breakpoint hit at line ${lineNumber}\n` +
                  `🔍 Function: ${callFrame.functionName || 'anonymous'}\n` +
                  `🎯 Triggered by: ${actionToTrigger}\n\n` +
                  `📊 Current Variables:\n${JSON.stringify(variables, null, 2)}\n\n` +
                  `🔧 NEXT STEPS:\n` +
                  `1. Use debug_evaluate to inspect specific expressions\n` +
                  `   Example: debug_evaluate --expression "variableName"\n\n` +
                  `2. Use debug_step_over to execute next line\n` +
                  `   Example: debug_step_over\n\n` +
                  `3. Use debug_continue to resume normal execution\n` +
                  `   Example: debug_continue\n\n` +
                  `💡 TIP: After stepping, use debug_get_variables to see updated values\n\n`
          },
        ],
      };

    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Debug setup failed: ${error.message}`
          },
        ],
      };
    }
  }
}