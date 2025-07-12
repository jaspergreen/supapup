import { JSDOM } from 'jsdom';
import { NodeHtmlMarkdown } from 'node-html-markdown';

export interface ContentOptions {
  maxLength?: number;
  page?: number;
  pageSize?: number;
  maxElements?: number; // New: limit DOM processing
}

export interface ContentResult {
  content: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
    totalElements?: number;
    processedElements?: number;
  };
}

export class ContentExtractor {
  private static nhm = new NodeHtmlMarkdown({
    // Configure for better Wikipedia handling
    strongDelimiter: '**',
    emDelimiter: '*',
    bulletMarker: '-',
    maxConsecutiveNewlines: 2,
    // Custom rules for better content extraction
    ignore: ['script', 'style', 'nav', 'header', 'footer', '.navbox', '.infobox-sidebar'],
  });

  /**
   * Extract readable content from HTML with chunked processing
   */
  static extractReadableContent(html: string, url?: string, options: ContentOptions = {}): ContentResult {
    try {
      const { maxLength = 50000, page, pageSize = 20000, maxElements = 100 } = options;
      
      console.log(`[ContentExtractor] Processing HTML (length: ${html.length})`);
      
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Find main content WITHOUT modifying DOM
      const mainContent = this.findMainContent(document);
      
      if (!mainContent) {
        console.error('[ContentExtractor] Could not find main content area');
        return { content: 'Error: Could not find main content area on page' };
      }

      // If chunked processing requested, process elements in batches
      if (page !== undefined || maxElements < 1000) {
        return this.extractContentChunked(mainContent, url, options);
      }

      // Full content extraction - convert HTML to markdown directly
      const cleanHtml = this.cleanHtmlForMarkdown(mainContent.innerHTML);
      const markdown = this.convertToMarkdown(cleanHtml, url);

      // Handle pagination if content is too long
      if (markdown.length > maxLength) {
        const totalPages = Math.ceil(markdown.length / pageSize);
        return {
          content: markdown.substring(0, maxLength) + '\n\n[... Content truncated. Use page parameter to read more ...]',
          pagination: {
            currentPage: 1,
            totalPages,
            hasMore: true
          }
        };
      }

      return { content: markdown };
    } catch (error: any) {
      console.error('[ContentExtractor] Error:', error);
      return { 
        content: `Error extracting content: ${error.message}. Try using chunked processing with page parameter.` 
      };
    }
  }

  /**
   * Extract content in chunks to handle large pages
   */
  private static extractContentChunked(container: Element, url?: string, options: ContentOptions = {}): ContentResult {
    const { page = 1, pageSize = 20000, maxElements = 100 } = options;
    
    try {
      // Get all content elements (paragraphs, headings, lists, etc.)
      const contentElements = Array.from(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, article, section, div[class*="content"], div[class*="text"]'))
        .filter(el => {
          const text = el.textContent?.trim() || '';
          return text.length > 10; // Only elements with substantial text
        });

      console.log(`[ContentExtractor] Found ${contentElements.length} content elements`);
      
      const totalPages = Math.ceil(contentElements.length / maxElements);
      
      if (page < 1 || page > totalPages) {
        return {
          content: `❌ Invalid page number. Valid range: 1-${totalPages}`,
          pagination: {
            currentPage: page,
            totalPages,
            hasMore: false,
            totalElements: contentElements.length
          }
        };
      }

      // Get elements for this page
      const startIndex = (page - 1) * maxElements;
      const endIndex = Math.min(startIndex + maxElements, contentElements.length);
      const pageElements = contentElements.slice(startIndex, endIndex);

      console.log(`[ContentExtractor] Processing page ${page}: elements ${startIndex}-${endIndex} of ${contentElements.length}`);

      // Create a temporary container with just this page's elements
      const tempContainer = container.ownerDocument.createElement('div');
      pageElements.forEach(el => {
        tempContainer.appendChild(el.cloneNode(true));
      });

      // Convert to markdown
      const markdown = this.convertToMarkdown(tempContainer.innerHTML, url);
      
      let content = markdown;
      if (page === 1 && url) {
        content = `# Page Content: ${url}\n\n` + content;
      }

      return {
        content,
        pagination: {
          currentPage: page,
          totalPages,
          hasMore: page < totalPages,
          totalElements: contentElements.length,
          processedElements: pageElements.length
        }
      };
    } catch (error: any) {
      console.error('[ContentExtractor] Chunked processing error:', error);
      return { 
        content: `Error in chunked processing: ${error.message}`,
        pagination: {
          currentPage: page,
          totalPages: 1,
          hasMore: false
        }
      };
    }
  }

  /**
   * Convert HTML to markdown using node-html-markdown
   */
  private static convertToMarkdown(html: string, url?: string): string {
    try {
      let markdown = this.nhm.translate(html);
      
      // Clean up excessive whitespace
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
        .replace(/[ \t]+$/gm, '')    // Remove trailing spaces
        .trim();

      return markdown;
    } catch (error: any) {
      console.error('[ContentExtractor] Markdown conversion error:', error);
      // Fallback to plain text
      const tempDiv = new JSDOM(html).window.document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || '';
    }
  }

  /**
   * Find main content area without modifying DOM
   */
  private static findMainContent(document: Document): Element | null {
    // Priority order for content containers
    const contentSelectors = [
      // Wikipedia specific
      '#mw-content-text',
      '.mw-body-content', 
      '#bodyContent',
      '#content',
      
      // Generic content containers
      'main',
      '[role="main"]',
      '.main-content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.page-content',
      'article',
      
      // Google search results
      '#search',
      '#center_col',
      '.g',
      '.rc',
      
      // Fallbacks
      '#main',
      '.container',
      'body'
    ];

    for (const selector of contentSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 100) {
          console.log(`[ContentExtractor] Using content selector: ${selector} (${element.textContent.length} chars)`);
          return element;
        }
      } catch (e: any) {
        console.log(`[ContentExtractor] Selector error for ${selector}: ${e.message}`);
      }
    }

    console.log('[ContentExtractor] No suitable content container found');
    return null;
  }

  /**
   * Clean HTML for markdown conversion without modifying original DOM
   */
  private static cleanHtmlForMarkdown(html: string): string {
    // Create a temporary DOM just for cleaning
    const tempDom = new JSDOM(html);
    const tempDoc = tempDom.window.document;
    
    // Remove unwanted elements from the temporary DOM
    this.removeUnwantedElementsFromTemp(tempDoc);
    
    return tempDoc.body?.innerHTML || html;
  }

  /**
   * Remove unwanted elements from temporary document
   */
  private static removeUnwantedElementsFromTemp(document: Document): void {
    const unwantedSelectors = [
      // Scripts and styles
      'script', 'style', 'noscript',
      
      // Media that doesn't translate to text well  
      'iframe', 'embed', 'object', 'svg', 'canvas', 'video', 'audio',
      
      // Navigation and UI elements
      'nav', 'header', 'footer', '.navigation', '.nav', '.menu',
      '.breadcrumb', '.toc', '.table-of-contents',
      
      // Wikipedia specific clutter
      '.navbox', '.navbox-inner', '.mbox', '.ambox', '.dmbox', '.cmbox',
      '.infobox', '.sidebar', '.vertical-navbox', 
      '.mw-editsection', '.mw-headline-anchor', '.citation', '.reference',
      
      // Ads and tracking
      '[class*="ad"]', '[id*="ad"]', '[class*="advertisement"]',
      '[class*="banner"]', '[class*="popup"]', '[class*="modal"]',
      '[class*="cookie"]', '[class*="gdpr"]', '[class*="consent"]',
      
      // Form elements
      'form', 'input', 'button', 'select', 'textarea',
      
      // Hidden elements
      '[style*="display: none"]', '[style*="display:none"]',
      '[hidden]', '.hidden', '.sr-only',
    ];

    unwantedSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      } catch (e) {
        // Ignore selector errors
      }
    });
  }


  /**
   * Paginate content for large documents
   */
  static paginateContent(content: string, page: number, pageSize: number): ContentResult {
    const totalPages = Math.ceil(content.length / pageSize);
    
    if (page < 1 || page > totalPages) {
      return {
        content: `❌ Invalid page number. Valid range: 1-${totalPages}`,
        pagination: {
          currentPage: page,
          totalPages,
          hasMore: false
        }
      };
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, content.length);
    const pageContent = content.substring(startIndex, endIndex);

    return {
      content: pageContent,
      pagination: {
        currentPage: page,
        totalPages,
        hasMore: page < totalPages
      }
    };
  }

  /**
   * Extract just plain text without markdown formatting
   */
  static extractPlainText(html: string, options: ContentOptions = {}): ContentResult {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const content = this.findMainContent(document);
      
      if (!content) {
        return { content: 'Error: Could not find main content area on page' };
      }

      const text = content.textContent?.trim() || '';
      
      if (options.page !== undefined) {
        return this.paginateContent(text, options.page, options.pageSize || 20000);
      }

      return { content: text };
    } catch (error: any) {
      console.error('[ContentExtractor] Plain text extraction error:', error);
      return { content: 'Error extracting plain text from page' };
    }
  }
}