// ═══════════════════════════════════════════════════════════════════════════════
// VIBECODE AGENT - Decomposition Engine
// Breaks projects into modules with dependency analysis
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common module patterns for automatic detection
 */
const MODULE_PATTERNS = {
  // Core Infrastructure
  core: {
    keywords: ['setup', 'config', 'init', 'base', 'foundation', 'core'],
    priority: 0,
    dependencies: []
  },

  // Authentication & Authorization
  auth: {
    keywords: ['auth', 'login', 'signup', 'register', 'password', 'oauth', 'jwt', 'session'],
    priority: 1,
    dependencies: ['core']
  },

  // Database & Data Layer
  database: {
    keywords: ['database', 'db', 'schema', 'model', 'entity', 'migration', 'orm'],
    priority: 1,
    dependencies: ['core']
  },

  // API Layer
  api: {
    keywords: ['api', 'endpoint', 'route', 'rest', 'graphql', 'controller'],
    priority: 2,
    dependencies: ['core', 'database']
  },

  // User Management
  users: {
    keywords: ['user', 'profile', 'account', 'member', 'admin'],
    priority: 3,
    dependencies: ['auth', 'database']
  },

  // Dashboard & Admin
  dashboard: {
    keywords: ['dashboard', 'admin', 'panel', 'analytics', 'stats', 'metrics'],
    priority: 4,
    dependencies: ['auth', 'users']
  },

  // Billing & Payments
  billing: {
    keywords: ['billing', 'payment', 'stripe', 'subscription', 'pricing', 'checkout', 'invoice'],
    priority: 4,
    dependencies: ['auth', 'users']
  },

  // Notifications
  notifications: {
    keywords: ['notification', 'email', 'sms', 'push', 'alert', 'message'],
    priority: 4,
    dependencies: ['users']
  },

  // UI Components
  ui: {
    keywords: ['component', 'button', 'form', 'modal', 'ui', 'layout', 'navigation', 'header', 'footer'],
    priority: 2,
    dependencies: ['core']
  },

  // Pages & Views
  pages: {
    keywords: ['page', 'view', 'screen', 'landing', 'home', 'about', 'contact'],
    priority: 5,
    dependencies: ['ui']
  },

  // Testing
  tests: {
    keywords: ['test', 'spec', 'e2e', 'unit', 'integration'],
    priority: 6,
    dependencies: [] // Tests depend on what they test, handled dynamically
  }
};

/**
 * Project type templates for smart decomposition
 */
const PROJECT_TEMPLATES = {
  'landing': {
    modules: ['core', 'ui', 'pages'],
    description: 'Simple landing page'
  },
  'saas': {
    modules: ['core', 'database', 'auth', 'users', 'dashboard', 'billing', 'ui', 'pages'],
    description: 'Full SaaS application'
  },
  'api': {
    modules: ['core', 'database', 'auth', 'api', 'tests'],
    description: 'REST API backend'
  },
  'cli': {
    modules: ['core', 'api', 'tests'],
    description: 'Command-line tool'
  },
  'fullstack': {
    modules: ['core', 'database', 'auth', 'api', 'users', 'ui', 'pages', 'tests'],
    description: 'Full-stack web application'
  }
};

/**
 * Decomposition Engine Class
 * Analyzes project requirements and breaks them into buildable modules
 */
export class DecompositionEngine {
  constructor() {
    this.modules = [];
    this.dependencyGraph = new Map();
  }

  /**
   * Analyze description and decompose into modules
   * @param {string} description - Project description
   * @param {object} options - Decomposition options
   * @returns {object} Decomposition result
   */
  async decompose(description, options = {}) {
    const lowerDesc = description.toLowerCase();

    // Detect project type
    const projectType = this.detectProjectType(lowerDesc);

    // Get base modules from template
    let detectedModules = projectType
      ? [...PROJECT_TEMPLATES[projectType].modules]
      : ['core'];

    // Detect additional modules from description
    const additionalModules = this.detectModulesFromDescription(lowerDesc);

    // Merge modules (avoid duplicates)
    detectedModules = [...new Set([...detectedModules, ...additionalModules])];

    // Build module objects with metadata
    this.modules = this.buildModuleObjects(detectedModules, description);

    // Build dependency graph
    this.dependencyGraph = this.buildDependencyGraph(this.modules);

    // Get build order using topological sort
    const buildOrder = this.topologicalSort();

    return {
      projectType: projectType || 'custom',
      totalModules: this.modules.length,
      modules: this.modules,
      buildOrder,
      dependencyGraph: this.serializeDependencyGraph(),
      estimatedComplexity: this.estimateComplexity()
    };
  }

  /**
   * Detect project type from description
   */
  detectProjectType(description) {
    const typeKeywords = {
      landing: ['landing', 'landing page', 'one page', 'single page', 'portfolio'],
      saas: ['saas', 'subscription', 'billing', 'multi-tenant', 'b2b', 'software as a service'],
      api: ['api', 'rest api', 'graphql', 'backend', 'microservice'],
      cli: ['cli', 'command line', 'terminal', 'shell'],
      fullstack: ['fullstack', 'full stack', 'web app', 'web application']
    };

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(kw => description.includes(kw))) {
        return type;
      }
    }

    // Default heuristics
    if (description.includes('login') || description.includes('auth')) {
      return 'fullstack';
    }
    if (description.includes('page') || description.includes('website')) {
      return 'landing';
    }

    return null;
  }

  /**
   * Detect modules from description keywords
   */
  detectModulesFromDescription(description) {
    const detected = [];

    for (const [moduleName, config] of Object.entries(MODULE_PATTERNS)) {
      const hasKeyword = config.keywords.some(kw => description.includes(kw));
      if (hasKeyword) {
        detected.push(moduleName);
        // Also add dependencies
        detected.push(...config.dependencies);
      }
    }

    return [...new Set(detected)];
  }

  /**
   * Build module objects with full metadata
   */
  buildModuleObjects(moduleNames, description) {
    return moduleNames.map(name => {
      const pattern = MODULE_PATTERNS[name] || {
        keywords: [name],
        priority: 5,
        dependencies: ['core']
      };

      return {
        id: name,
        name: this.formatModuleName(name),
        description: this.generateModuleDescription(name, description),
        priority: pattern.priority,
        dependencies: pattern.dependencies.filter(dep => moduleNames.includes(dep)),
        status: 'pending',
        estimatedSize: this.estimateModuleSize(name),
        files: [],
        buildAttempts: 0,
        errors: []
      };
    });
  }

  /**
   * Format module name for display
   */
  formatModuleName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
  }

  /**
   * Generate module description based on context
   */
  generateModuleDescription(moduleName, projectDescription) {
    const descriptions = {
      core: 'Project setup, configuration, and base infrastructure',
      auth: 'Authentication system with login, signup, and session management',
      database: 'Database schema, models, and data layer',
      api: 'API endpoints and route handlers',
      users: 'User management, profiles, and account settings',
      dashboard: 'Admin dashboard and analytics views',
      billing: 'Payment processing, subscriptions, and invoicing',
      notifications: 'Email, push, and in-app notification system',
      ui: 'Reusable UI components and design system',
      pages: 'Application pages and views',
      tests: 'Unit, integration, and end-to-end tests'
    };

    return descriptions[moduleName] || `${this.formatModuleName(moduleName)} module`;
  }

  /**
   * Estimate module size (small, medium, large)
   */
  estimateModuleSize(moduleName) {
    const largeMods = ['auth', 'billing', 'dashboard', 'api'];
    const mediumMods = ['users', 'database', 'ui', 'pages'];

    if (largeMods.includes(moduleName)) return 'large';
    if (mediumMods.includes(moduleName)) return 'medium';
    return 'small';
  }

  /**
   * Build dependency graph as Map
   */
  buildDependencyGraph(modules) {
    const graph = new Map();

    for (const mod of modules) {
      graph.set(mod.id, {
        module: mod,
        dependsOn: mod.dependencies,
        dependedBy: []
      });
    }

    // Build reverse dependencies
    for (const mod of modules) {
      for (const dep of mod.dependencies) {
        if (graph.has(dep)) {
          graph.get(dep).dependedBy.push(mod.id);
        }
      }
    }

    return graph;
  }

  /**
   * Topological sort for build order
   * Uses Kahn's algorithm
   */
  topologicalSort() {
    const inDegree = new Map();
    const queue = [];
    const result = [];

    // Initialize in-degrees
    for (const mod of this.modules) {
      inDegree.set(mod.id, mod.dependencies.length);
      if (mod.dependencies.length === 0) {
        queue.push(mod.id);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const current = queue.shift();
      result.push(current);

      const node = this.dependencyGraph.get(current);
      if (node) {
        for (const dependent of node.dependedBy) {
          const newDegree = inDegree.get(dependent) - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    // Check for cycles
    if (result.length !== this.modules.length) {
      console.warn('Circular dependency detected, falling back to priority order');
      return this.modules
        .sort((a, b) => a.priority - b.priority)
        .map(m => m.id);
    }

    return result;
  }

  /**
   * Serialize dependency graph for storage
   */
  serializeDependencyGraph() {
    const serialized = {};
    for (const [key, value] of this.dependencyGraph) {
      serialized[key] = {
        dependsOn: value.dependsOn,
        dependedBy: value.dependedBy
      };
    }
    return serialized;
  }

  /**
   * Estimate overall project complexity
   */
  estimateComplexity() {
    const sizeWeights = { small: 1, medium: 2, large: 3 };
    const totalWeight = this.modules.reduce((sum, mod) => {
      return sum + sizeWeights[mod.estimatedSize];
    }, 0);

    if (totalWeight <= 5) return 'simple';
    if (totalWeight <= 10) return 'moderate';
    if (totalWeight <= 15) return 'complex';
    return 'enterprise';
  }

  /**
   * Get module by ID
   */
  getModule(moduleId) {
    return this.modules.find(m => m.id === moduleId);
  }

  /**
   * Update module status
   */
  updateModuleStatus(moduleId, status, data = {}) {
    const mod = this.getModule(moduleId);
    if (mod) {
      mod.status = status;
      Object.assign(mod, data);
    }
    return mod;
  }

  /**
   * Check if module can be built (dependencies satisfied)
   */
  canBuildModule(moduleId) {
    const mod = this.getModule(moduleId);
    if (!mod) return false;

    return mod.dependencies.every(depId => {
      const dep = this.getModule(depId);
      return dep && dep.status === 'completed';
    });
  }

  /**
   * Get next buildable modules
   */
  getNextBuildableModules() {
    return this.modules.filter(mod =>
      mod.status === 'pending' && this.canBuildModule(mod.id)
    );
  }

  /**
   * Generate module prompt for Claude Code
   */
  generateModulePrompt(moduleId, context = {}) {
    const mod = this.getModule(moduleId);
    if (!mod) return null;

    const completedModules = this.modules
      .filter(m => m.status === 'completed')
      .map(m => `- ${m.name}: ${m.files.join(', ')}`)
      .join('\n');

    return `
# Module: ${mod.name}

## Description
${mod.description}

## Dependencies
${mod.dependencies.length > 0
  ? mod.dependencies.map(d => `- ${this.formatModuleName(d)}`).join('\n')
  : 'No dependencies'}

## Already Built
${completedModules || 'None yet'}

## Context
${context.projectDescription || 'Build this module according to best practices.'}

## Requirements
- Follow existing code patterns from completed modules
- Ensure compatibility with dependencies
- Include necessary exports for dependent modules
- Add appropriate error handling

## Instructions
Build the ${mod.name} module. Create all necessary files and ensure they integrate with existing code.
`;
  }
}

/**
 * Create decomposition engine instance
 */
export function createDecompositionEngine() {
  return new DecompositionEngine();
}

/**
 * Quick decompose helper
 */
export async function decomposeProject(description, options = {}) {
  const engine = new DecompositionEngine();
  return engine.decompose(description, options);
}

export { MODULE_PATTERNS, PROJECT_TEMPLATES };
