// Extend Window interface for framework detection
interface Window {
  // React
  React?: any;
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
    getFiberRoots(): Set<any>;
  };
  
  // Vue
  Vue?: any;
  __VUE_DEVTOOLS_GLOBAL_HOOK__?: {
    apps?: any[];
    _apps?: any[];
  };
  
  // Angular
  ng?: any;
  getAllAngularRootElements?: () => any[];
  
  // Svelte
  __svelte?: any;
  
  // MCP Bridge
  __MCP_BRIDGE__?: any;
  __MCP_TAG_BRIDGE__?: {
    getEvents?: () => any[];
    [key: string]: any;
  };
  
  // Dialog tracking
  __lastAlert?: {
    type: string;
    message: string;
    result?: any;
    timestamp: number;
  };
  __getLastDialog?: () => any;
  
  // Session event tracking
  __SESSION_EVENTS__?: any[];
  __addSessionEvent__?: (event: any) => void;
}