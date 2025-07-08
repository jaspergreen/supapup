export interface MCPBridgeAction {
  id: string;
  type: 'click' | 'fill' | 'select' | 'submit' | 'custom';
  selector?: string;
  description: string;
  inputs?: Record<string, any>;
  outputs?: string[];
}

export interface MCPBridgeManifest {
  page: string;
  version: string;
  actions: MCPBridgeAction[];
  state?: Record<string, any>;
}

export interface MCPBridge {
  getManifest(): MCPBridgeManifest;
  getActions(): MCPBridgeAction[];
  execute(actionId: string, params?: any): Promise<any>;
  getState(): Record<string, any>;
}

declare global {
  interface Window {
    __MCP_MANIFEST__?: MCPBridgeManifest;
  }
}