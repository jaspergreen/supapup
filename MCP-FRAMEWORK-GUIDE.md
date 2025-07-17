# MCP Server Framework Guide

This guide explains how to create your own Model Context Protocol (MCP) servers using the same framework patterns and architecture.

## 🏗️ MCP Server Architecture

### What is an MCP Server?

An MCP (Model Context Protocol) server is a standalone program that:
- Communicates via stdio (standard input/output)
- Provides tools that AI assistants can discover and use
- Runs as a separate process from the AI client
- Can be written in any language (this guide uses TypeScript/Node.js)

### How MCP Servers Work

1. **Server Launch**: The AI client (Claude, Gemini, etc.) spawns your server as a subprocess
2. **Communication**: Server and client exchange JSON-RPC messages via stdio
3. **Tool Discovery**: Client asks server what tools are available
4. **Tool Execution**: Client calls tools with parameters, server returns results
5. **Lifecycle**: Server runs until the client closes the connection

### Core Components

```
my-mcp-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── tools/                # Tool implementations
│   │   ├── data-tools.ts     # Data processing tools
│   │   ├── file-tools.ts     # File operations
│   │   └── api-tools.ts      # External API integrations
│   ├── types/                # TypeScript definitions
│   └── utils/                # Helper functions
├── dist/                     # Compiled output
├── package.json             # NPM configuration
└── tsconfig.json            # TypeScript configuration
```

## 📝 Creating a New MCP Server

### 1. Project Setup

```bash
# Create new project
mkdir my-mcp-server
cd my-mcp-server
npm init -y

# Install MCP SDK
npm install @modelcontextprotocol/sdk

# Install TypeScript (optional but recommended)
npm install -D typescript @types/node
```

### 2. Basic MCP Server Structure

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class MyMCPServer {
  private server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: 'my-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'example_tool',
          description: 'An example tool',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'Message to process' }
            },
            required: ['message']
          }
        }
      ],
    }));
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'example_tool':
          return {
            content: [{ type: 'text', text: `Processed: ${args.message}` }]
          };
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }
  
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP server running');
  }
}

// Start server
const server = new MyMCPServer();
server.run().catch(console.error);
```

### 3. Tool Organization Pattern

Organize your tools by category for better maintainability:

#### Tool Definition Registry (`tool-definitions.ts`):

```typescript
export class ToolDefinitions {
  static getToolDefinitions() {
    return [
      // Category 1: Data Processing Tools
      {
        name: 'process_data',
        description: 'Process data with specified algorithm',
        inputSchema: {
          type: 'object',
          properties: {
            data: { type: 'string', description: 'Data to process' },
            algorithm: { type: 'string', enum: ['sort', 'filter', 'transform'] }
          },
          required: ['data', 'algorithm']
        }
      },
      
      // Category 2: File Operations
      {
        name: 'read_file',
        description: 'Read a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            encoding: { type: 'string', default: 'utf8' }
          },
          required: ['path']
        }
      },
      
      // Add more tools...
    ];
  }
}
```

#### Tool Implementation (`tools/data-tools.ts`):

```typescript
export class DataTools {
  async processData(args: any): Promise<any> {
    const { data, algorithm } = args;
    
    let result: string;
    switch (algorithm) {
      case 'sort':
        result = data.split('').sort().join('');
        break;
      case 'filter':
        result = data.replace(/[^a-zA-Z]/g, '');
        break;
      case 'transform':
        result = data.toUpperCase();
        break;
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: `Processed data: ${result}`
      }]
    };
  }
}
```

### 4. Environment Variable Support

Add configuration through environment variables:

```typescript
// config.ts
export const config = {
  // Server settings
  serverName: process.env.MY_MCP_SERVER_NAME || 'my-mcp-server',
  serverPort: process.env.MY_MCP_SERVER_PORT || '8080',
  
  // Feature flags
  debugMode: process.env.MY_MCP_DEBUG === 'true',
  verboseLogging: process.env.MY_MCP_VERBOSE === 'true',
  
  // API keys (if needed)
  apiKey: process.env.MY_MCP_API_KEY,
};
```

### 5. Error Handling Pattern

Implement robust error handling:

```typescript
class ErrorRecovery {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: { maxAttempts?: number; delay?: number } = {}
  ): Promise<T> {
    const { maxAttempts = 3, delay = 1000 } = options;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        
        console.error(`Attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Should not reach here');
  }
}
```

### 6. Package Configuration

#### `package.json`:

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "description": "My custom MCP server",
  "main": "dist/index.js",
  "type": "module",
  "bin": {
    "my-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0"
  }
}
```

#### `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 🔧 MCP Configuration

### Claude Desktop Configuration

Add to Claude Desktop's MCP settings:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "my-mcp-server",
      "env": {
        "MY_MCP_DEBUG": "true",
        "MY_MCP_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Development Configuration

For local development:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/my-mcp-server",
      "env": {
        "MY_MCP_DEBUG": "true"
      }
    }
  }
}
```

## 📦 Publishing Your MCP Server

### 1. Prepare for NPM

```bash
# Build the project
npm run build

# Test locally
npm link
my-mcp-server  # Should start the server

# Login to npm
npm login
```

### 2. Publish

```bash
# Publish to npm
npm publish

# Users can then install globally
npm install -g my-mcp-server
```

## 🎯 Best Practices

### 1. Tool Naming
- Use lowercase with underscores: `process_data`, `read_file`
- Be descriptive but concise
- Group related tools with prefixes: `file_read`, `file_write`, `file_delete`

### 2. Response Format
Always return responses in MCP format:
```typescript
return {
  content: [
    { type: 'text', text: 'Your response text' },
    { type: 'image', data: 'base64-encoded-data', mimeType: 'image/png' }
  ]
};
```

### 3. Input Validation
Validate inputs in your tool handlers:
```typescript
if (!args.required_field) {
  throw new Error('required_field is required');
}
```

### 4. Logging
Use stderr for logs (stdout is reserved for MCP communication):
```typescript
console.error('[INFO] Processing request...');
```

### 5. State Management
Keep tools stateless when possible. If state is needed:
```typescript
class MyMCPServer {
  private state: Map<string, any> = new Map();
  
  // Provide tools to manage state
  async saveState(key: string, value: any) {
    this.state.set(key, value);
  }
  
  async getState(key: string) {
    return this.state.get(key);
  }
}
```

## 🚀 Example: Weather MCP Server

Here's a complete example of a weather MCP server:

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class WeatherMCPServer {
  private server: Server;
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
    
    this.server = new Server(
      {
        name: 'weather-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_weather',
          description: 'Get current weather for a city',
          inputSchema: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City name' },
              units: { 
                type: 'string', 
                enum: ['metric', 'imperial'],
                default: 'metric'
              }
            },
            required: ['city']
          }
        },
        {
          name: 'get_forecast',
          description: 'Get weather forecast for a city',
          inputSchema: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City name' },
              days: { type: 'number', default: 5, minimum: 1, maximum: 7 }
            },
            required: ['city']
          }
        }
      ],
    }));
    
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'get_weather':
          return await this.getWeather(args);
        case 'get_forecast':
          return await this.getForecast(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }
  
  private async getWeather(args: any): Promise<any> {
    const { city, units = 'metric' } = args;
    
    // Simulate API call (replace with real API)
    const weather = {
      city,
      temperature: 22,
      conditions: 'Partly cloudy',
      humidity: 65,
      wind_speed: 10,
      units
    };
    
    return {
      content: [{
        type: 'text',
        text: `Current weather in ${city}:\n` +
              `🌡️ Temperature: ${weather.temperature}°${units === 'metric' ? 'C' : 'F'}\n` +
              `☁️ Conditions: ${weather.conditions}\n` +
              `💧 Humidity: ${weather.humidity}%\n` +
              `💨 Wind: ${weather.wind_speed} ${units === 'metric' ? 'km/h' : 'mph'}`
      }]
    };
  }
  
  private async getForecast(args: any): Promise<any> {
    const { city, days = 5 } = args;
    
    // Simulate forecast data
    const forecast = Array.from({ length: days }, (_, i) => ({
      day: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      high: 20 + Math.floor(Math.random() * 10),
      low: 10 + Math.floor(Math.random() * 10),
      conditions: ['Sunny', 'Cloudy', 'Rainy', 'Partly cloudy'][Math.floor(Math.random() * 4)]
    }));
    
    const forecastText = forecast.map(day => 
      `${day.day}: ${day.conditions}, High: ${day.high}°C, Low: ${day.low}°C`
    ).join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `${days}-day forecast for ${city}:\n\n${forecastText}`
      }]
    };
  }
  
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Weather MCP server running');
  }
}

const server = new WeatherMCPServer();
server.run().catch(console.error);
```

## 🔍 Debugging Tips

1. **Enable verbose logging**:
   ```typescript
   if (process.env.MCP_DEBUG === 'true') {
     console.error('[DEBUG]', message);
   }
   ```

2. **Test without MCP client**:
   ```bash
   # Echo a request to your server
   echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/index.js
   ```

3. **Log all requests**:
   ```typescript
   this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
     console.error('[REQUEST]', JSON.stringify(request.params));
     // ... handle request
   });
   ```

## 📚 Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [MCP Specification](https://modelcontextprotocol.io)
- [Supapup Source Code](https://github.com/jaspergreen/supapup) - Reference implementation

## 💡 Common MCP Server Patterns

### 1. Stateless vs Stateful Servers

**Stateless** (Recommended):
- Each tool call is independent
- No data persists between calls
- Easier to scale and debug

**Stateful** (When Needed):
- Maintain connections (databases, browsers)
- Cache data between calls
- Handle cleanup on shutdown

### 2. Tool Design Principles

- **Single Responsibility**: Each tool does one thing well
- **Clear Naming**: Use descriptive, action-oriented names
- **Comprehensive Descriptions**: Help AI understand when to use each tool
- **Error Messages**: Provide helpful error messages for debugging
- **Input Validation**: Validate parameters before processing

### 3. Common Tool Categories

- **Data Processing**: Transform, filter, analyze data
- **File Operations**: Read, write, search files
- **API Integration**: Connect to external services
- **System Information**: Get system stats, environment info
- **Automation**: Browser control, GUI automation
- **Development**: Code analysis, testing, building

### 4. Production Best Practices

1. **Error Handling**: Always catch and return meaningful errors
2. **Resource Management**: Clean up connections, files, processes
3. **Security**: Validate inputs, sanitize paths, limit permissions
4. **Performance**: Use streams for large data, implement timeouts
5. **Logging**: Use stderr for logs, stdout is reserved for MCP
6. **Testing**: Test tools individually and integration with MCP

## 🚀 Advanced Topics

### Binary Execution

For better startup performance, create a binary wrapper:

```javascript
// bin/my-mcp-server
#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, '..', 'dist', 'index.js');

const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => process.exit(code || 0));
```

### Resource Management

MCP also supports resources (read-only data sources):

```typescript
this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'config://settings',
      name: 'Application Settings',
      description: 'Current configuration',
      mimeType: 'application/json'
    }
  ]
}));
```

### Prompts

MCP servers can provide reusable prompts:

```typescript
this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'analyze-code',
      description: 'Analyze code for issues',
      arguments: [
        { name: 'language', description: 'Programming language' },
        { name: 'code', description: 'Code to analyze' }
      ]
    }
  ]
}));
```

## 🎯 Summary

MCP servers provide a powerful way to extend AI assistants with custom tools. By following these patterns and best practices, you can create robust, maintainable MCP servers that integrate seamlessly with AI workflows.

Key takeaways:
- MCP servers run as separate processes communicating via stdio
- Tools are the primary way to expose functionality
- Good error handling and logging are essential
- Start simple, add complexity as needed
- Test thoroughly with your target AI client