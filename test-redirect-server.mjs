import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  console.log(`Request: ${pathname}${parsedUrl.search || ''}`);
  
  // Serve the test HTML files
  if (pathname === '/' || pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'test-redirect-loop.html'), (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (pathname === '/excessive') {
    fs.readFile(path.join(__dirname, 'test-excessive-redirects.html'), (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3001, () => {
  console.log('Test server running on http://localhost:3001');
  console.log('Open http://localhost:3001 to test redirect loops');
});