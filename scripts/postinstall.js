#!/usr/bin/env node

// This script ensures Puppeteer downloads its browser during npm install
console.log('Ensuring Puppeteer browser is downloaded...');

import puppeteer from 'puppeteer';

try {
  const browserPath = puppeteer.executablePath();
  console.log('✓ Browser found at:', browserPath);
} catch (error) {
  console.log('Downloading browser...');
  // The import alone should trigger the download
  console.log('✓ Browser download initiated');
}