// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Image Service
// AI-powered image generation and integration using Unsplash API
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import chalk from 'chalk';

// Curated image collections for professional results
const CURATED_COLLECTIONS = {
  hero: {
    tech: [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80',
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80',
      'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1920&q=80'
    ],
    business: [
      'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1920&q=80',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1920&q=80'
    ],
    creative: [
      'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=1920&q=80',
      'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=1920&q=80',
      'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1920&q=80',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1920&q=80',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80'
    ],
    nature: [
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80',
      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
      'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80'
    ],
    abstract: [
      'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&q=80',
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1920&q=80',
      'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920&q=80',
      'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=1920&q=80'
    ]
  },
  products: {
    tech: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
      'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80',
      'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=800&q=80',
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&q=80'
    ],
    fashion: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80',
      'https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=800&q=80'
    ],
    food: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
      'https://images.unsplash.com/photo-1482049016gy-d606572dc5de?w=800&q=80',
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80'
    ],
    lifestyle: [
      'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80',
      'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
      'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
      'https://images.unsplash.com/photo-1525328437458-0c4d4db7cab4?w=800&q=80'
    ]
  },
  team: [
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80'
  ],
  testimonials: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80'
  ],
  logos: [
    'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&q=80',
    'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=200&q=80',
    'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=200&q=80'
  ],
  icons: {
    general: [
      'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=100&q=80'
    ]
  },
  backgrounds: {
    gradient: [
      'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80',
      'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80',
      'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1920&q=80',
      'https://images.unsplash.com/photo-1557682260-96773eb01377?w=1920&q=80'
    ],
    pattern: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80',
      'https://images.unsplash.com/photo-1553356084-58ef4a67b2a7?w=1920&q=80'
    ]
  }
};

// Unsplash API configuration
const UNSPLASH_API_URL = 'https://api.unsplash.com';

/**
 * ImageService - AI-powered image generation and integration
 */
export class ImageService {
  constructor(options = {}) {
    this.accessKey = options.accessKey || process.env.UNSPLASH_ACCESS_KEY;
    this.downloadPath = options.downloadPath || './public/images';
    this.verbose = options.verbose || false;
  }

  /**
   * Search Unsplash for images
   */
  async searchImages(query, options = {}) {
    const {
      count = 5,
      orientation = 'landscape', // landscape, portrait, squarish
      size = 'regular' // raw, full, regular, small, thumb
    } = options;

    // If no API key, use curated fallback
    if (!this.accessKey) {
      return this.getCuratedImages(query, count);
    }

    try {
      const params = new URLSearchParams({
        query,
        per_page: count,
        orientation
      });

      const response = await this.fetchWithTimeout(
        `${UNSPLASH_API_URL}/search/photos?${params}`,
        {
          headers: {
            'Authorization': `Client-ID ${this.accessKey}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();

      return data.results.map(img => ({
        id: img.id,
        url: img.urls[size],
        downloadUrl: img.links.download_location,
        alt: img.alt_description || query,
        photographer: img.user.name,
        photographerUrl: img.user.links.html,
        width: img.width,
        height: img.height
      }));
    } catch (error) {
      if (this.verbose) {
        console.log(chalk.yellow(`  Unsplash API failed, using curated images`));
      }
      return this.getCuratedImages(query, count);
    }
  }

  /**
   * Get curated images based on query (fallback when no API key)
   */
  getCuratedImages(query, count = 5) {
    const queryLower = query.toLowerCase();
    let images = [];

    // Match query to curated collections
    if (queryLower.includes('hero') || queryLower.includes('banner')) {
      if (queryLower.includes('tech')) {
        images = CURATED_COLLECTIONS.hero.tech;
      } else if (queryLower.includes('business') || queryLower.includes('corporate')) {
        images = CURATED_COLLECTIONS.hero.business;
      } else if (queryLower.includes('creative') || queryLower.includes('design')) {
        images = CURATED_COLLECTIONS.hero.creative;
      } else if (queryLower.includes('nature') || queryLower.includes('outdoor')) {
        images = CURATED_COLLECTIONS.hero.nature;
      } else {
        images = CURATED_COLLECTIONS.hero.abstract;
      }
    } else if (queryLower.includes('product')) {
      if (queryLower.includes('tech') || queryLower.includes('gadget')) {
        images = CURATED_COLLECTIONS.products.tech;
      } else if (queryLower.includes('fashion') || queryLower.includes('clothing')) {
        images = CURATED_COLLECTIONS.products.fashion;
      } else if (queryLower.includes('food')) {
        images = CURATED_COLLECTIONS.products.food;
      } else {
        images = CURATED_COLLECTIONS.products.lifestyle;
      }
    } else if (queryLower.includes('team') || queryLower.includes('person') || queryLower.includes('people')) {
      images = CURATED_COLLECTIONS.team;
    } else if (queryLower.includes('testimonial') || queryLower.includes('avatar')) {
      images = CURATED_COLLECTIONS.testimonials;
    } else if (queryLower.includes('logo') || queryLower.includes('brand')) {
      images = CURATED_COLLECTIONS.logos;
    } else if (queryLower.includes('background') || queryLower.includes('bg')) {
      if (queryLower.includes('gradient')) {
        images = CURATED_COLLECTIONS.backgrounds.gradient;
      } else {
        images = CURATED_COLLECTIONS.backgrounds.pattern;
      }
    } else {
      // Default to abstract hero images
      images = CURATED_COLLECTIONS.hero.abstract;
    }

    // Shuffle and take requested count
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((url, index) => ({
      id: `curated-${index}`,
      url,
      downloadUrl: url,
      alt: query,
      photographer: 'Unsplash',
      photographerUrl: 'https://unsplash.com',
      width: 1920,
      height: 1080
    }));
  }

  /**
   * Download image to local path
   */
  async downloadImage(imageUrl, filename, options = {}) {
    const { directory = this.downloadPath } = options;

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    const filePath = path.join(directory, filename);

    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(filePath);

      https.get(imageUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          https.get(redirectUrl, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve(filePath);
            });
          }).on('error', reject);
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
      }).on('error', (err) => {
        fs.unlink(filePath).catch(() => {});
        reject(err);
      });
    });
  }

  /**
   * Generate images for a project
   */
  async generateProjectImages(projectPath, projectType, options = {}) {
    const {
      hero = true,
      products = 0,
      team = 0,
      testimonials = 0,
      theme = 'tech'
    } = options;

    const imagesDir = path.join(projectPath, 'public', 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    const results = {
      downloaded: [],
      failed: []
    };

    console.log(chalk.cyan('\n  📸 Generating project images...\n'));

    // Hero image
    if (hero) {
      try {
        const heroImages = await this.searchImages(`hero ${theme}`, { count: 1 });
        if (heroImages.length > 0) {
          const filename = 'hero.jpg';
          await this.downloadImage(heroImages[0].url, filename, { directory: imagesDir });
          results.downloaded.push({ type: 'hero', filename, url: heroImages[0].url });
          console.log(chalk.green(`    ✓ Hero image downloaded`));
        }
      } catch (error) {
        results.failed.push({ type: 'hero', error: error.message });
        console.log(chalk.yellow(`    ⚠ Hero image failed: ${error.message}`));
      }
    }

    // Product images
    if (products > 0) {
      try {
        const productImages = await this.searchImages(`product ${theme}`, { count: products });
        for (let i = 0; i < productImages.length; i++) {
          const filename = `product-${i + 1}.jpg`;
          await this.downloadImage(productImages[i].url, filename, { directory: imagesDir });
          results.downloaded.push({ type: 'product', filename, url: productImages[i].url });
        }
        console.log(chalk.green(`    ✓ ${productImages.length} product images downloaded`));
      } catch (error) {
        results.failed.push({ type: 'products', error: error.message });
        console.log(chalk.yellow(`    ⚠ Product images failed: ${error.message}`));
      }
    }

    // Team photos
    if (team > 0) {
      try {
        const teamImages = this.getCuratedImages('team', team);
        for (let i = 0; i < teamImages.length; i++) {
          const filename = `team-${i + 1}.jpg`;
          await this.downloadImage(teamImages[i].url, filename, { directory: imagesDir });
          results.downloaded.push({ type: 'team', filename, url: teamImages[i].url });
        }
        console.log(chalk.green(`    ✓ ${teamImages.length} team photos downloaded`));
      } catch (error) {
        results.failed.push({ type: 'team', error: error.message });
        console.log(chalk.yellow(`    ⚠ Team photos failed: ${error.message}`));
      }
    }

    // Testimonial avatars
    if (testimonials > 0) {
      try {
        const testimonialImages = this.getCuratedImages('testimonial', testimonials);
        for (let i = 0; i < testimonialImages.length; i++) {
          const filename = `testimonial-${i + 1}.jpg`;
          await this.downloadImage(testimonialImages[i].url, filename, { directory: imagesDir });
          results.downloaded.push({ type: 'testimonial', filename, url: testimonialImages[i].url });
        }
        console.log(chalk.green(`    ✓ ${testimonialImages.length} testimonial avatars downloaded`));
      } catch (error) {
        results.failed.push({ type: 'testimonials', error: error.message });
        console.log(chalk.yellow(`    ⚠ Testimonial avatars failed: ${error.message}`));
      }
    }

    console.log(chalk.gray(`\n    Total: ${results.downloaded.length} images downloaded to ${imagesDir}\n`));

    return results;
  }

  /**
   * Replace placeholder images in project files
   */
  async replacePlaceholders(projectPath, options = {}) {
    const { extensions = ['.js', '.jsx', '.tsx', '.html', '.vue', '.svelte'] } = options;

    const placeholderPatterns = [
      /https?:\/\/via\.placeholder\.com\/\d+x?\d*/g,
      /https?:\/\/placehold\.co\/\d+x?\d*/g,
      /https?:\/\/placekitten\.com\/\d+\/?\d*/g,
      /https?:\/\/picsum\.photos\/\d+\/?\d*/g,
      /\/placeholder\.(jpg|png|svg)/g
    ];

    let replacedCount = 0;

    const processFile = async (filePath) => {
      try {
        let content = await fs.readFile(filePath, 'utf-8');
        let modified = false;

        for (const pattern of placeholderPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            for (const match of matches) {
              // Determine replacement based on context
              const images = this.getCuratedImages('abstract', 1);
              if (images.length > 0) {
                content = content.replace(match, images[0].url);
                modified = true;
                replacedCount++;
              }
            }
          }
        }

        if (modified) {
          await fs.writeFile(filePath, content);
          if (this.verbose) {
            console.log(chalk.gray(`    Updated: ${path.relative(projectPath, filePath)}`));
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const walkDir = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules and hidden directories
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              await walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (extensions.includes(ext)) {
              await processFile(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await walkDir(projectPath);

    return { replacedCount };
  }

  /**
   * Fetch with timeout helper
   */
  async fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

/**
 * Create ImageService instance
 */
export function createImageService(options = {}) {
  return new ImageService(options);
}

/**
 * Quick image search helper
 */
export async function searchImages(query, options = {}) {
  const service = createImageService(options);
  return service.searchImages(query, options);
}

/**
 * Generate images for project helper
 */
export async function generateImages(projectPath, projectType, options = {}) {
  const service = createImageService(options);
  return service.generateProjectImages(projectPath, projectType, options);
}

/**
 * Get curated collection
 */
export function getCuratedCollection(type, subtype = null) {
  if (subtype && CURATED_COLLECTIONS[type]?.[subtype]) {
    return CURATED_COLLECTIONS[type][subtype];
  }
  return CURATED_COLLECTIONS[type] || [];
}

export { CURATED_COLLECTIONS };
