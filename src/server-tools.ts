import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ServerTools {
  
  async getServerInfo(): Promise<any> {
    try {
      // Read package.json to get version info
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      let packageInfo: any = {};
      
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
        packageInfo = JSON.parse(packageJson);
      }

      // Get Node.js and system info
      const serverInfo = {
        name: packageInfo.name || 'supapup',
        version: packageInfo.version || '0.1.0',
        description: packageInfo.description || 'MCP server for intelligent web interaction',
        author: packageInfo.author || 'Unknown',
        license: packageInfo.license || 'Unknown',
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch
        },
        dependencies: {
          puppeteer: packageInfo.dependencies?.['puppeteer-extra'] || 'Unknown',
          mcp: packageInfo.dependencies?.['@modelcontextprotocol/sdk'] || 'Unknown'
        },
        runtime: {
          pid: process.pid,
          uptime: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
          cwd: process.cwd()
        },
        capabilities: [
          'browser automation',
          'agent page generation', 
          'form interaction',
          'screenshot capture',
          'debugging tools',
          'network monitoring',
          'storage management',
          'human interaction'
        ]
      };

      const formatBytes = (bytes: number) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
      };

      const uptimeFormatted = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
      };

      let response = `🤖 Supapup MCP Server Information\n`;
      response += `==============================\n\n`;
      response += `📦 **Package**: ${serverInfo.name} v${serverInfo.version}\n`;
      response += `📝 **Description**: ${serverInfo.description}\n`;
      response += `👤 **Author**: ${serverInfo.author}\n`;
      response += `⚖️ **License**: ${serverInfo.license}\n\n`;
      
      response += `🔧 **Runtime Environment**\n`;
      response += `   • Node.js: ${serverInfo.node.version}\n`;
      response += `   • Platform: ${serverInfo.node.platform} (${serverInfo.node.arch})\n`;
      response += `   • Process ID: ${serverInfo.runtime.pid}\n`;
      response += `   • Uptime: ${uptimeFormatted(serverInfo.runtime.uptime)}\n`;
      response += `   • Working Directory: ${serverInfo.runtime.cwd}\n\n`;
      
      response += `💾 **Memory Usage**\n`;
      response += `   • RSS: ${formatBytes(serverInfo.runtime.memory.rss)}\n`;
      response += `   • Heap Used: ${formatBytes(serverInfo.runtime.memory.heapUsed)}\n`;
      response += `   • Heap Total: ${formatBytes(serverInfo.runtime.memory.heapTotal)}\n`;
      response += `   • External: ${formatBytes(serverInfo.runtime.memory.external)}\n\n`;
      
      response += `📚 **Key Dependencies**\n`;
      response += `   • Puppeteer: ${serverInfo.dependencies.puppeteer}\n`;
      response += `   • MCP SDK: ${serverInfo.dependencies.mcp}\n\n`;
      
      response += `🛠️ **Capabilities**\n`;
      serverInfo.capabilities.forEach((cap: string) => {
        response += `   • ${cap}\n`;
      });

      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      console.error('❌ Error getting server info:', error);
      
      // Fallback response with minimal info
      const fallbackResponse = `🤖 Supapup MCP Server\n` +
                              `==============================\n\n` +
                              `⚠️ Could not read full server info: ${error.message}\n\n` +
                              `🔧 **Runtime Environment**\n` +
                              `   • Node.js: ${process.version}\n` +
                              `   • Platform: ${process.platform}\n` +
                              `   • Process ID: ${process.pid}\n` +
                              `   • Uptime: ${Math.floor(process.uptime())}s\n\n` +
                              `🛠️ **Basic Capabilities**\n` +
                              `   • Browser automation\n` +
                              `   • Agent page generation\n` +
                              `   • MCP protocol support`;

      return {
        content: [{ type: 'text', text: fallbackResponse }]
      };
    }
  }

  // Additional server utilities can be added here
  getToolCategories(): string[] {
    return [
      'Browser Management',
      'Agent Interaction', 
      'Form Handling',
      'Human Interaction',
      'Screenshots',
      'Debugging',
      'Network Analysis',
      'Console Monitoring',
      'Page Analysis',
      'DevTools Elements',
      'Storage Management',
      'Script Execution'
    ];
  }

  getToolCount(): number {
    // This could be dynamically calculated based on registered tools
    return 42; // Current approximate count
  }

  async healthCheck(): Promise<{ status: string; details?: any }> {
    try {
      // Basic health checks
      const health = {
        status: 'healthy',
        details: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          version: process.version,
          platform: process.platform
        }
      };

      // Check if memory usage is reasonable (less than 1GB)
      if (health.details.memory.heapUsed > 1024 * 1024 * 1024) {
        health.status = 'warning';
        (health.details as any).warnings = ['High memory usage detected'];
      }

      return health;
    } catch (error) {
      return {
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}