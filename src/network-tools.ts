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
}

export class NetworkTools {
  private page: Page;
  private networkLogs: NetworkLog[] = [];
  private consoleLogs: any[] = [];

  constructor(page: Page) {
    this.page = page;
    this.setupNetworkMonitoring();
  }

  private setupNetworkMonitoring() {
    // Monitor network requests
    this.page.on('request', (request) => {
      const log: NetworkLog = {
        timestamp: new Date(),
        method: request.method(),
        url: request.url(),
        requestHeaders: request.headers(),
        requestPayload: request.postData(),
        isAPI: this.isAPIRequest(request.url())
      };
      this.networkLogs.push(log);
    });

    this.page.on('response', (response) => {
      const log = this.networkLogs.find(l => l.url === response.url() && !l.status);
      if (log) {
        log.status = response.status();
        log.responseHeaders = response.headers();
        log.duration = Date.now() - log.timestamp.getTime();
      }
    });

    // Monitor console logs
    this.page.on('console', (msg) => {
      this.consoleLogs.push({
        timestamp: new Date(),
        type: msg.type(),
        text: msg.text(),
        args: msg.args()
      });
    });
  }

  private isAPIRequest(url: string): boolean {
    return /\/(api|graphql|rest)\//.test(url) || 
           url.includes('.json') || 
           /\.(php|aspx|jsp)/.test(url);
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
                recentLogs.map((log, i) => 
                  `[${i + 1}] ${log.method} ${log.url}\n` +
                  `    Status: ${log.status || 'pending'} | Duration: ${log.duration || 'N/A'}ms\n`
                ).join('\n') +
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

  async replayAPIRequest(args: any) {
    try {
      const { url, method = 'GET', headers = {}, payload, modifyOriginal = true } = args;
      
      // Find original request for comparison
      const originalRequest = this.networkLogs.find(log => log.url === url);
      
      // Perform the request
      const response = await this.page.evaluate(async ({ url, method, headers, payload }) => {
        try {
          const options: RequestInit = {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...headers
            }
          };
          
          if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
          }
          
          const response = await fetch(url, options);
          const responseBody = await response.text();
          
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
            duration: Date.now() // Approximate
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
        await this.page.setRequestInterception(true);
        
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