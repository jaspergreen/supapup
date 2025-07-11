import { Page } from 'puppeteer';

export interface NetworkLog {
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  requestPayload?: any;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  initiator?: any;
  isAPI?: boolean;
  duration?: number;
  resourceType?: string;
  size?: number;
  name?: string;
}

export class NetworkTools {
  private page: Page;
  private networkLogs: NetworkLog[] = [];
  private consoleLogs: any[] = [];
  private requestHandler: (request: any) => void = () => {};
  private responseHandler: (response: any) => void = () => {};
  private consoleHandler: (msg: any) => void = () => {};
  private cdpSession?: any;
  private cdpRequestHandler?: (params: any) => void;
  private cdpResponseHandler?: (params: any) => void;

  constructor(page: Page) {
    this.page = page;
    this.setupNetworkMonitoring().catch(console.error);
  }

  private async setupNetworkMonitoring() {
    try {
      // Enable Chrome DevTools Protocol Network domain
      this.cdpSession = await this.page.target().createCDPSession();
      await this.cdpSession.send('Network.enable');
      console.log('[NetworkTools] CDP Network.enable() successful');

      // Create handlers that we can later remove
      this.cdpRequestHandler = (params) => {
        const isAPI = this.isAPIRequest(params.type || 'unknown');
        
        const log: NetworkLog = {
          timestamp: new Date(),
          method: params.request.method,
          url: params.request.url,
          requestHeaders: params.request.headers,
          requestPayload: params.request.postData,
          isAPI: isAPI
        };
        this.networkLogs.push(log);
        
        // Debug logging
        console.log(`[NetworkTools] CDP Request: ${params.request.method} ${params.request.url} - Type: "${params.type}", IsAPI: ${isAPI}`);
      };

      this.cdpResponseHandler = (params) => {
        const log = this.networkLogs.find(l => l.url === params.response.url && !l.status);
        if (log) {
          log.status = params.response.status;
          log.responseHeaders = params.response.headers;
          log.duration = Date.now() - log.timestamp.getTime();
        }
      };

      // Listen to Network.requestWillBeSent for all requests
      this.cdpSession.on('Network.requestWillBeSent', this.cdpRequestHandler);

      // Listen to Network.responseReceived for response data
      this.cdpSession.on('Network.responseReceived', this.cdpResponseHandler);

      console.log('[NetworkTools] CDP event listeners attached');
    } catch (error) {
      console.error('[NetworkTools] CDP setup failed:', error);
      // Fall back to Puppeteer page events if CDP fails
      this.setupFallbackMonitoring();
    }

    // Keep console monitoring from page events
    this.consoleHandler = (msg) => {
      this.consoleLogs.push({
        timestamp: new Date(),
        type: msg.type(),
        text: msg.text(),
        args: msg.args()
      });
    };

    this.page.on('console', this.consoleHandler);
  }

  private setupFallbackMonitoring() {
    console.log('[NetworkTools] Using fallback Puppeteer monitoring');
    // Fallback to original Puppeteer page events
    this.requestHandler = (request) => {
      const resourceType = request.resourceType();
      const isAPI = this.isAPIRequest(resourceType);
      const url = request.url();
      const name = url.split('/').pop() || url;
      
      const log: NetworkLog = {
        timestamp: new Date(),
        method: request.method(),
        url: url,
        requestHeaders: request.headers(),
        requestPayload: request.postData(),
        isAPI: isAPI,
        resourceType: resourceType,
        name: name,
        initiator: request.frame() ? { type: 'parser' } : { type: 'script' }
      };
      this.networkLogs.push(log);
      
      console.log(`[NetworkTools] Fallback Request: ${request.method()} ${request.url()} - Type: "${resourceType}", IsAPI: ${isAPI}`);
    };

    this.responseHandler = (response) => {
      const log = this.networkLogs.find(l => l.url === response.url() && !l.status);
      if (log) {
        log.status = response.status();
        log.responseHeaders = response.headers();
        log.duration = Date.now() - log.timestamp.getTime();
        
        // Try to get response size from headers
        const contentLength = response.headers()['content-length'];
        if (contentLength) {
          log.size = parseInt(contentLength, 10);
        }
      }
    };

    this.page.on('request', this.requestHandler);
    this.page.on('response', this.responseHandler);
  }

  // Cleanup method to remove event listeners
  public async cleanup() {
    // Remove Puppeteer page event listeners
    if (this.page && this.requestHandler) {
      this.page.off('request', this.requestHandler);
    }
    if (this.page && this.responseHandler) {
      this.page.off('response', this.responseHandler);
    }
    if (this.page && this.consoleHandler) {
      this.page.off('console', this.consoleHandler);
    }
    
    // Remove CDP session listeners
    if (this.cdpSession) {
      if (this.cdpRequestHandler) {
        this.cdpSession.off('Network.requestWillBeSent', this.cdpRequestHandler);
      }
      if (this.cdpResponseHandler) {
        this.cdpSession.off('Network.responseReceived', this.cdpResponseHandler);
      }
      
      // Detach the CDP session
      try {
        await this.cdpSession.detach();
      } catch (error) {
        console.error('[NetworkTools] Error detaching CDP session:', error);
      }
      
      this.cdpSession = undefined;
    }
    
    console.log('[NetworkTools] Cleanup completed');
  }

  private isAPIRequest(resourceType: string): boolean {
    // Handle both CDP capitalized values ("Fetch", "XHR") and Puppeteer lowercase values ("fetch", "xhr")
    const type = resourceType.toLowerCase();
    return type === 'xhr' || type === 'fetch';
  }

  async getConsoleLogs(args: any) {
    const { type } = args;
    let logs = this.consoleLogs;
    
    if (type) {
      logs = logs.filter(log => log.type === type);
    }

    const recentLogs = logs.slice(-50); // Last 50 logs

    return {
      content: [
        {
          type: 'text',
          text: `📋 Console Logs (${recentLogs.length} entries)\n\n` +
                recentLogs.map((log, i) => 
                  `[${i + 1}] ${log.timestamp.toISOString()} [${log.type.toUpperCase()}]: ${log.text}`
                ).join('\n') +
                `\n\n💡 Use --type parameter to filter (log, error, warning, info)`
        },
      ],
    };
  }

  async getNetworkLogs(args: any) {
    const { method, status } = args;
    let logs = this.networkLogs;
    
    if (method) {
      logs = logs.filter(log => log.method.toLowerCase() === method.toLowerCase());
    }
    
    if (status) {
      logs = logs.filter(log => log.status === status);
    }

    const recentLogs = logs.slice(-20); // Last 20 requests

    return {
      content: [
        {
          type: 'text',
          text: `🌐 Network Logs (${recentLogs.length} requests)\n\n` +
                recentLogs.map((log, i) => {
                  const name = log.name || log.url.split('/').pop() || log.url;
                  const size = log.size ? `${(log.size / 1024).toFixed(1)} kB` : 'N/A';
                  const initiator = log.initiator ? `${log.initiator.type || 'unknown'}` : 'N/A';
                  
                  return `[${i + 1}] ${log.method} ${log.url}\n` +
                         `    Status: ${log.status || 'pending'} | Type: ${log.resourceType || 'unknown'} | Duration: ${log.duration || 'N/A'}ms\n` +
                         `    Initiator: ${initiator} | Size: ${size} | IsAPI: ${log.isAPI || false}\n`;
                }).join('\n') +
                `\n💡 Use --method or --status to filter`
        },
      ],
    };
  }

  async getAPILogs(args: any) {
    const { method, status, urlPattern, since } = args;
    let logs = this.networkLogs.filter(log => log.isAPI);
    
    if (method) {
      logs = logs.filter(log => log.method.toLowerCase() === method.toLowerCase());
    }
    
    if (status) {
      logs = logs.filter(log => log.status === status);
    }
    
    if (urlPattern) {
      const regex = new RegExp(urlPattern);
      logs = logs.filter(log => regex.test(log.url));
    }
    
    if (since) {
      const sinceDate = new Date(since);
      logs = logs.filter(log => log.timestamp >= sinceDate);
    }

    const formattedLogs = logs.slice(-10); // Last 10 API requests

    return {
      content: [
        {
          type: 'text',
          text: `📡 API Request Logs (${formattedLogs.length} requests)\n\n` +
                formattedLogs.map((log, i) => 
                  `[${i + 1}] ${log.method} ${log.url}\n` +
                  `    Status: ${log.status} | Duration: ${log.duration || 'N/A'}\n` +
                  (log.requestPayload ? `    Payload: ${JSON.stringify(log.requestPayload)}\n` : '') +
                  (log.initiator?.stack ? `    Called from: ${log.initiator.stack[0]}\n` : '') +
                  `    Response: ${log.responseBody?.substring(0, 100)}${log.responseBody && log.responseBody.length > 100 ? '...' : ''}\n`
                ).join('\n') +
                `\n💡 Use specific index for full details or filter with method/urlPattern/status`
        },
      ],
    };
  }

  async clearLogs() {
    this.networkLogs = [];
    this.consoleLogs = [];

    return {
      content: [
        {
          type: 'text',
          text: '🗑️ Console and network logs cleared'
        },
      ],
    };
  }

  // Debug method to see all captured network logs with their isAPI status
  async debugAllLogs() {
    const logs = this.networkLogs.slice(-5); // Last 5 requests
    
    return {
      content: [
        {
          type: 'text',
          text: `🔍 DEBUG: Raw Network Log Objects (${logs.length} requests)\n\n` +
                logs.map((log, i) => 
                  `[${i + 1}] RAW LOG DATA:\n` +
                  `${JSON.stringify(log, null, 2)}\n\n`
                ).join('')
        },
      ],
    };
  }

  async replayAPIRequest(args: any) {
    try {
      const { url, method = 'GET', headers = {}, payload, modifyOriginal = true } = args;
      
      // Find original request for comparison
      const originalRequest = this.networkLogs.find(log => log.url === url);
      
      // Perform the request
      const response = await this.page.evaluate(async ({ url, method, headers, payload }) => {
        try {
          // Create AbortController with timeout to prevent memory leaks
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => {
            abortController.abort();
          }, 30000); // 30 second timeout
          
          const options: RequestInit = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers
            },
            signal: abortController.signal // Add abort signal
          };
          
          if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
          }
          
          const startTime = Date.now();
          const response = await fetch(url, options);
          const responseBody = await response.text();
          
          // Clean up timeout
          clearTimeout(timeoutId);
          
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
            duration: Date.now() - startTime
          };
        } catch (error: any) {
          return { error: error.message };
        }
      }, { url, method, headers, payload });

      if (response.error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ API Request Failed\n\n` +
                    `Error: ${response.error}\n` +
                    `Request: ${method} ${url}`
            },
          ],
        };
      }

      const result = {
        request: { method, url, headers, payload },
        response
      };

      return {
        content: [
          {
            type: 'text',
            text: `🔄 API Request Replay\n\n` +
                  `📤 REQUEST:\n` +
                  `${result.request.method} ${result.request.url}\n` +
                  `Headers: ${JSON.stringify(result.request.headers, null, 2)}\n` +
                  (result.request.payload ? `Payload: ${JSON.stringify(result.request.payload, null, 2)}\n` : '') +
                  `\n📥 RESPONSE:\n` +
                  `Status: ${result.response.status} ${result.response.statusText}\n` +
                  `Duration: ${result.response.duration}ms\n` +
                  `Headers: ${JSON.stringify(result.response.headers, null, 2)}\n` +
                  `Body: ${typeof (result.response as any).body === 'object' ? 
                    JSON.stringify((result.response as any).body, null, 2) : 
                    String((result.response as any).body)}\n\n` +
                  (originalRequest ? 
                    `📝 Original request had: ${originalRequest.method} with status ${originalRequest.status}` : 
                    `🆕 No previous request found for this URL`)
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to replay request: ${error.message}`
          },
        ],
      };
    }
  }

  async interceptRequests(args: any) {
    try {
      const { enable, rules = [] } = args;
      
      if (enable) {
        // Check if interception is already enabled
        const isInterceptionEnabled = (this.page as any)._isInterceptionEnabled;
        
        if (!isInterceptionEnabled) {
          await this.page.setRequestInterception(true);
        }
        
        // Remove existing request listeners to avoid duplicates
        this.page.removeAllListeners('request');
        
        // Add new request handler
        this.page.on('request', (request) => {
          let shouldBlock = false;
          let modifiedHeaders = { ...request.headers() };
          let modifiedPayload = request.postData();
          
          // Apply rules
          for (const rule of rules) {
            if (rule.urlPattern && new RegExp(rule.urlPattern).test(request.url())) {
              if (rule.block) {
                shouldBlock = true;
                break;
              }
              if (rule.modifyHeaders) {
                modifiedHeaders = { ...modifiedHeaders, ...rule.modifyHeaders };
              }
              if (rule.modifyPayload) {
                modifiedPayload = typeof rule.modifyPayload === 'string' ? 
                  rule.modifyPayload : JSON.stringify(rule.modifyPayload);
              }
            }
          }
          
          if (shouldBlock) {
            request.abort();
          } else if (modifiedHeaders !== request.headers() || modifiedPayload !== request.postData()) {
            request.continue({
              headers: modifiedHeaders,
              postData: modifiedPayload
            });
          } else {
            request.continue();
          }
        });
      } else {
        await this.page.setRequestInterception(false);
      }

      return {
        content: [
          {
            type: 'text',
            text: enable ? 
              `🛡️ Request interception enabled with ${rules.length} rules` :
              `🔓 Request interception disabled`
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to set request interception: ${error.message}`
          },
        ],
      };
    }
  }
}