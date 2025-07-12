#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

// Read the actual supapup file to see what's happening
const supapupPath = '/Users/cobusswart/.nvm/versions/node/v22.4.0/lib/node_modules/supapup/dist/index.js';
const content = readFileSync(supapupPath, 'utf8');

// Check if it has the import.meta.url check
const hasCheck = content.includes('import.meta.url');
console.log('Has import.meta.url check:', hasCheck);

// Find the line
const lines = content.split('\n');
const checkLine = lines.find(line => line.includes('import.meta.url') && line.includes('process.argv'));
console.log('Check line:', checkLine);

// Now run supapup with debugging
console.log('\nRunning supapup with debugging...');
const child = spawn('node', ['--inspect', supapupPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, DEBUG: 'true' }
});

child.stdout.on('data', (data) => {
  console.log('stdout:', data.toString());
});

child.stderr.on('data', (data) => {
  console.log('stderr:', data.toString());
});

setTimeout(() => {
  child.kill();
}, 1000);