// Responsive Testing Utilities for Supapup

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
}

export const DEVICE_PRESETS: Record<string, DevicePreset> = {
  // iPhones
  'iphone-se': {
    name: 'iPhone SE',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  'iphone-12': {
    name: 'iPhone 12/13',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  'iphone-14-pro': {
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  
  // Android
  'pixel-5': {
    name: 'Pixel 5',
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36'
  },
  'samsung-s21': {
    name: 'Samsung S21',
    width: 360,
    height: 800,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Samsung S21) AppleWebKit/537.36'
  },
  
  // Tablets
  'ipad': {
    name: 'iPad',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  'ipad-pro': {
    name: 'iPad Pro 12.9"',
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  
  // Desktop
  'desktop-1080': {
    name: 'Desktop HD',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  },
  'desktop-1440': {
    name: 'Desktop 2K',
    width: 2560,
    height: 1440,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  },
  'laptop': {
    name: 'Laptop',
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  },
  
  // Common breakpoints
  'mobile-small': {
    name: 'Mobile Small',
    width: 320,
    height: 568,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  },
  'mobile-medium': {
    name: 'Mobile Medium',
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  },
  'tablet-portrait': {
    name: 'Tablet Portrait',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  },
  'tablet-landscape': {
    name: 'Tablet Landscape',
    width: 1024,
    height: 768,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  }
};

export interface ResponsiveTestResult {
  device: string;
  width: number;
  height: number;
  screenshot?: string;
  issues?: string[];
  metrics?: {
    horizontalScroll: boolean;
    verticalScroll: boolean;
    viewportCoverage: number;
    elementsOutOfBounds: number;
    textTruncated: number;
  };
}

export class ResponsiveTester {
  // Test for common responsive issues
  static async detectLayoutIssues(page: any): Promise<string[]> {
    return await page.evaluate(() => {
      const issues: string[] = [];
      
      // Check for horizontal scroll
      if (document.documentElement.scrollWidth > window.innerWidth) {
        issues.push('Horizontal scroll detected - content wider than viewport');
      }
      
      // Check for elements outside viewport
      const elements = document.querySelectorAll('*');
      let outOfBounds = 0;
      
      elements.forEach((el: Element) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth || rect.left < 0) {
          outOfBounds++;
        }
      });
      
      if (outOfBounds > 0) {
        issues.push(`${outOfBounds} elements extend outside viewport`);
      }
      
      // Check for text overflow
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div');
      let textOverflow = 0;
      
      textElements.forEach((el: Element) => {
        const element = el as HTMLElement;
        if (element.scrollWidth > element.clientWidth) {
          textOverflow++;
        }
      });
      
      if (textOverflow > 0) {
        issues.push(`${textOverflow} elements have text overflow`);
      }
      
      // Check for images larger than viewport
      const images = document.querySelectorAll('img');
      let oversizedImages = 0;
      
      images.forEach((img: HTMLImageElement) => {
        if (img.naturalWidth > window.innerWidth) {
          oversizedImages++;
        }
      });
      
      if (oversizedImages > 0) {
        issues.push(`${oversizedImages} images are larger than viewport`);
      }
      
      // Check for fixed elements that might overlap on mobile
      const fixedElements = Array.from(elements).filter((el: Element) => {
        const style = window.getComputedStyle(el);
        return style.position === 'fixed' || style.position === 'sticky';
      });
      
      if (fixedElements.length > 2) {
        issues.push(`${fixedElements.length} fixed/sticky elements might cause mobile issues`);
      }
      
      return issues;
    });
  }
  
  // Get layout metrics
  static async getLayoutMetrics(page: any) {
    return await page.evaluate(() => {
      const hasHorizontalScroll = document.documentElement.scrollWidth > window.innerWidth;
      const hasVerticalScroll = document.documentElement.scrollHeight > window.innerHeight;
      
      // Calculate viewport coverage
      const viewportArea = window.innerWidth * window.innerHeight;
      const contentArea = document.documentElement.scrollWidth * document.documentElement.scrollHeight;
      const viewportCoverage = Math.min(viewportArea / contentArea, 1) * 100;
      
      // Count out of bounds elements
      const elements = document.querySelectorAll('*');
      let elementsOutOfBounds = 0;
      let textTruncated = 0;
      
      elements.forEach((el: Element) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth || rect.left < 0 || rect.bottom > window.innerHeight || rect.top < 0) {
          elementsOutOfBounds++;
        }
        
        const element = el as HTMLElement;
        if (element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) {
          textTruncated++;
        }
      });
      
      return {
        horizontalScroll: hasHorizontalScroll,
        verticalScroll: hasVerticalScroll,
        viewportCoverage,
        elementsOutOfBounds,
        textTruncated
      };
    });
  }
}