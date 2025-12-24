// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE CLI - Template Gallery
// Professional templates for rapid project creation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Template definitions
 * Each template includes prompt, variables, and metadata
 */
export const TEMPLATES = {
  // ═══════════════════════════════════════════════════════════════════════════
  // LANDING PAGES
  // ═══════════════════════════════════════════════════════════════════════════

  'landing-minimal': {
    id: 'landing-minimal',
    name: 'Minimal Landing',
    category: 'landing',
    description: 'Clean, minimalist landing page with hero, features, CTA',
    tags: ['minimal', 'clean', 'startup'],
    stack: ['Next.js 14', 'Tailwind CSS'],
    features: [
      'Responsive hero section',
      'Features grid (3 columns)',
      'CTA section',
      'Footer with links'
    ],
    preview: 'https://templates.vibecode.dev/landing-minimal.png',
    prompt: `Create a minimal landing page with:
- Hero section: Large headline, subtitle, 2 CTA buttons (primary & secondary)
- Features: 3-column grid with icons and descriptions
- CTA section: Final call-to-action with email signup
- Footer: Links and copyright

Style: Clean, lots of whitespace, modern typography
Tech: Next.js 14 App Router, Tailwind CSS
Colors: Use a modern color palette with primary accent color`,
    variables: {
      name: { type: 'string', default: 'My Startup', description: 'Company name' },
      tagline: { type: 'string', default: 'Build something amazing', description: 'Main tagline' },
      primaryColor: { type: 'color', default: '#3B82F6', description: 'Primary brand color' }
    }
  },

  'landing-apple': {
    id: 'landing-apple',
    name: 'Apple Style Landing',
    category: 'landing',
    description: 'Premium Apple-inspired landing page with smooth animations',
    tags: ['premium', 'apple', 'luxury', 'animations'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Framer Motion'],
    features: [
      'Full-screen hero with scroll animations',
      'Product showcase sections',
      'Parallax effects',
      'Smooth scroll navigation',
      'Premium typography'
    ],
    preview: 'https://templates.vibecode.dev/landing-apple.png',
    prompt: `Create a premium Apple-style landing page:

Design Philosophy:
- Ultra-minimalist, massive whitespace
- Black/white/gray color scheme with subtle gradients
- Large, bold typography (SF Pro style or Inter)

Sections:
1. Hero: Full-screen with large product image, fade-in animation
2. Product Features: Side-by-side layout, image + text alternating
3. Specs/Details: Clean grid with icons
4. Final CTA: Centered, minimal

Animations:
- Smooth scroll between sections
- Fade-in on scroll (elements appear as you scroll)
- Subtle parallax on images
- Hover effects on interactive elements

Navigation: Sticky header, transparent, blur effect on scroll

Tech: Next.js 14 App Router, Tailwind CSS, Framer Motion`,
    variables: {
      productName: { type: 'string', default: 'Product', description: 'Product name' },
      theme: { type: 'select', options: ['dark', 'light'], default: 'dark', description: 'Color theme' }
    }
  },

  'landing-saas': {
    id: 'landing-saas',
    name: 'SaaS Landing',
    category: 'landing',
    description: 'Complete SaaS landing with pricing, testimonials, FAQ',
    tags: ['saas', 'startup', 'pricing', 'complete'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Lucide Icons'],
    features: [
      'Hero with product mockup',
      'Logo cloud / Trust badges',
      'Features section (6 features)',
      'Pricing table (3 tiers)',
      'Testimonials section',
      'FAQ accordion',
      'Newsletter signup',
      'Full footer with sitemap'
    ],
    preview: 'https://templates.vibecode.dev/landing-saas.png',
    prompt: `Create a complete SaaS landing page:

Sections:
1. Hero: Headline, subtitle, 2 CTA buttons, product screenshot/mockup
2. Logo Cloud: 5-6 trust badges or client logos
3. Features: 6 features in 2x3 grid with icons
4. How It Works: 3-step process
5. Pricing: 3 tiers (Starter $9/mo, Pro $29/mo, Enterprise custom)
6. Testimonials: 3 customer quotes with photos and company
7. FAQ: 5 questions in accordion format
8. Final CTA: Email signup, conversion focus
9. Footer: Full sitemap, social links, legal

Design:
- Modern, professional look
- Gradient backgrounds
- Card-based UI
- Lucide React icons

Tech: Next.js 14 App Router, Tailwind CSS, Lucide React`,
    variables: {
      name: { type: 'string', default: 'SaaSify', description: 'Product name' },
      pricing: { type: 'boolean', default: true, description: 'Include pricing section' }
    }
  },

  'landing-startup': {
    id: 'landing-startup',
    name: 'Startup Landing',
    category: 'landing',
    description: 'Modern startup landing with waitlist and social proof',
    tags: ['startup', 'waitlist', 'modern', 'gradient'],
    stack: ['Next.js 14', 'Tailwind CSS'],
    features: [
      'Gradient hero section',
      'Waitlist email capture',
      'Feature highlights',
      'Social proof counter',
      'Team section'
    ],
    preview: 'https://templates.vibecode.dev/landing-startup.png',
    prompt: `Create a modern startup landing page:

Sections:
1. Hero: Bold gradient background, waitlist signup form, "Join X others" counter
2. Problem/Solution: What problem you solve
3. Features: 4 key features with icons
4. Social Proof: Testimonial + metrics (users, countries, etc)
5. Team: Founder photos and bios (2-3 people)
6. CTA: Final waitlist signup
7. Footer: Minimal

Design:
- Vibrant gradient backgrounds (purple to blue or similar)
- Modern, energetic feel
- Rounded corners everywhere
- Animated counters

Tech: Next.js 14 App Router, Tailwind CSS`,
    variables: {
      name: { type: 'string', default: 'LaunchPad', description: 'Startup name' },
      waitlistCount: { type: 'number', default: 1247, description: 'Waitlist counter' }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARDS
  // ═══════════════════════════════════════════════════════════════════════════

  'dashboard-admin': {
    id: 'dashboard-admin',
    name: 'Admin Dashboard',
    category: 'dashboard',
    description: 'Full-featured admin dashboard with charts, tables, sidebar',
    tags: ['admin', 'dashboard', 'charts', 'tables'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Recharts', 'Lucide Icons'],
    features: [
      'Collapsible sidebar navigation',
      'Header with search & profile',
      'Dashboard overview cards (4 KPIs)',
      'Charts (line, bar, pie)',
      'Data table with pagination',
      'Dark/Light mode toggle'
    ],
    preview: 'https://templates.vibecode.dev/dashboard-admin.png',
    prompt: `Create an admin dashboard:

Layout:
- Sidebar: Collapsible, logo at top, navigation links, user menu at bottom
- Header: Search bar, notifications bell, profile dropdown
- Main: Content area with padding

Dashboard Page:
- 4 stat cards (Users, Revenue, Orders, Growth) with icons and trends
- Line chart: Revenue over time
- Bar chart: Sales by category
- Recent orders table with status badges
- Activity feed

Features:
- Dark/Light mode toggle in header
- Responsive (sidebar collapses on mobile)
- Table with sorting, filtering, pagination

Tech: Next.js 14 App Router, Tailwind CSS, Recharts, Lucide React`,
    variables: {
      name: { type: 'string', default: 'Admin Panel', description: 'Dashboard name' },
      darkMode: { type: 'boolean', default: true, description: 'Enable dark mode' }
    }
  },

  'dashboard-analytics': {
    id: 'dashboard-analytics',
    name: 'Analytics Dashboard',
    category: 'dashboard',
    description: 'Data-focused analytics dashboard with multiple chart types',
    tags: ['analytics', 'data', 'charts', 'metrics'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Recharts', 'date-fns'],
    features: [
      'Real-time metrics cards',
      'Multiple chart types',
      'Date range picker',
      'Export data button',
      'Responsive tables',
      'Comparison metrics'
    ],
    preview: 'https://templates.vibecode.dev/dashboard-analytics.png',
    prompt: `Create an analytics dashboard focused on data visualization:

Layout:
- Top bar with date range picker and export button
- Main content with grid of charts and tables

Components:
1. KPI Cards (6 total): Visitors, Page Views, Bounce Rate, Avg Session, Conversions, Revenue
   - Each with trend indicator (+/-%)
2. Main Chart: Large area chart showing traffic over time
3. Secondary Charts:
   - Bar chart: Top pages
   - Pie chart: Traffic sources
   - Line chart: Conversions
4. Data Table: Detailed metrics with sortable columns

Features:
- Date range selector (Last 7 days, 30 days, 90 days, Custom)
- Export to CSV button
- Real-time updates simulation
- Responsive grid layout

Tech: Next.js 14 App Router, Tailwind CSS, Recharts, date-fns`,
    variables: {
      metrics: { type: 'string', default: 'users,revenue,sessions', description: 'Metrics to display' }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // E-COMMERCE
  // ═══════════════════════════════════════════════════════════════════════════

  'ecommerce-store': {
    id: 'ecommerce-store',
    name: 'E-commerce Store',
    category: 'ecommerce',
    description: 'Complete e-commerce store with product pages, cart, checkout',
    tags: ['ecommerce', 'shop', 'cart', 'products'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Zustand'],
    features: [
      'Homepage with featured products',
      'Product listing with filters',
      'Product detail page',
      'Shopping cart (slide-out)',
      'Checkout flow',
      'Responsive design'
    ],
    preview: 'https://templates.vibecode.dev/ecommerce-store.png',
    prompt: `Create an e-commerce store:

Pages:
1. Homepage:
   - Hero banner with sale/promo
   - Featured products grid
   - Category cards
   - Newsletter signup

2. Products Page (/products):
   - Sidebar filters (category, price range, color)
   - Product grid with hover effects
   - Sort dropdown (price, newest, popular)
   - Pagination

3. Product Detail (/products/[id]):
   - Image gallery with thumbnails
   - Product info (name, price, description)
   - Size/variant selector
   - Add to cart button
   - Related products

4. Cart (slide-out panel):
   - Product list with quantity controls
   - Remove item button
   - Subtotal calculation
   - Checkout button

5. Checkout (/checkout):
   - Multi-step: Shipping > Payment > Review
   - Form validation
   - Order summary sidebar

State Management: Zustand for cart
Tech: Next.js 14 App Router, Tailwind CSS, Zustand`,
    variables: {
      storeName: { type: 'string', default: 'My Store', description: 'Store name' },
      currency: { type: 'string', default: 'USD', description: 'Currency code' }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOGS
  // ═══════════════════════════════════════════════════════════════════════════

  'blog-minimal': {
    id: 'blog-minimal',
    name: 'Minimal Blog',
    category: 'blog',
    description: 'Clean, fast blog with MDX support',
    tags: ['blog', 'minimal', 'mdx', 'content'],
    stack: ['Next.js 14', 'Tailwind CSS', 'MDX'],
    features: [
      'Homepage with post list',
      'Post page with MDX support',
      'Categories and tags',
      'Search functionality',
      'RSS feed',
      'SEO optimized'
    ],
    preview: 'https://templates.vibecode.dev/blog-minimal.png',
    prompt: `Create a minimal blog:

Pages:
1. Homepage (/):
   - Header with logo and nav
   - Featured post (large)
   - Recent posts list with excerpts
   - Sidebar with categories and about

2. Post Page (/posts/[slug]):
   - Post header (title, date, author, read time)
   - MDX content with typography styles
   - Share buttons
   - Author bio
   - Related posts

3. Category Page (/category/[slug]):
   - Category title and description
   - Posts in that category

4. About Page (/about):
   - Author info and photo
   - Social links

Features:
- MDX support for rich content
- Code syntax highlighting
- Table of contents
- SEO meta tags and OpenGraph
- RSS feed (/feed.xml)
- Sitemap

Design: Clean typography, lots of whitespace, easy to read
Tech: Next.js 14 App Router, Tailwind CSS, next-mdx-remote or @next/mdx`,
    variables: {
      blogName: { type: 'string', default: 'My Blog', description: 'Blog name' },
      postsPerPage: { type: 'number', default: 10, description: 'Posts per page' }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTFOLIOS
  // ═══════════════════════════════════════════════════════════════════════════

  'portfolio-developer': {
    id: 'portfolio-developer',
    name: 'Developer Portfolio',
    category: 'portfolio',
    description: 'Modern developer portfolio with projects, skills, contact',
    tags: ['portfolio', 'developer', 'personal', 'resume'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Framer Motion'],
    features: [
      'Hero with introduction',
      'About section',
      'Skills/Tech stack display',
      'Projects showcase',
      'Experience timeline',
      'Contact form'
    ],
    preview: 'https://templates.vibecode.dev/portfolio-developer.png',
    prompt: `Create a developer portfolio:

Sections:
1. Hero:
   - Name and title
   - Short tagline
   - Social links (GitHub, LinkedIn, Twitter)
   - CTA button (Contact me)

2. About:
   - Photo
   - Bio paragraph
   - Download resume button

3. Skills:
   - Tech stack grid with icons
   - Skill categories (Frontend, Backend, Tools)
   - Proficiency indicators or tags

4. Projects:
   - Grid of 4-6 projects
   - Each: Image, title, description, tech tags
   - Links to live demo and GitHub

5. Experience:
   - Timeline layout
   - Job title, company, dates
   - Brief description

6. Contact:
   - Contact form (name, email, message)
   - Or direct email link
   - Social links

Animations:
- Scroll-triggered fade-ins
- Hover effects on project cards
- Smooth scroll navigation

Tech: Next.js 14 App Router, Tailwind CSS, Framer Motion`,
    variables: {
      name: { type: 'string', default: 'John Doe', description: 'Your name' },
      title: { type: 'string', default: 'Full Stack Developer', description: 'Your title' }
    }
  },

  'portfolio-creative': {
    id: 'portfolio-creative',
    name: 'Creative Portfolio',
    category: 'portfolio',
    description: 'Visual portfolio for designers and creatives',
    tags: ['portfolio', 'creative', 'designer', 'visual'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Framer Motion'],
    features: [
      'Full-screen project showcases',
      'Image galleries',
      'Smooth transitions',
      'Minimal navigation',
      'Case study pages'
    ],
    preview: 'https://templates.vibecode.dev/portfolio-creative.png',
    prompt: `Create a creative portfolio for designers:

Design Philosophy:
- Let the work speak for itself
- Minimal UI, maximum focus on visuals
- Smooth, cinematic transitions

Pages:
1. Homepage:
   - Full-screen project grid or list
   - Hover effects reveal project info
   - Minimal header with name and nav

2. Project Page (/work/[slug]):
   - Full-width hero image
   - Project details (client, role, year)
   - Image gallery with lightbox
   - Description and process
   - Next/Previous project navigation

3. About:
   - Large photo
   - Bio
   - Services offered
   - Contact info

Features:
- Page transitions (fade or slide)
- Cursor effects (optional)
- Image lazy loading
- Smooth scroll

Tech: Next.js 14 App Router, Tailwind CSS, Framer Motion`,
    variables: {
      name: { type: 'string', default: 'Jane Smith', description: 'Your name' },
      specialty: { type: 'string', default: 'UI/UX Designer', description: 'Your specialty' }
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // APPS
  // ═══════════════════════════════════════════════════════════════════════════

  'app-todo': {
    id: 'app-todo',
    name: 'Todo App',
    category: 'app',
    description: 'Feature-rich todo app with categories and due dates',
    tags: ['app', 'todo', 'productivity'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Zustand', 'date-fns'],
    features: [
      'Add/Edit/Delete todos',
      'Categories/Projects',
      'Due dates with calendar',
      'Priority levels',
      'Search & Filter',
      'Local storage persistence'
    ],
    preview: 'https://templates.vibecode.dev/app-todo.png',
    prompt: `Create a todo application:

Layout:
- Sidebar: Projects/Categories list, Add project button
- Main: Todo list with input at top

Features:
1. Todo CRUD:
   - Add todo with title
   - Edit inline
   - Delete with confirmation
   - Mark complete with checkbox

2. Organization:
   - Projects/Categories (Inbox, Personal, Work, etc)
   - Due date picker
   - Priority (Low, Medium, High)
   - Tags

3. Filters:
   - All / Today / Upcoming / Completed
   - By project
   - By priority
   - Search by text

4. UI:
   - Clean, minimal design
   - Keyboard shortcuts (Enter to add, etc)
   - Drag and drop reorder (optional)

State: Zustand with localStorage persistence
Tech: Next.js 14 App Router, Tailwind CSS, Zustand, date-fns`,
    variables: {
      appName: { type: 'string', default: 'TaskFlow', description: 'App name' }
    }
  },

  'app-chat': {
    id: 'app-chat',
    name: 'Chat Interface',
    category: 'app',
    description: 'Real-time chat UI with modern design',
    tags: ['app', 'chat', 'messaging', 'ui'],
    stack: ['Next.js 14', 'Tailwind CSS'],
    features: [
      'Chat list sidebar',
      'Message thread view',
      'Message input with emoji',
      'User avatars',
      'Typing indicator',
      'Message timestamps'
    ],
    preview: 'https://templates.vibecode.dev/app-chat.png',
    prompt: `Create a chat interface (UI only with mock data):

Layout:
- Sidebar: Chat/conversation list
- Main: Active chat messages
- Optional: User details panel

Sidebar:
- Search conversations
- Chat list items: Avatar, name, last message preview, time, unread badge

Messages Area:
- Header: User name, status, actions (call, info)
- Messages: Bubbles (sent vs received styling), timestamps, read receipts
- Input: Text field, emoji button, attachment button, send

Features:
- Typing indicator animation
- Online/offline status dots
- Message grouping by time
- Unread message indicators
- Responsive (mobile shows one panel at a time)

Mock Data: Include sample conversations and messages
Tech: Next.js 14 App Router, Tailwind CSS`,
    variables: {}
  },

  'app-notes': {
    id: 'app-notes',
    name: 'Notes App',
    category: 'app',
    description: 'Notion-like notes app with rich text editor',
    tags: ['app', 'notes', 'editor', 'productivity'],
    stack: ['Next.js 14', 'Tailwind CSS', 'Tiptap'],
    features: [
      'Rich text editor',
      'Folder organization',
      'Search notes',
      'Markdown support',
      'Local storage'
    ],
    preview: 'https://templates.vibecode.dev/app-notes.png',
    prompt: `Create a notes application similar to Notion:

Layout:
- Sidebar: Folders/pages tree
- Main: Note editor

Features:
1. Organization:
   - Create folders
   - Create pages within folders
   - Drag to reorder
   - Favorites section

2. Editor:
   - Rich text (bold, italic, headings, lists)
   - Code blocks
   - Images
   - Checkboxes
   - Dividers

3. Other:
   - Search across all notes
   - Autosave
   - Last edited timestamp
   - Dark/Light mode

Tech: Next.js 14 App Router, Tailwind CSS, Tiptap editor
State: Local storage persistence`,
    variables: {
      appName: { type: 'string', default: 'Notes', description: 'App name' }
    }
  }
};

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category) {
  return Object.values(TEMPLATES).filter(t => t.category === category);
}

/**
 * Get all categories with counts
 */
export function getCategories() {
  const categoryMap = new Map();

  for (const template of Object.values(TEMPLATES)) {
    const existing = categoryMap.get(template.category) || 0;
    categoryMap.set(template.category, existing + 1);
  }

  return Array.from(categoryMap.entries()).map(([id, count]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    count
  }));
}

/**
 * Search templates by query
 */
export function searchTemplates(query) {
  const q = query.toLowerCase();
  return Object.values(TEMPLATES).filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q)) ||
    t.category.toLowerCase().includes(q)
  );
}

/**
 * Get template by ID
 */
export function getTemplate(id) {
  return TEMPLATES[id] || null;
}

/**
 * Get category icon
 */
export function getCategoryIcon(category) {
  const icons = {
    landing: '🌐',
    dashboard: '📊',
    ecommerce: '🛒',
    blog: '📝',
    portfolio: '💼',
    app: '📱'
  };
  return icons[category] || '📦';
}

/**
 * Get all template IDs
 */
export function getTemplateIds() {
  return Object.keys(TEMPLATES);
}

/**
 * Validate template ID
 */
export function isValidTemplate(id) {
  return id in TEMPLATES;
}
