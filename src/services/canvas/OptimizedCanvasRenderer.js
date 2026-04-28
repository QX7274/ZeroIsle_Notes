import { Platform } from 'react-native';

class OptimizedCanvasRenderer {
  constructor() {
    this.viewport = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scale: 1.0,
    };

    this.renderCache = new Map();
    this.dirtyRegions = new Set();
    this.visibleObjects = new Set();
    this.renderQueue = [];

    // Performance monitoring
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.averageFPS = 60;

    // Memory management
    this.memoryThreshold = 200 * 1024 * 1024; // 200MB
    this.cacheSize = 0;

    // GPU acceleration support
    this.gpuAccelerated = Platform.OS === 'ios' || Platform.OS === 'android';
    this.webglContext = null;

    this.initializeRenderer();
  }

  /**
   * Initialize the renderer with platform-specific optimizations
   */
  initializeRenderer() {
    if (this.gpuAccelerated) {
      this.initializeGPUAcceleration();
    }

    // Set up viewport culling
    this.setupViewportCulling();

    // Initialize memory management
    this.setupMemoryManagement();
  }

  /**
   * Initialize GPU acceleration for supported platforms
   */
  initializeGPUAcceleration() {
    try {
      // Platform-specific GPU initialization would go here
      // This is a simplified version for demonstration
      this.gpuBuffers = new Map();
      this.shaderPrograms = new Map();

      console.log('GPU acceleration initialized');
    } catch (error) {
      console.warn('GPU acceleration failed to initialize:', error);
      this.gpuAccelerated = false;
    }
  }

  /**
   * Set up viewport-based culling system
   */
  setupViewportCulling() {
    this.spatialIndex = new QuadTree({
      x: -10000,
      y: -10000,
      width: 20000,
      height: 20000,
    });
  }

  /**
   * Set up memory management system
   */
  setupMemoryManagement() {
    // Monitor memory usage
    this.memoryMonitor = setInterval(() => {
      this.checkMemoryUsage();
    }, 5000);

    // Set up cache cleanup
    this.cacheCleanup = setInterval(() => {
      this.cleanupCache();
    }, 30000);
  }

  /**
   * Update viewport and trigger culling
   * @param {Object} viewport - New viewport parameters
   */
  updateViewport(viewport) {
    const oldViewport = { ...this.viewport };
    this.viewport = { ...viewport };

    // Check if significant viewport change occurred
    const significantChange =
      Math.abs(oldViewport.x - viewport.x) > 100 ||
      Math.abs(oldViewport.y - viewport.y) > 100 ||
      Math.abs(oldViewport.scale - viewport.scale) > 0.1;

    if (significantChange) {
      this.updateVisibleObjects();
      this.invalidateCache();
    }
  }

  /**
   * Update the set of visible objects based on current viewport
   */
  updateVisibleObjects() {
    const viewportBounds = {
      x: this.viewport.x - this.viewport.width / (2 * this.viewport.scale),
      y: this.viewport.y - this.viewport.height / (2 * this.viewport.scale),
      width: this.viewport.width / this.viewport.scale,
      height: this.viewport.height / this.viewport.scale,
    };

    // Query spatial index for visible objects
    const visibleObjects = this.spatialIndex.query(viewportBounds);

    // Update visible set
    this.visibleObjects.clear();
    visibleObjects.forEach(obj => this.visibleObjects.add(obj.id));
  }

  /**
   * Render strokes with optimization
   * @param {Array} strokes - Array of stroke objects
   * @param {Object} context - Rendering context
   */
  renderStrokes(strokes, context) {
    const startTime = performance.now();

    try {
      // Filter visible strokes
      const visibleStrokes = strokes.filter(stroke =>
        this.isStrokeVisible(stroke)
      );

      if (this.gpuAccelerated) {
        this.renderStrokesGPU(visibleStrokes, context);
      } else {
        this.renderStrokesCPU(visibleStrokes, context);
      }

      // Update performance metrics
      this.updatePerformanceMetrics(startTime);

    } catch (error) {
      console.error('Rendering failed:', error);
      // Fallback to basic rendering
      this.renderStrokesBasic(strokes, context);
    }
  }

  /**
   * GPU-accelerated stroke rendering
   * @param {Array} strokes - Visible strokes
   * @param {Object} context - Rendering context
   */
  renderStrokesGPU(strokes, context) {
    // Group strokes by rendering properties for batching
    const strokeBatches = this.groupStrokesByProperties(strokes);

    strokeBatches.forEach(batch => {
      this.renderStrokeBatch(batch, context);
    });
  }

  /**
   * CPU-optimized stroke rendering with caching
   * @param {Array} strokes - Visible strokes
   * @param {Object} context - Rendering context
   */
  renderStrokesCPU(strokes, context) {
    // Use level-of-detail rendering based on zoom
    const lodLevel = this.calculateLODLevel(this.viewport.scale);

    strokes.forEach(stroke => {
      const cacheKey = this.generateStrokeCacheKey(stroke, lodLevel);

      if (this.renderCache.has(cacheKey)) {
        this.renderCachedStroke(cacheKey, context);
      } else {
        this.renderAndCacheStroke(stroke, cacheKey, lodLevel, context);
      }
    });
  }

  /**
   * Group strokes by rendering properties for batch processing
   * @param {Array} strokes - Array of strokes
   * @returns {Array} Grouped stroke batches
   */
  groupStrokesByProperties(strokes) {
    const batches = new Map();

    strokes.forEach(stroke => {
      const key = `${stroke.color}-${stroke.width}-${stroke.tool}`;

      if (!batches.has(key)) {
        batches.set(key, {
          properties: {
            color: stroke.color,
            width: stroke.width,
            tool: stroke.tool,
          },
          strokes: [],
        });
      }

      batches.get(key).strokes.push(stroke);
    });

    return Array.from(batches.values());
  }

  /**
   * Calculate level-of-detail based on zoom level
   * @param {number} scale - Current zoom scale
   * @returns {number} LOD level (0-3)
   */
  calculateLODLevel(scale) {
    if (scale < 0.25) {return 0;} // Lowest detail
    if (scale < 0.5) {return 1;}  // Low detail
    if (scale < 2.0) {return 2;}  // Normal detail
    return 3; // High detail
  }

  /**
   * Check if stroke is visible in current viewport
   * @param {Object} stroke - Stroke object
   * @returns {boolean} Whether stroke is visible
   */
  isStrokeVisible(stroke) {
    if (!stroke.bounds) {
      stroke.bounds = this.calculateStrokeBounds(stroke);
    }

    return this.boundsIntersectViewport(stroke.bounds);
  }

  /**
   * Calculate bounding box for a stroke
   * @param {Object} stroke - Stroke object
   * @returns {Object} Bounding box
   */
  calculateStrokeBounds(stroke) {
    if (!stroke.points || stroke.points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = stroke.points[0].x;
    let maxX = stroke.points[0].x;
    let minY = stroke.points[0].y;
    let maxY = stroke.points[0].y;

    stroke.points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    // Add stroke width padding
    const padding = (stroke.width || 2) / 2;

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding,
    };
  }

  /**
   * Check if bounds intersect with current viewport
   * @param {Object} bounds - Bounding box
   * @returns {boolean} Whether bounds intersect viewport
   */
  boundsIntersectViewport(bounds) {
    const viewportBounds = {
      x: this.viewport.x - this.viewport.width / (2 * this.viewport.scale),
      y: this.viewport.y - this.viewport.height / (2 * this.viewport.scale),
      width: this.viewport.width / this.viewport.scale,
      height: this.viewport.height / this.viewport.scale,
    };

    return !(
      bounds.x + bounds.width < viewportBounds.x ||
      bounds.x > viewportBounds.x + viewportBounds.width ||
      bounds.y + bounds.height < viewportBounds.y ||
      bounds.y > viewportBounds.y + viewportBounds.height
    );
  }

  /**
   * Generate cache key for stroke rendering
   * @param {Object} stroke - Stroke object
   * @param {number} lodLevel - Level of detail
   * @returns {string} Cache key
   */
  generateStrokeCacheKey(stroke, lodLevel) {
    return `${stroke.id}-${lodLevel}-${this.viewport.scale.toFixed(2)}`;
  }

  /**
   * Render and cache a stroke
   * @param {Object} stroke - Stroke object
   * @param {string} cacheKey - Cache key
   * @param {number} lodLevel - Level of detail
   * @param {Object} context - Rendering context
   */
  renderAndCacheStroke(stroke, cacheKey, lodLevel, context) {
    // Render stroke with appropriate LOD
    const renderedStroke = this.renderStrokeWithLOD(stroke, lodLevel, context);

    // Cache the rendered result
    this.cacheRenderedStroke(cacheKey, renderedStroke);
  }

  /**
   * Render stroke with level-of-detail optimization
   * @param {Object} stroke - Stroke object
   * @param {number} lodLevel - Level of detail
   * @param {Object} context - Rendering context
   * @returns {Object} Rendered stroke data
   */
  renderStrokeWithLOD(stroke, lodLevel, context) {
    let points = stroke.points;

    // Simplify points based on LOD level
    if (lodLevel < 3 && points.length > 10) {
      points = this.simplifyPoints(points, lodLevel);
    }

    // Render with appropriate quality
    return this.renderStrokePoints(points, stroke, context);
  }

  /**
   * Simplify stroke points based on LOD level
   * @param {Array} points - Original points
   * @param {number} lodLevel - Level of detail
   * @returns {Array} Simplified points
   */
  simplifyPoints(points, lodLevel) {
    const tolerance = [5.0, 3.0, 1.0, 0.5][lodLevel];
    return this.douglasPeucker(points, tolerance);
  }

  /**
   * Douglas-Peucker algorithm for point simplification
   * @param {Array} points - Points to simplify
   * @param {number} tolerance - Simplification tolerance
   * @returns {Array} Simplified points
   */
  douglasPeucker(points, tolerance) {
    if (points.length <= 2) {return points;}

    let maxDistance = 0;
    let maxIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(
        points[i],
        points[0],
        points[points.length - 1]
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > tolerance) {
      const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const right = this.douglasPeucker(points.slice(maxIndex), tolerance);

      return left.slice(0, -1).concat(right);
    } else {
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * Calculate perpendicular distance from point to line
   * @param {Object} point - Point to measure
   * @param {Object} lineStart - Line start point
   * @param {Object} lineEnd - Line end point
   * @returns {number} Perpendicular distance
   */
  perpendicularDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {return Math.sqrt(A * A + B * B);}

    const param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  checkMemoryUsage() {
    // Estimate current memory usage
    const estimatedUsage = this.estimateMemoryUsage();

    if (estimatedUsage > this.memoryThreshold) {
      this.performMemoryCleanup();
    }
  }

  /**
   * Estimate current memory usage
   * @returns {number} Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    let totalSize = 0;

    // Estimate cache size
    for (const [key, value] of this.renderCache.entries()) {
      totalSize += key.length * 2; // String size
      totalSize += this.estimateObjectSize(value);
    }

    return totalSize;
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    // Remove oldest cache entries
    const entries = Array.from(this.renderCache.entries());
    const toRemove = Math.floor(entries.length * 0.3); // Remove 30%

    entries
      .sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0))
      .slice(0, toRemove)
      .forEach(([key]) => this.renderCache.delete(key));

    console.log(`Memory cleanup: removed ${toRemove} cache entries`);
  }

  /**
   * Update performance metrics
   * @param {number} startTime - Render start time
   */
  updatePerformanceMetrics(startTime) {
    const frameTime = performance.now() - startTime;
    this.frameCount++;

    // Calculate rolling average FPS
    if (this.lastFrameTime > 0) {
      const fps = 1000 / (startTime - this.lastFrameTime);
      this.averageFPS = (this.averageFPS * 0.9) + (fps * 0.1);
    }

    this.lastFrameTime = startTime;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getPerformanceStats() {
    return {
      averageFPS: Math.round(this.averageFPS),
      frameCount: this.frameCount,
      cacheSize: this.renderCache.size,
      visibleObjects: this.visibleObjects.size,
      memoryUsage: this.estimateMemoryUsage(),
      gpuAccelerated: this.gpuAccelerated,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }

    if (this.cacheCleanup) {
      clearInterval(this.cacheCleanup);
    }

    this.renderCache.clear();
    this.dirtyRegions.clear();
    this.visibleObjects.clear();
  }
}

// Simple QuadTree implementation for spatial indexing
class QuadTree {
  constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
    this.bounds = bounds;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }

  split() {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;

    this.nodes[0] = new QuadTree({
      x: x + subWidth,
      y: y,
      width: subWidth,
      height: subHeight,
    }, this.maxObjects, this.maxLevels, this.level + 1);

    this.nodes[1] = new QuadTree({
      x: x,
      y: y,
      width: subWidth,
      height: subHeight,
    }, this.maxObjects, this.maxLevels, this.level + 1);

    this.nodes[2] = new QuadTree({
      x: x,
      y: y + subHeight,
      width: subWidth,
      height: subHeight,
    }, this.maxObjects, this.maxLevels, this.level + 1);

    this.nodes[3] = new QuadTree({
      x: x + subWidth,
      y: y + subHeight,
      width: subWidth,
      height: subHeight,
    }, this.maxObjects, this.maxLevels, this.level + 1);
  }

  getIndex(bounds) {
    let index = -1;
    const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
    const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);

    const topQuadrant = (bounds.y < horizontalMidpoint && bounds.y + bounds.height < horizontalMidpoint);
    const bottomQuadrant = (bounds.y > horizontalMidpoint);

    if (bounds.x < verticalMidpoint && bounds.x + bounds.width < verticalMidpoint) {
      if (topQuadrant) {
        index = 1;
      } else if (bottomQuadrant) {
        index = 2;
      }
    } else if (bounds.x > verticalMidpoint) {
      if (topQuadrant) {
        index = 0;
      } else if (bottomQuadrant) {
        index = 3;
      }
    }

    return index;
  }

  insert(bounds, object) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(bounds);

      if (index !== -1) {
        this.nodes[index].insert(bounds, object);
        return;
      }
    }

    this.objects.push({ bounds, object });

    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.split();
      }

      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i].bounds);
        if (index !== -1) {
          this.nodes[index].insert(this.objects[i].bounds, this.objects[i].object);
          this.objects.splice(i, 1);
        } else {
          i++;
        }
      }
    }
  }

  query(bounds, found = []) {
    const index = this.getIndex(bounds);
    if (index !== -1 && this.nodes.length > 0) {
      this.nodes[index].query(bounds, found);
    }

    for (const obj of this.objects) {
      if (this.intersects(bounds, obj.bounds)) {
        found.push(obj.object);
      }
    }

    if (this.nodes.length > 0) {
      for (const node of this.nodes) {
        if (this.intersects(bounds, node.bounds)) {
          node.query(bounds, found);
        }
      }
    }

    return found;
  }

  intersects(rect1, rect2) {
    return !(rect1.x > rect2.x + rect2.width ||
             rect1.x + rect1.width < rect2.x ||
             rect1.y > rect2.y + rect2.height ||
             rect1.y + rect1.height < rect2.y);
  }
}

export default OptimizedCanvasRenderer;
