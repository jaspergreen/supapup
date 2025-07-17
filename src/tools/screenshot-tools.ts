import { Page } from 'puppeteer';
import { randomUUID } from 'crypto';

interface ScreenshotChunk {
  id: string;
  totalChunks: number;
  chunks: string[];
  metadata: {
    fullPage: boolean;
    quality: number;
    viewport?: { width: number; height: number };
    timestamp: Date;
  };
}

export class ScreenshotTools {
  private page: Page | null = null;
  private screenshotChunkData: Map<string, ScreenshotChunk> = new Map();

  initialize(page: Page | null): void {
    this.page = page;
  }

  async capture(params: any = {}): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Use browser_navigate tool to open a webpage before taking screenshots.');
      }

      const {
        fullPage = false,
        quality = 80,
        selector,
        scrollTo,
        viewport
      } = params;

      console.log(`📸 Taking screenshot (fullPage: ${fullPage}, quality: ${quality})`);

      // Set viewport if specified
      if (viewport) {
        await this.page.setViewport(viewport);
      }

      // Scroll to position if specified
      if (typeof scrollTo === 'number') {
        await this.page.evaluate((y) => {
          window.scrollTo(0, y);
        }, scrollTo);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for scroll
      }

      let screenshotOptions: any = {
        type: 'png',
        fullPage,
        encoding: 'base64'
      };

      if (quality && quality < 100) {
        screenshotOptions.type = 'jpeg';
        screenshotOptions.quality = quality;
      }

      let screenshot: string;
      
      if (selector) {
        // Screenshot specific element
        const element = await this.page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}. Use agent_generate_page to see available elements, or try a different CSS selector.`);
        }
        screenshot = await element.screenshot(screenshotOptions) as string;
      } else {
        // Screenshot full page or viewport
        screenshot = await this.page.screenshot(screenshotOptions) as string;
      }

      // Check if screenshot needs to be chunked
      // Increased limit: Claude can handle ~25k tokens, base64 is roughly 1.33x original size
      // So a 50KB image = ~67KB base64 = ~67k chars. We'll use 45k as a safe limit.
      const shouldChunk = screenshot.length > 45000; // Safe limit for Claude (was 8800)
      console.log(`📸 Screenshot size: ${screenshot.length} chars, shouldChunk: ${shouldChunk}`)
      
      if (shouldChunk && fullPage) {
        // For full page screenshots that are too large, use pagination
        console.log(`📸 Full page screenshot too large (${screenshot.length} chars), switching to paginated capture`);
        
        // Call capturePaginated with appropriate parameters
        return await this.capturePaginated({
          quality: quality || 50, // Use lower quality for paginated screenshots
          overlap: 100 // Default overlap
        });
      } else if (shouldChunk && !fullPage) {
        // For viewport screenshots that are too large, reduce quality and retry
        console.log(`📸 Viewport screenshot too large (${screenshot.length} chars), reducing quality`);
        
        const reducedQuality = Math.min(30, quality * 0.5); // Reduce quality by half, max 30
        screenshotOptions.type = 'jpeg';
        screenshotOptions.quality = reducedQuality;
        
        screenshot = await this.page.screenshot(screenshotOptions) as string;
        
        if (screenshot.length > 45000) {
          // If still too large after quality reduction, chunk it
          console.log(`📸 Viewport screenshot still too large (${screenshot.length} chars) after quality reduction to ${reducedQuality}, chunking...`);
          
          // Store the screenshot for chunking
          const chunkId = randomUUID();
          this.screenshotChunkData.set(chunkId, {
            id: chunkId,
            totalChunks: Math.ceil(screenshot.length / 8000),
            chunks: this.splitScreenshotData(screenshot),
            metadata: {
              quality: reducedQuality,
              fullPage: false,
              timestamp: new Date()
            }
          });
          
          return {
            content: [{ 
              type: 'text', 
              text: `📸 Viewport screenshot captured but too large (${screenshot.length} chars).\n` +
                    `🧩 Automatically chunked into ${Math.ceil(screenshot.length / 8000)} pieces.\n` +
                    `📋 Chunk ID: ${chunkId}\n` +
                    `🔍 Use screenshot_get_chunk({id: "${chunkId}", chunk: 1}) to view the first chunk.`
            }]
          };
        }
        
        return {
          content: [{ 
            type: 'image', 
            data: screenshot, 
            mimeType: 'image/jpeg'
          }]
        };
      } else {
        // Screenshot is within size limits
        return {
          content: [{ 
            type: 'image', 
            data: screenshot, 
            mimeType: screenshotOptions.type === 'jpeg' ? 'image/jpeg' : 'image/png'
          }]
        };
      }

    } catch (error: any) {
      console.error('❌ Screenshot capture failed:', error);
      return {
        content: [{ type: 'text', text: `❌ Screenshot failed: ${error.message}` }]
      };
    }
  }

  async capturePaginated(params: any = {}): Promise<any> {
    try {
      if (!this.page) {
        throw new Error('No page available. Use browser_navigate tool to open a webpage before taking screenshots.');
      }

      const {
        segments,
        quality = 50, // Lower quality for paginated screenshots
        overlap = 100
      } = params;

      console.log(`📸 Taking paginated screenshots (segments: ${segments || 'auto'}, quality: ${quality})`);

      // Get page dimensions
      const dimensions = await this.page.evaluate(() => {
        return {
          width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
          viewportHeight: window.innerHeight
        };
      });

      // Calculate segments
      const totalSegments = segments || Math.ceil(dimensions.height / (dimensions.viewportHeight - overlap));
      const segmentHeight = Math.floor((dimensions.height - (totalSegments - 1) * overlap) / totalSegments);

      console.log(`📐 Page dimensions: ${dimensions.width}x${dimensions.height}`);
      console.log(`🧩 Creating ${totalSegments} segments of ${segmentHeight}px each`);

      const screenshots: string[] = [];
      
      for (let i = 0; i < totalSegments; i++) {
        const scrollY = i * (segmentHeight - overlap);
        
        console.log(`📸 Capturing segment ${i + 1}/${totalSegments} at scroll position ${scrollY}`);
        
        // Scroll to position
        await this.page.evaluate((y) => {
          window.scrollTo(0, y);
        }, scrollY);
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Take screenshot
        const screenshot = await this.page.screenshot({
          type: 'jpeg',
          quality,
          encoding: 'base64'
        }) as string;
        
        // Validate screenshot before adding to array
        if (screenshot && screenshot.length > 0) {
          screenshots.push(screenshot);
        } else {
          console.warn(`⚠️ Invalid screenshot for segment ${i + 1}, skipping`);
        }
      }

      // Validate that we have valid screenshots
      if (screenshots.length === 0) {
        throw new Error('Failed to capture any valid screenshots');
      }

      // Store chunked data
      const chunkId = randomUUID();
      this.screenshotChunkData.set(chunkId, {
        id: chunkId,
        totalChunks: screenshots.length,
        chunks: screenshots,
        metadata: {
          fullPage: true,
          quality,
          timestamp: new Date()
        }
      });

      return {
        content: [{ 
          type: 'text', 
          text: `📸 Paginated screenshots captured successfully!\n` +
                `🧩 Total segments: ${screenshots.length}\n` +
                `📋 Screenshot ID: ${chunkId}\n` +
                `🔍 Use screenshot_get_chunk({id: "${chunkId}", chunk: 1}) to view the first segment.`
        }]
      };

    } catch (error: any) {
      console.error('❌ Paginated screenshot failed:', error);
      return {
        content: [{ type: 'text', text: `❌ Paginated screenshot failed: ${error.message}` }]
      };
    }
  }

  async getChunk(id: string, chunk: number): Promise<any> {
    try {
      const chunkData = this.screenshotChunkData.get(id);
      
      if (!chunkData) {
        throw new Error(`Screenshot chunk ID not found: ${id}`);
      }

      if (chunk < 1 || chunk > chunkData.totalChunks) {
        throw new Error(`Invalid chunk number: ${chunk}. Available chunks: 1-${chunkData.totalChunks}`);
      }

      const screenshot = chunkData.chunks[chunk - 1];
      
      // Validate screenshot data before returning
      if (!screenshot || screenshot.length === 0) {
        throw new Error(`Screenshot chunk ${chunk} is empty or invalid. This may be due to a chunking error.`);
      }
      
      const mimeType = chunkData.metadata.quality < 100 ? 'image/jpeg' : 'image/png';

      return {
        content: [
          { 
            type: 'text', 
            text: `📸 Screenshot chunk ${chunk} of ${chunkData.totalChunks}\n📋 ID: ${id}` 
          },
          { 
            type: 'image', 
            data: screenshot, 
            mimeType 
          }
        ]
      };

    } catch (error: any) {
      console.error('❌ Error getting screenshot chunk:', error);
      return {
        content: [{ type: 'text', text: `❌ Error getting screenshot chunk: ${error.message}` }]
      };
    }
  }

  async getLoadingSequenceFrame(id: string, frame: number): Promise<any> {
    try {
      console.log(`🔍 Looking for loading sequence ID: ${id}`);
      console.log(`📊 Available chunk IDs: ${Array.from(this.screenshotChunkData.keys()).join(', ')}`);
      
      const chunkData = this.screenshotChunkData.get(id);
      
      if (!chunkData) {
        throw new Error(`Loading sequence ID not found: ${id}. Make sure you used browser_navigate_and_capture_loading_sequence first.`);
      }

      if (frame < 1 || frame > chunkData.totalChunks) {
        throw new Error(`Invalid frame number: ${frame}. Available frames: 1-${chunkData.totalChunks}`);
      }

      const screenshot = chunkData.chunks[frame - 1];
      
      // Validate screenshot data before returning
      if (!screenshot || screenshot.length === 0) {
        throw new Error(`Loading sequence frame ${frame} is empty or invalid. This may be due to a capture error.`);
      }
      
      const mimeType = 'image/jpeg'; // Loading sequences always use JPEG
      
      // Get frame metadata if available
      const frameMetadata = (chunkData.metadata as any).frameMetadata;
      let frameDescription = '';
      
      if (frameMetadata && frameMetadata[frame - 1]) {
        const meta = frameMetadata[frame - 1];
        frameDescription = `\n⏱️ Timestamp: ${meta.timestamp}ms\n📝 State: ${meta.description}`;
      }

      // Navigation hints
      const prevFrame = Math.max(1, frame - 1);
      const nextFrame = Math.min(chunkData.totalChunks, frame + 1);
      const navigationText = frame === 1 ? 
        `\n⏭️ Next: frame ${nextFrame}` :
        frame === chunkData.totalChunks ?
        `\n⏮️ Previous: frame ${prevFrame}` :
        `\n⏮️ Previous: frame ${prevFrame}\n⏭️ Next: frame ${nextFrame}`;

      return {
        content: [
          { 
            type: 'text', 
            text: `🎬 Loading sequence frame ${frame} of ${chunkData.totalChunks}${frameDescription}${navigationText}\n🆔 Sequence ID: ${id}` 
          },
          { 
            type: 'image', 
            data: screenshot, 
            mimeType 
          }
        ]
      };

    } catch (error: any) {
      console.error('❌ Error getting loading sequence frame:', error);
      return {
        content: [{ type: 'text', text: `❌ Error getting loading sequence frame: ${error.message}` }]
      };
    }
  }

  // Private helper methods removed - chunkLargeScreenshot was fundamentally flawed
  // We now use capturePaginated for large screenshots instead

  // Utility method to clean up old chunks
  // Split screenshot data into chunks
  private splitScreenshotData(screenshot: string): string[] {
    const chunkSize = 8000;
    const chunks: string[] = [];
    
    for (let i = 0; i < screenshot.length; i += chunkSize) {
      chunks.push(screenshot.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  cleanupOldChunks(maxAge: number = 3600000): void { // 1 hour default
    const now = Date.now();
    for (const [id, chunk] of this.screenshotChunkData.entries()) {
      if (now - chunk.metadata.timestamp.getTime() > maxAge) {
        this.screenshotChunkData.delete(id);
        console.log(`🧹 Cleaned up old screenshot chunks: ${id}`);
      }
    }
  }

  // Get chunk data for external access
  getChunkData(): Map<string, ScreenshotChunk> {
    return this.screenshotChunkData;
  }

  setChunkData(data: Map<string, ScreenshotChunk>): void {
    this.screenshotChunkData = data;
  }
}