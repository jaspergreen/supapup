const fs = require('fs');
const path = require('path');

// Map of files to their new locations
const fileLocations = {
  // Tools
  'agent-tools.js': '../tools/agent-tools.js',
  'browser-tools.js': '../tools/browser-tools.js',
  'debugging-tools.js': '../tools/debugging-tools.js',
  'devtools-elements.js': '../tools/devtools-elements.js',
  'form-tools.js': '../tools/form-tools.js',
  'network-tools.js': '../tools/network-tools.js',
  'page-analysis.js': '../tools/page-analysis.js',
  'screenshot-tools.js': '../tools/screenshot-tools.js',
  'storage-tools.js': '../tools/storage-tools.js',
  'human-interaction.js': '../tools/human-interaction.js',
  'responsive-testing.js': '../tools/responsive-testing.js',
  
  // Monitors
  'action-monitor.js': '../monitors/action-monitor.js',
  'dom-monitor.js': '../monitors/dom-monitor.js',
  'navigation-monitor.js': '../monitors/navigation-monitor.js',
  'wait-state-manager.js': '../monitors/wait-state-manager.js',
  
  // Core
  'index.js': '../core/index.js',
  'cli.js': '../core/cli.js',
  'browser-recovery.js': '../core/browser-recovery.js',
  'server-tools.js': '../core/server-tools.js',
  'tool-definitions.js': '../core/tool-definitions.js',
  
  // Generators
  'agent-page-script.js': '../generators/agent-page-script.js',
  'devtools-agent-page-generator.js': '../generators/devtools-agent-page-generator.js',
  'content-extractor.js': '../generators/content-extractor.js',
  'form-detector.js': '../generators/form-detector.js',
  'devtools.js': '../generators/devtools.js'
};

function updateImportsInFile(filePath) {
  console.log(`Updating imports in ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Get the directory of the current file
  const fileDir = path.dirname(filePath);
  const relativeToSrc = path.relative('/Users/cobusswart/Source/supapup/src', fileDir);
  
  // Update each import
  Object.entries(fileLocations).forEach(([filename, newPath]) => {
    const importRegex = new RegExp(`from\\s+['"]\\./${filename.replace('.', '\\.')}['"]`, 'g');
    if (content.match(importRegex)) {
      // Calculate the correct relative path from the current file to the target
      const targetPath = path.join('/Users/cobusswart/Source/supapup/src', newPath.replace('../', ''));
      const relativePath = path.relative(fileDir, targetPath).replace(/\\/g, '/');
      
      content = content.replace(importRegex, `from './${relativePath}'`);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${filePath}`);
  }
}

// Process all TypeScript files
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'types') {
      processDirectory(filePath);
    } else if (file.endsWith('.ts')) {
      updateImportsInFile(filePath);
    }
  });
}

// Run the update
processDirectory('/Users/cobusswart/Source/supapup/src');
console.log('✅ Import updates complete!');