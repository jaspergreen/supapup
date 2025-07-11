import { Page, ConsoleMessage, HTTPRequest, HTTPResponse } from 'puppeteer';

export interface NetworkLog {
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  type?: string;
  size?: number;
  duration?: number;
  requestHeaders?: Record<string, string>;
  requestPayload?: any;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  initiator?: {
    type: string;
    stack?: {
      callFrames: Array<{
        functionName: string;
        url: string;
        lineNumber: number;
        columnNumber: number;
      }>;
    };
    url?: string;
    lineNumber?: number;
  };
  isAPI?: boolean;
}

export interface ConsoleLog {
  timestamp: Date;
  type: string;
  text: string;
  location?: string;
  stackTrace?: any;
}

export class DevToolsMonitor {
  private networkLogs: NetworkLog[] = [];
  private consoleLogs: ConsoleLog[] = [];
  private page: Page;
  private requestTimings: Map<string, number> = new Map();
  private requestDetails: Map<string, any> = new Map();
  private cdpSession: any;
  private consoleHandler: (msg: any) => void = () => {};
  private requestHandler: (request: any) => void = () => {};
  private responseHandler: (response: any) => void = () => {};
  private pageErrorHandler: (error: any) => void = () => {};
  private requestFailedHandler: (request: any) => void = () => {};
  private cdpRequestWillBeSentHandler: (params: any) => void = () => {};
  private cdpResponseReceivedHandler: (params: any) => void = () => {};
  private cdpLoadingFinishedHandler: (params: any) => void = () => {};

  constructor(page: Page) {
    this.page = page;
    this.setupListeners();
    // Delay CDP setup more to ensure browser is fully ready
    setTimeout(() => {
      this.setupCDPListeners().catch(err => {
        // console.error('[DevTools] CDP setup error (non-fatal):', err.message);
      });
    }, 2000);
  }

  private setupListeners() {
    // Store handlers for cleanup
    this.consoleHandler = (msg: ConsoleMessage) => {
      const location = msg.location();
      this.consoleLogs.push({
        timestamp: new Date(),
        type: msg.type(),
        text: msg.text(),
        location: location.url ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined,
        stackTrace: msg.stackTrace()
      });
    };

    this.requestHandler = (request: HTTPRequest) => {
      this.requestTimings.set(request.url(), Date.now());
    };

    this.responseHandler = (response: HTTPResponse) => {
      const request = response.request();
      const startTime = this.requestTimings.get(request.url());
      const duration = startTime ? Date.now() - startTime : undefined;
      
      this.networkLogs.push({
        timestamp: new Date(),
        method: request.method(),
        url: request.url(),
        status: response.status(),
        type: request.resourceType(),
        size: response.headers()['content-length'] ? parseInt(response.headers()['content-length']) : undefined,
        duration
      });
      
      this.requestTimings.delete(request.url());
    };

    this.pageErrorHandler = (error: Error) => {
      this.consoleLogs.push({
        timestamp: new Date(),
        type: 'error',
        text: error.message,
        stackTrace: error.stack
      });
    };

    this.requestFailedHandler = (request: HTTPRequest) => {
      this.networkLogs.push({
        timestamp: new Date(),
        method: request.method(),
        url: request.url(),
        status: 0,
        type: request.resourceType()
      });
    };

    // Console logging
    this.page.on('console', this.consoleHandler);
    // Network monitoring
    this.page.on('request', this.requestHandler);
    this.page.on('response', this.responseHandler);
    // Page errors
    this.page.on('pageerror', this.pageErrorHandler);
    // Request failures
    this.page.on('requestfailed', this.requestFailedHandler);
  }


  // Get logs
  getConsoleLogs(filter?: { type?: string; since?: Date }): ConsoleLog[] {
    let logs = [...this.consoleLogs];
    
    if (filter?.type) {
      logs = logs.filter(log => log.type === filter.type);
    }
    
    if (filter?.since) {
      logs = logs.filter(log => log.timestamp > filter.since!);
    }
    
    return logs;
  }

  getNetworkLogs(filter?: { status?: number; method?: string; since?: Date }): NetworkLog[] {
    let logs = [...this.networkLogs];
    
    if (filter?.status) {
      logs = logs.filter(log => log.status === filter.status);
    }
    
    if (filter?.method) {
      logs = logs.filter(log => log.method === filter.method);
    }
    
    if (filter?.since) {
      logs = logs.filter(log => log.timestamp > filter.since!);
    }
    
    return logs;
  }

  // Clear logs
  clearLogs() {
    this.networkLogs = [];
    this.consoleLogs = [];
    this.requestTimings.clear();
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    // Get basic metrics from Puppeteer
    const metrics = await this.page.metrics();
    
    // Get detailed performance data from the browser
    const performanceData = await this.page.evaluate(() => {
      const perf = window.performance;
      const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = perf.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      // Calculate key metrics
      const timingMetrics = navigation ? {
        // Time to first byte
        ttfb: navigation.responseStart - navigation.requestStart,
        // DOM Content Loaded
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        // Load Complete
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        // Total page load time
        totalLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        // DNS lookup
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        // TCP connection
        tcpConnection: navigation.connectEnd - navigation.connectStart,
        // Request duration
        requestDuration: navigation.responseEnd - navigation.requestStart,
        // Response duration
        responseDuration: navigation.responseEnd - navigation.responseStart,
        // DOM processing
        domProcessing: navigation.domComplete - navigation.domInteractive,
        // Resource fetch time
        resourceFetchTime: navigation.loadEventStart - navigation.domContentLoadedEventEnd
      } : {};
      
      // Resource breakdown
      const resourceBreakdown = {
        scripts: resources.filter(r => r.initiatorType === 'script').length,
        stylesheets: resources.filter(r => r.initiatorType === 'link' || r.initiatorType === 'css').length,
        images: resources.filter(r => r.initiatorType === 'img').length,
        fonts: resources.filter(r => r.name.includes('.woff') || r.name.includes('.ttf')).length,
        xhr: resources.filter(r => r.initiatorType === 'xmlhttprequest' || r.initiatorType === 'fetch').length,
        other: resources.filter(r => !['script', 'link', 'css', 'img', 'xmlhttprequest', 'fetch'].includes(r.initiatorType)).length
      };
      
      // Largest resources
      const largestResources = resources
        .filter(r => r.transferSize > 0)
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, 5)
        .map(r => ({
          url: r.name,
          size: r.transferSize,
          duration: Math.round(r.duration),
          type: r.initiatorType
        }));
      
      // Slowest resources
      const slowestResources = resources
        .filter(r => r.duration > 0)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map(r => ({
          url: r.name,
          duration: Math.round(r.duration),
          size: r.transferSize,
          type: r.initiatorType
        }));
      
      // Paint metrics
      const paintMetrics: any = {};
      const paintEntries = perf.getEntriesByType('paint');
      paintEntries.forEach((entry: any) => {
        paintMetrics[entry.name] = Math.round(entry.startTime);
      });
      
      // Memory info if available
      const memoryInfo = 'memory' in performance ? (performance as any).memory : null;
      
      return {
        navigation: timingMetrics,
        resources: {
          total: resources.length,
          breakdown: resourceBreakdown,
          totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          totalDuration: Math.max(...resources.map(r => r.responseEnd || 0))
        },
        largestResources,
        slowestResources,
        paintMetrics,
        memoryInfo
      };
    });
    
    return {
      ...metrics,
      detailed: performanceData
    };
  }

  // Get coverage
  async startCoverage() {
    await Promise.all([
      this.page.coverage.startJSCoverage(),
      this.page.coverage.startCSSCoverage()
    ]);
  }

  async stopCoverage() {
    const [jsCoverage, cssCoverage] = await Promise.all([
      this.page.coverage.stopJSCoverage(),
      this.page.coverage.stopCSSCoverage()
    ]);
    
    return { jsCoverage, cssCoverage };
  }

  // DOM and CSS inspection
  async inspectElement(selector: string) {
    const element = await this.page.$(selector);
    if (!element) {
      return null;
    }

    const properties = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      return {
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        attributes: Array.from(el.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        })),
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        computedStyles: {
          display: styles.display,
          position: styles.position,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          margin: styles.margin,
          padding: styles.padding,
          border: styles.border,
          width: styles.width,
          height: styles.height,
          zIndex: styles.zIndex,
          opacity: styles.opacity,
          visibility: styles.visibility
        },
        innerHTML: el.innerHTML.substring(0, 200) + (el.innerHTML.length > 200 ? '...' : ''),
        innerText: (el as HTMLElement).innerText?.substring(0, 200) + ((el as HTMLElement).innerText?.length > 200 ? '...' : '')
      };
    });

    return properties;
  }

  // Get page resources
  async getPageResources() {
    return await this.page.evaluate(() => {
      const resources = {
        scripts: Array.from(document.scripts).map(script => ({
          src: script.src,
          async: script.async,
          defer: script.defer,
          type: script.type,
          inline: !script.src
        })),
        stylesheets: Array.from(document.styleSheets).map(sheet => ({
          href: sheet.href,
          disabled: sheet.disabled,
          media: sheet.media.mediaText,
          rules: sheet.cssRules ? sheet.cssRules.length : 0
        })),
        images: Array.from(document.images).map(img => ({
          src: img.src,
          alt: img.alt,
          width: img.width,
          height: img.height,
          loaded: img.complete
        })),
        links: Array.from(document.links).map(link => ({
          href: link.href,
          text: link.textContent,
          target: link.target,
          rel: link.rel
        }))
      };
      
      return resources;
    });
  }

  // Accessibility tree
  async getAccessibilityTree() {
    return await this.page.accessibility.snapshot();
  }

  // Memory info
  async getMemoryInfo() {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
  }

  // Setup Chrome DevTools Protocol listeners for enhanced network monitoring
  private async setupCDPListeners() {
    try {
      // Wait for the page to be fully initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.cdpSession = await this.page.target().createCDPSession();
      
      // Check if CDP session is valid
      if (!this.cdpSession || typeof this.cdpSession.on !== 'function') {
        // console.error('[DevTools] Invalid CDP session, skipping advanced network monitoring');
        return;
      }
      
      // Enable network domain for detailed request/response data
      await this.cdpSession.send('Network.enable');
      
      // Listen for request will be sent - captures headers and initiator
      this.cdpRequestWillBeSentHandler = (params: any) => {
        const { requestId, request, initiator, type } = params;
        
        // Store request details for later
        this.requestDetails.set(requestId, {
          url: request.url,
          method: request.method,
          headers: request.headers,
          postData: request.postData,
          initiator: initiator,
          type: type,
          timestamp: Date.now()
        });
      };
      this.cdpSession.on('Network.requestWillBeSent', this.cdpRequestWillBeSentHandler);
      
      // Listen for response received - captures response headers
      this.cdpResponseReceivedHandler = (params: any) => {
        const { requestId, response } = params;
        const requestDetail = this.requestDetails.get(requestId);
        
        if (requestDetail) {
          requestDetail.responseHeaders = response.headers;
          requestDetail.status = response.status;
          requestDetail.statusText = response.statusText;
          requestDetail.mimeType = response.mimeType;
        }
      };
      this.cdpSession.on('Network.responseReceived', this.cdpResponseReceivedHandler);
      
      // Listen for loading finished to get response body
      this.cdpLoadingFinishedHandler = async (params: any) => {
        const { requestId } = params;
        const requestDetail = this.requestDetails.get(requestId);
        
        if (requestDetail && this.isAPIRequest(requestDetail)) {
          try {
            // Get response body for API requests
            const bodyResponse = await this.cdpSession.send('Network.getResponseBody', { requestId });
            requestDetail.responseBody = bodyResponse.body;
            
            // Create enhanced network log entry
            const duration = Date.now() - requestDetail.timestamp;
            this.networkLogs.push({
              timestamp: new Date(requestDetail.timestamp),
              method: requestDetail.method,
              url: requestDetail.url,
              status: requestDetail.status,
              type: requestDetail.type,
              duration: duration,
              requestHeaders: requestDetail.headers,
              requestPayload: requestDetail.postData ? this.parsePayload(requestDetail.postData) : undefined,
              responseHeaders: requestDetail.responseHeaders,
              responseBody: requestDetail.responseBody,
              initiator: requestDetail.initiator,
              isAPI: true
            });
          } catch (err) {
            // Response body might not be available for some requests
          }
          
          // Clean up
          this.requestDetails.delete(requestId);
        }
      };
      this.cdpSession.on('Network.loadingFinished', this.cdpLoadingFinishedHandler);
      
    } catch (err) {
      // console.error('Failed to setup CDP listeners:', err);
    }
  }
  
  // Helper to identify API requests
  private isAPIRequest(requestDetail: any): boolean {
    const url = requestDetail.url.toLowerCase();
    const type = requestDetail.type?.toLowerCase();
    
    // Check if it's XHR or Fetch
    if (type === 'xhr' || type === 'fetch') {
      return true;
    }
    
    // Check common API patterns
    if (url.includes('/api/') || url.includes('.json') || 
        url.includes('/graphql') || url.includes('/rest/')) {
      return true;
    }
    
    // Check content type
    const contentType = requestDetail.responseHeaders?.['content-type'] || '';
    if (contentType.includes('application/json') || 
        contentType.includes('application/xml')) {
      return true;
    }
    
    return false;
  }
  
  // Helper to parse request payload
  private parsePayload(postData: string): any {
    try {
      return JSON.parse(postData);
    } catch {
      // Not JSON, return as-is
      return postData;
    }
  }
  
  // Get API logs with enhanced filtering
  getAPILogs(filter?: { 
    method?: string; 
    urlPattern?: string;
    status?: number;
    since?: Date;
  }): NetworkLog[] {
    let logs = this.networkLogs.filter(log => log.isAPI);
    
    if (filter?.method) {
      logs = logs.filter(log => log.method === filter.method);
    }
    
    if (filter?.urlPattern) {
      const pattern = new RegExp(filter.urlPattern);
      logs = logs.filter(log => pattern.test(log.url));
    }
    
    if (filter?.status) {
      logs = logs.filter(log => log.status === filter.status);
    }
    
    if (filter?.since) {
      logs = logs.filter(log => log.timestamp > filter.since!);
    }
    
    return logs;
  }

  // Cleanup method to remove all event listeners
  async cleanup() {
    try {
      // Remove page event listeners using stored handlers
      if (this.page) {
        this.page.off('console', this.consoleHandler);
        this.page.off('request', this.requestHandler);
        this.page.off('response', this.responseHandler);
        this.page.off('pageerror', this.pageErrorHandler);
        this.page.off('requestfailed', this.requestFailedHandler);
      }
      
      // Remove CDP session listeners
      if (this.cdpSession) {
        this.cdpSession.off('Network.requestWillBeSent', this.cdpRequestWillBeSentHandler);
        this.cdpSession.off('Network.responseReceived', this.cdpResponseReceivedHandler);
        this.cdpSession.off('Network.loadingFinished', this.cdpLoadingFinishedHandler);
        // Detach the CDP session
        this.cdpSession.detach().catch(() => {
          // Ignore errors during detach
        });
      }
      
      // Clear data
      this.networkLogs = [];
      this.consoleLogs = [];
      this.requestTimings.clear();
      this.requestDetails.clear();
      this.cdpSession = null;
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}