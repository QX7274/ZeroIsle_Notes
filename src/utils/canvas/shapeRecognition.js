/**
 * Shape Recognition Utility
 * Detects geometric shapes from hand-drawn strokes
 */

/**
 * Calculate distance between two points
 */
const distance = (p1, p2) => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Calculate center point of an array of points
 */
const getCenterPoint = (points) => {
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
};

/**
 * Calculate bounding box for points
 */
const getBoundingBox = (points) => {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
};

/**
 * Detect if points form a circle
 */
const detectCircle = (points) => {
  if (points.length < 10) {return { isShape: false };}

  const center = getCenterPoint(points);
  const distances = points.map(p => distance(p, center));
  const avgRadius = distances.reduce((a, b) => a + b, 0) / distances.length;

  // Calculate variance
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgRadius, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);
  const tolerance = avgRadius * 0.15; // 15% tolerance

  const isCircle = stdDev < tolerance;

  // Check if start and end points are close (closed shape)
  const closureDistance = distance(points[0], points[points.length - 1]);
  const isClosed = closureDistance < avgRadius * 0.3;

  return {
    isShape: isCircle && isClosed,
    confidence: isCircle && isClosed ? Math.max(0, 1 - stdDev / tolerance) : 0,
    params: { center, radius: avgRadius },
  };
};

/**
 * Detect if points form a rectangle
 */
const detectRectangle = (points) => {
  if (points.length < 12) {return { isShape: false };}

  const box = getBoundingBox(points);

  // Check if aspect ratio is reasonable (not too thin)
  const aspectRatio = Math.max(box.width, box.height) / Math.min(box.width, box.height);
  if (aspectRatio > 10) {return { isShape: false };}

  // Count points near corners and edges
  const cornerThreshold = Math.min(box.width, box.height) * 0.1;
  const corners = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];

  let nearCornerCount = 0;
  let nearEdgeCount = 0;

  points.forEach(p => {
    // Check if near any corner
    const nearCorner = corners.some(c => distance(p, c) < cornerThreshold);
    if (nearCorner) {
      nearCornerCount++;
      return;
    }

    // Check if near any edge
    const nearLeftEdge = Math.abs(p.x - box.minX) < cornerThreshold;
    const nearRightEdge = Math.abs(p.x - box.maxX) < cornerThreshold;
    const nearTopEdge = Math.abs(p.y - box.minY) < cornerThreshold;
    const nearBottomEdge = Math.abs(p.y - box.maxY) < cornerThreshold;

    if (nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge) {
      nearEdgeCount++;
    }
  });

  const edgeRatio = (nearCornerCount + nearEdgeCount) / points.length;
  const isRectangle = edgeRatio > 0.7;

  return {
    isShape: isRectangle,
    confidence: isRectangle ? Math.min(edgeRatio, 1) : 0,
    params: {
      x: box.minX,
      y: box.minY,
      width: box.width,
      height: box.height,
    },
  };
};

/**
 * Detect if points form a line
 */
const detectLine = (points) => {
  if (points.length < 3) {return { isShape: false };}

  const box = getBoundingBox(points);
  const aspectRatio = Math.max(box.width, box.height) / Math.min(box.width, box.height);

  // Must be elongated
  if (aspectRatio < 4) {return { isShape: false };}

  // Linear regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate average distance from line
  const avgDistance = points.reduce((sum, p) => {
    const expectedY = slope * p.x + intercept;
    return sum + Math.abs(p.y - expectedY);
  }, 0) / n;

  const threshold = Math.max(box.width, box.height) * 0.05;
  const isLine = avgDistance < threshold;

  return {
    isShape: isLine,
    confidence: isLine ? Math.max(0, 1 - avgDistance / threshold) : 0,
    params: {
      start: points[0],
      end: points[points.length - 1],
      slope,
      intercept,
    },
  };
};

/**
 * Detect if points form a triangle
 */
const detectTriangle = (points) => {
  if (points.length < 9) {return { isShape: false };}

  // Find three corner points by detecting direction changes
  const corners = [];
  const angleThreshold = Math.PI / 4; // 45 degrees

  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[i + 1];

    const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
    const angleDiff = Math.abs(angle2 - angle1);

    if (angleDiff > angleThreshold && angleDiff < Math.PI - angleThreshold) {
      corners.push(p2);
    }
  }

  // Should have approximately 3 corners
  if (corners.length < 2 || corners.length > 4) {
    return { isShape: false };
  }

  // Use first, middle, and last corner as triangle vertices
  const vertices = [
    corners[0],
    corners[Math.floor(corners.length / 2)],
    corners[corners.length - 1],
  ];

  return {
    isShape: corners.length === 3,
    confidence: corners.length === 3 ? 0.8 : 0.5,
    params: { vertices },
  };
};

/**
 * Detect if points form an ellipse
 */
const detectEllipse = (points) => {
  if (points.length < 12) {return { isShape: false };}

  const box = getBoundingBox(points);
  const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  const radiusX = box.width / 2;
  const radiusY = box.height / 2;

  // Check if aspect ratio suggests ellipse vs circle
  const aspectRatio = Math.max(radiusX, radiusY) / Math.min(radiusX, radiusY);
  if (aspectRatio < 1.3) {return { isShape: false };} // Too circular, should be detected as circle

  // Calculate how well points fit ellipse equation
  let errorSum = 0;
  points.forEach(p => {
    const normalizedX = (p.x - center.x) / radiusX;
    const normalizedY = (p.y - center.y) / radiusY;
    const ellipseValue = normalizedX * normalizedX + normalizedY * normalizedY;
    errorSum += Math.abs(ellipseValue - 1);
  });

  const avgError = errorSum / points.length;
  const isEllipse = avgError < 0.15;

  // Check closure
  const closureDistance = distance(points[0], points[points.length - 1]);
  const isClosed = closureDistance < Math.max(radiusX, radiusY) * 0.3;

  return {
    isShape: isEllipse && isClosed,
    confidence: isEllipse && isClosed ? Math.max(0, 1 - avgError / 0.15) : 0,
    params: { center, radiusX, radiusY },
  };
};

/**
 * Detect if points form an arrow
 */
const detectArrow = (points) => {
  if (points.length < 8) {return { isShape: false };}

  // Check if main body is linear
  const mainPoints = points.slice(0, Math.floor(points.length * 0.7));
  const lineResult = detectLine(mainPoints);

  if (!lineResult.isShape) {return { isShape: false };}

  // Check if end points form arrow head
  const endPoints = points.slice(Math.floor(points.length * 0.7));
  const box = getBoundingBox(endPoints);

  // Arrow head should be relatively small compared to shaft
  const shaftLength = distance(points[0], points[Math.floor(points.length * 0.7)]);
  const headSize = Math.max(box.width, box.height);

  const isArrow = headSize / shaftLength < 0.4 && headSize / shaftLength > 0.1;

  return {
    isShape: isArrow,
    confidence: isArrow ? 0.7 : 0,
    params: {
      start: points[0],
      end: points[points.length - 1],
      shaftLength,
      headSize,
    },
  };
};

/**
 * Main shape recognition function
 * @param {Array} points - Array of {x, y} points
 * @returns {Object} - { type, confidence, params }
 */
export const recognizeShape = (points) => {
  if (!points || points.length < 3) {
    return { type: null, confidence: 0, params: null };
  }

  // Try detecting different shapes
  const detectors = [
    { name: 'circle', detector: detectCircle },
    { name: 'ellipse', detector: detectEllipse },
    { name: 'rectangle', detector: detectRectangle },
    { name: 'triangle', detector: detectTriangle },
    { name: 'line', detector: detectLine },
    { name: 'arrow', detector: detectArrow },
  ];

  let bestMatch = { type: null, confidence: 0, params: null };

  detectors.forEach(({ name, detector }) => {
    const result = detector(points);
    if (result.isShape && result.confidence > bestMatch.confidence) {
      bestMatch = {
        type: name,
        confidence: result.confidence,
        params: result.params,
      };
    }
  });

  return bestMatch;
};

/**
 * Generate perfect shape points from recognition result
 * @param {string} shapeType - Type of shape
 * @param {Object} params - Shape parameters
 * @param {number} pointCount - Number of points to generate
 * @returns {Array} - Array of {x, y} points
 */
export const generatePerfectShape = (shapeType, params, pointCount = 50) => {
  const points = [];

  switch (shapeType) {
    case 'circle':
      for (let i = 0; i <= pointCount; i++) {
        const angle = (i / pointCount) * 2 * Math.PI;
        points.push({
          x: params.center.x + params.radius * Math.cos(angle),
          y: params.center.y + params.radius * Math.sin(angle),
        });
      }
      break;

    case 'ellipse':
      for (let i = 0; i <= pointCount; i++) {
        const angle = (i / pointCount) * 2 * Math.PI;
        points.push({
          x: params.center.x + params.radiusX * Math.cos(angle),
          y: params.center.y + params.radiusY * Math.sin(angle),
        });
      }
      break;

    case 'rectangle':
      const { x, y, width, height } = params;
      const cornersAndEdges = [
        // Top edge
        ...Array.from({ length: Math.floor(pointCount / 4) }, (_, i) => ({
          x: x + (i / Math.floor(pointCount / 4)) * width,
          y: y,
        })),
        // Right edge
        ...Array.from({ length: Math.floor(pointCount / 4) }, (_, i) => ({
          x: x + width,
          y: y + (i / Math.floor(pointCount / 4)) * height,
        })),
        // Bottom edge
        ...Array.from({ length: Math.floor(pointCount / 4) }, (_, i) => ({
          x: x + width - (i / Math.floor(pointCount / 4)) * width,
          y: y + height,
        })),
        // Left edge
        ...Array.from({ length: Math.floor(pointCount / 4) }, (_, i) => ({
          x: x,
          y: y + height - (i / Math.floor(pointCount / 4)) * height,
        })),
      ];
      points.push(...cornersAndEdges);
      break;

    case 'triangle':
      const [v1, v2, v3] = params.vertices;
      const pointsPerSide = Math.floor(pointCount / 3);

      // Side 1: v1 to v2
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          x: v1.x + t * (v2.x - v1.x),
          y: v1.y + t * (v2.y - v1.y),
        });
      }

      // Side 2: v2 to v3
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          x: v2.x + t * (v3.x - v2.x),
          y: v2.y + t * (v3.y - v2.y),
        });
      }

      // Side 3: v3 to v1
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        points.push({
          x: v3.x + t * (v1.x - v3.x),
          y: v3.y + t * (v1.y - v3.y),
        });
      }
      break;

    case 'line':
      for (let i = 0; i <= pointCount; i++) {
        const t = i / pointCount;
        points.push({
          x: params.start.x + t * (params.end.x - params.start.x),
          y: params.start.y + t * (params.end.y - params.start.y),
        });
      }
      break;

    case 'arrow':
      // Draw shaft
      const shaftPoints = Math.floor(pointCount * 0.8);
      for (let i = 0; i < shaftPoints; i++) {
        const t = i / shaftPoints;
        points.push({
          x: params.start.x + t * (params.end.x - params.start.x),
          y: params.start.y + t * (params.end.y - params.start.y),
        });
      }

      // Draw arrow head (simple V shape)
      const headLength = params.headSize || 20;
      const angle = Math.atan2(params.end.y - params.start.y, params.end.x - params.start.x);
      const headAngle = Math.PI / 6; // 30 degrees

      // Left side of arrow head
      points.push({
        x: params.end.x - headLength * Math.cos(angle - headAngle),
        y: params.end.y - headLength * Math.sin(angle - headAngle),
      });
      points.push(params.end);

      // Right side of arrow head
      points.push({
        x: params.end.x - headLength * Math.cos(angle + headAngle),
        y: params.end.y - headLength * Math.sin(angle + headAngle),
      });
      break;

    default:
      return [];
  }

  return points;
};




