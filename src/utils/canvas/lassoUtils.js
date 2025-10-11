/**
 * Lasso Selection Utilities
 * Implements freeform selection for strokes
 */

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param {Object} point - Point with x, y coordinates
 * @param {Array} polygon - Array of points forming the polygon
 * @returns {boolean} - True if point is inside polygon
 */
export const isPointInPolygon = (point, polygon) => {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  const x = point.x;
  const y = point.y;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

/**
 * Check if a stroke intersects with the lasso path
 * @param {Array} strokePoints - Points of the stroke
 * @param {Array} lassoPoints - Points forming the lasso boundary
 * @returns {boolean} - True if stroke intersects lasso
 */
export const doesStrokeIntersectLasso = (strokePoints, lassoPoints) => {
  if (!strokePoints || !lassoPoints || lassoPoints.length < 3) return false;

  // Check if any segment of the stroke crosses the lasso boundary
  for (let i = 0; i < strokePoints.length - 1; i++) {
    const p1 = strokePoints[i];
    const p2 = strokePoints[i + 1];

    for (let j = 0; j < lassoPoints.length - 1; j++) {
      const p3 = lassoPoints[j];
      const p4 = lassoPoints[j + 1];

      if (doSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if two line segments intersect
 */
const doSegmentsIntersect = (p1, p2, p3, p4) => {
  const ccw = (A, B, C) => {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  };

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
};

/**
 * Find all strokes that are enclosed or intersected by the lasso
 * @param {Array} lassoPoints - Points forming the lasso path
 * @param {Array} strokes - Array of stroke objects
 * @param {number} threshold - Minimum ratio of points inside (0-1)
 * @returns {Array} - Array of selected stroke IDs
 */
export const findStrokesInLasso = (lassoPoints, strokes, threshold = 0.5) => {
  if (!lassoPoints || lassoPoints.length < 3 || !strokes) {
    return [];
  }

  const selectedStrokeIds = [];

  strokes.forEach((stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;

    // Count how many points are inside the lasso
    let pointsInside = 0;
    stroke.points.forEach((point) => {
      if (isPointInPolygon(point, lassoPoints)) {
        pointsInside++;
      }
    });

    const ratio = pointsInside / stroke.points.length;

    // Select stroke if enough points are inside OR if it intersects the lasso
    const meetsThreshold = ratio >= threshold;
    const intersectsLasso = doesStrokeIntersectLasso(stroke.points, lassoPoints);

    if (meetsThreshold || (intersectsLasso && ratio > 0.2)) {
      selectedStrokeIds.push(stroke.id);
    }
  });

  return selectedStrokeIds;
};

/**
 * Calculate bounding box for selected strokes
 * @param {Array} strokes - Array of selected stroke objects
 * @returns {Object} - Bounding box with minX, maxX, minY, maxY
 */
export const getSelectionBoundingBox = (strokes) => {
  if (!strokes || strokes.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  strokes.forEach((stroke) => {
    if (!stroke.points) return;

    stroke.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

/**
 * Move selected strokes by delta
 * @param {Array} strokes - Array of stroke objects to move
 * @param {number} deltaX - Horizontal movement
 * @param {number} deltaY - Vertical movement
 * @returns {Array} - Updated strokes
 */
export const moveStrokes = (strokes, deltaX, deltaY) => {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({
      x: point.x + deltaX,
      y: point.y + deltaY,
    })),
  }));
};

/**
 * Check if a point is near the selection bounding box edges (for resize handles)
 * @param {Object} point - Point to check
 * @param {Object} boundingBox - Selection bounding box
 * @param {number} handleSize - Size of the handle hit area
 * @returns {string|null} - Handle position ('tl', 'tr', 'bl', 'br') or null
 */
export const getResizeHandle = (point, boundingBox, handleSize = 20) => {
  if (!boundingBox) return null;

  const { minX, maxX, minY, maxY } = boundingBox;
  const { x, y } = point;

  // Check corners
  if (Math.abs(x - minX) < handleSize && Math.abs(y - minY) < handleSize) {
    return 'tl'; // Top-left
  }
  if (Math.abs(x - maxX) < handleSize && Math.abs(y - minY) < handleSize) {
    return 'tr'; // Top-right
  }
  if (Math.abs(x - minX) < handleSize && Math.abs(y - maxY) < handleSize) {
    return 'bl'; // Bottom-left
  }
  if (Math.abs(x - maxX) < handleSize && Math.abs(y - maxY) < handleSize) {
    return 'br'; // Bottom-right
  }

  return null;
};

/**
 * Check if a point is inside the selection bounding box
 * @param {Object} point - Point to check
 * @param {Object} boundingBox - Selection bounding box
 * @returns {boolean} - True if point is inside
 */
export const isPointInBoundingBox = (point, boundingBox) => {
  if (!boundingBox) return false;

  const { minX, maxX, minY, maxY } = boundingBox;
  const { x, y } = point;

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
};

/**
 * Simplify lasso path by removing redundant points
 * @param {Array} points - Original lasso points
 * @param {number} tolerance - Distance tolerance for simplification
 * @returns {Array} - Simplified points
 */
export const simplifyLassoPath = (points, tolerance = 5) => {
  if (points.length <= 2) return points;

  const simplified = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = simplified[simplified.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Calculate distance from current point to line between prev and next
    const distance = pointToLineDistance(curr, prev, next);

    if (distance > tolerance) {
      simplified.push(curr);
    }
  }

  simplified.push(points[points.length - 1]);

  return simplified;
};

/**
 * Calculate perpendicular distance from point to line
 */
const pointToLineDistance = (point, lineStart, lineEnd) => {
  const { x, y } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;

  return Math.sqrt(dx * dx + dy * dy);
};




