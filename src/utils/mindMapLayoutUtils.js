/**
 * 思维导图布局工具函数
 * 提供各种布局算法和辅助函数
 */

import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// 默认节点大小和间距
const DEFAULT_NODE_WIDTH = 120;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_NODE_MARGIN_X = 80;
const DEFAULT_NODE_MARGIN_Y = 60;

// 稳定哈希与伪随机工具
const hashStringToInt = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  return Math.abs(hash);
};

const getStableUnitValue = (seed) => (hashStringToInt(seed) % 10000) / 10000;

const getStableOffset = (seed, range) => (getStableUnitValue(seed) - 0.5) * range;

const getStableAngle = (seed) => getStableUnitValue(seed) * Math.PI * 2;


/**
 * 计算节点树
 * @param {Array} nodes - 节点数组
 * @returns {Object} 节点树和根节点
 */
export const buildNodeTree = (nodes) => {
  if (!nodes || !nodes.length) {return { nodeMap: {}, rootNode: null };}

  // 找到根节点（没有父节点的节点）
  const rootNode = nodes.find(node => !node.parent_id) || nodes[0];

  // 构建节点树
  const nodeMap = {};
  nodes.forEach(node => {
    nodeMap[node.id] = { ...node, children: [] };
  });

  // 添加子节点
  nodes.forEach(node => {
    if (node.parent_id && nodeMap[node.parent_id]) {
      nodeMap[node.parent_id].children.push(nodeMap[node.id]);
    }
  });

  return { nodeMap, rootNode: nodeMap[rootNode.id] };
};

/**
 * 计算树形布局
 * @param {Object} rootNode - 根节点
 * @param {Object} options - 布局选项
 * @returns {Object} 节点位置映射
 */
export const calculateTreeLayout = (rootNode, options = {}) => {
  const positions = {};
  const {
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    nodeMarginX = DEFAULT_NODE_MARGIN_X,
    nodeMarginY = DEFAULT_NODE_MARGIN_Y,
    startX = width / 2,
    startY = 100,
    avoidOverlap = true,
  } = options;

  // 计算节点数量和树的深度
  const { nodeCount, maxDepth } = countNodesAndDepth(rootNode);

  // 计算每个节点的子树大小
  const subtreeSizes = calculateSubtreeSizes(rootNode, nodeWidth, nodeMarginX);

  // 递归计算位置
  calculateTreeNodePositions(
    rootNode,
    positions,
    0,
    0,
    startX,
    startY,
    nodeWidth,
    nodeHeight,
    nodeMarginX,
    nodeMarginY,
    subtreeSizes
  );

  // 避免节点重叠
  if (avoidOverlap) {
    resolveOverlaps(positions, nodeWidth, nodeHeight);
  }

  return positions;
};

/**
 * 计算放射状布局
 * @param {Object} rootNode - 根节点
 * @param {Object} options - 布局选项
 * @returns {Object} 节点位置映射
 */
export const calculateRadialLayout = (rootNode, options = {}) => {
  const positions = {};
  const {
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    centerX = width / 2,
    centerY = height / 2,
    initialRadius = 150,
    radiusIncrement = 150,
    startAngle = 0,
    endAngle = 2 * Math.PI,
    avoidOverlap = true,
  } = options;

  // 计算节点数量和树的深度
  const { nodeCount, maxDepth } = countNodesAndDepth(rootNode);

  // 计算每个层级的节点数量
  const levelCounts = countNodesByLevel(rootNode);

  // 递归计算位置
  calculateRadialNodePositions(
    rootNode,
    positions,
    0,
    centerX,
    centerY,
    initialRadius,
    radiusIncrement,
    startAngle,
    endAngle,
    levelCounts
  );

  // 避免节点重叠
  if (avoidOverlap) {
    resolveOverlaps(positions, nodeWidth, nodeHeight);
  }

  return positions;
};

/**
 * 计算水平布局
 * @param {Object} rootNode - 根节点
 * @param {Object} options - 布局选项
 * @returns {Object} 节点位置映射
 */
export const calculateHorizontalLayout = (rootNode, options = {}) => {
  const positions = {};
  const {
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    nodeMarginX = DEFAULT_NODE_MARGIN_X,
    nodeMarginY = DEFAULT_NODE_MARGIN_Y,
    startX = 100,
    startY = height / 2,
    avoidOverlap = true,
  } = options;

  // 计算每个节点的子树大小
  const subtreeSizes = calculateSubtreeHeights(rootNode, nodeHeight, nodeMarginY);

  // 递归计算位置
  calculateHorizontalNodePositions(
    rootNode,
    positions,
    0,
    0,
    startX,
    startY,
    nodeWidth,
    nodeHeight,
    nodeMarginX,
    nodeMarginY,
    subtreeSizes
  );

  // 避免节点重叠
  if (avoidOverlap) {
    resolveOverlaps(positions, nodeWidth, nodeHeight);
  }

  return positions;
};

/**
 * 计算力导向布局 - 增强版
 * 使用Barnes-Hut算法优化，更适合大规模节点和不同屏幕尺寸
 *
 * @param {Array} nodes - 节点数组
 * @param {Array} edges - 边数组
 * @param {Object} options - 布局选项
 * @returns {Object} 节点位置映射
 */
export const calculateForceDirectedLayout = (nodes, edges, options = {}) => {
  // 如果没有节点，直接返回空对象
  if (!nodes || nodes.length === 0) {return {};}

  const {
    nodeWidth = DEFAULT_NODE_WIDTH,
    nodeHeight = DEFAULT_NODE_HEIGHT,
    centerX = width / 2,
    centerY = height / 2,
    iterations = 50,
    springLength = 100,
    springCoeff = 0.0008,
    gravity = 0.01,
    theta = 0.8,
    dragCoeff = 0.02,
    adaptToScreenSize = true, // 是否根据屏幕尺寸调整参数
    coolingFactor = 0.95, // 降温因子，用于逐步减小力的影响
    jitter = true, // 是否添加随机扰动，避免局部最小值
  } = options;

  // 根据节点数量和屏幕尺寸调整参数
  const nodeCount = nodes.length;
  const screenSize = Math.min(width, height);

  // 动态调整参数
  let dynamicSpringLength = springLength;
  let dynamicSpringCoeff = springCoeff;
  let dynamicGravity = gravity;

  if (adaptToScreenSize) {
    // 根据屏幕尺寸调整弹簧长度
    dynamicSpringLength = Math.max(50, Math.min(150, screenSize / 10));

    // 根据节点数量调整系数
    if (nodeCount > 100) {
      dynamicSpringCoeff *= 0.5; // 节点多时减小系数，避免力过大
      dynamicGravity *= 1.5; // 增加重力，使布局更紧凑
    } else if (nodeCount < 20) {
      dynamicSpringCoeff *= 1.5; // 节点少时增大系数，使布局更分散
      dynamicGravity *= 0.7; // 减小重力，使布局更松散
    }
  }

  // 初始化位置（随机或基于现有位置）
  const positions = {};
  nodes.forEach(node => {
    // 如果节点已有位置，使用现有位置，否则随机分配
    const hasPosition = node.x !== undefined && node.y !== undefined;

    const seedBase = `init-${node.id}`;
    positions[node.id] = {
      x: hasPosition ? node.x : centerX + getStableOffset(`${seedBase}-x`, width * 0.6),
      y: hasPosition ? node.y : centerY + getStableOffset(`${seedBase}-y`, height * 0.6),
      vx: 0,
      vy: 0,
    };
  });

  // 构建边的查找表，提高性能
  const edgeMap = {};
  edges.forEach(edge => {
    if (!edgeMap[edge.source]) {edgeMap[edge.source] = [];}
    edgeMap[edge.source].push(edge.target);

    if (!edgeMap[edge.target]) {edgeMap[edge.target] = [];}
    edgeMap[edge.target].push(edge.source);
  });

  // 力导向算法迭代
  for (let i = 0; i < iterations; i++) {
    // 当前迭代的冷却系数
    const currentCooling = Math.pow(coolingFactor, i);

    // 计算斥力（使用Barnes-Hut四叉树算法优化）
    const quadtree = buildQuadtree(nodes, positions, centerX, centerY, width, height);

    nodes.forEach(node1 => {
      const pos1 = positions[node1.id];

      // 使用四叉树计算斥力
      applyRepulsiveForces(node1.id, pos1, quadtree, dynamicSpringCoeff * currentCooling, theta);

      // 添加随机扰动（仅在前几次迭代）
      if (jitter && i < iterations / 3) {
        const jitterForce = 0.1 * Math.pow(0.9, i);
        const jitterSeed = `jitter-${node1.id}-${i}`;
        pos1.vx += getStableOffset(`${jitterSeed}-x`, jitterForce);
        pos1.vy += getStableOffset(`${jitterSeed}-y`, jitterForce);
      }
    });

    // 计算引力（边连接的节点间）
    edges.forEach(edge => {
      const sourcePos = positions[edge.source];
      const targetPos = positions[edge.target];

      if (!sourcePos || !targetPos) {return;}

      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      // 引力与距离成正比，但有上限
      const attractiveForce = Math.min(
        0.1,
        (distance - dynamicSpringLength) * dynamicSpringCoeff * currentCooling
      );

      sourcePos.vx += dx * attractiveForce;
      sourcePos.vy += dy * attractiveForce;
      targetPos.vx -= dx * attractiveForce;
      targetPos.vy -= dy * attractiveForce;
    });

    // 应用重力（向中心拉）
    nodes.forEach(node => {
      const pos = positions[node.id];

      const dx = centerX - pos.x;
      const dy = centerY - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      // 重力随距离增加而增加，但有上限
      const gravityForce = Math.min(
        0.05,
        dynamicGravity * currentCooling * (distance / 100)
      );

      pos.vx += dx * gravityForce;
      pos.vy += dy * gravityForce;
    });

    // 应用阻力和更新位置
    let totalMovement = 0;

    nodes.forEach(node => {
      const pos = positions[node.id];

      // 应用阻尼
      pos.vx *= (1 - dragCoeff);
      pos.vy *= (1 - dragCoeff);

      // 限制最大速度
      const speed = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy);
      if (speed > 10) {
        pos.vx = (pos.vx / speed) * 10;
        pos.vy = (pos.vy / speed) * 10;
      }

      // 更新位置
      pos.x += pos.vx;
      pos.y += pos.vy;

      // 累计总移动量
      totalMovement += Math.abs(pos.vx) + Math.abs(pos.vy);
    });

    // 如果总移动量很小，提前结束迭代
    if (totalMovement / nodeCount < 0.1 && i > iterations / 2) {
      break;
    }
  }

  // 最后应用边界约束，确保节点不会太靠近屏幕边缘
  const padding = Math.max(nodeWidth, nodeHeight) * 1.5;
  const minX = padding;
  const minY = padding;
  const maxX = width - padding;
  const maxY = height - padding;

  nodes.forEach(node => {
    const pos = positions[node.id];
    pos.x = Math.max(minX, Math.min(maxX, pos.x));
    pos.y = Math.max(minY, Math.min(maxY, pos.y));
  });

  // 清理速度信息，只保留位置
  nodes.forEach(node => {
    const pos = positions[node.id];
    positions[node.id] = { x: pos.x, y: pos.y };
  });

  // 最后应用重叠解决算法
  resolveOverlaps(positions, nodeWidth, nodeHeight);

  return positions;
};

/**
 * 构建四叉树
 * 用于Barnes-Hut算法优化力计算
 */
const buildQuadtree = (nodes, positions, centerX, centerY, width, height) => {
  // 创建根节点
  const root = {
    x: centerX,
    y: centerY,
    width: width,
    height: height,
    mass: 0,
    centerOfMass: { x: 0, y: 0 },
    children: [],
    nodes: [],
  };

  // 插入所有节点
  nodes.forEach(node => {
    const pos = positions[node.id];
    insertNode(root, node.id, pos.x, pos.y);
  });

  // 计算质量中心
  calculateCenterOfMass(root);

  return root;
};

/**
 * 将节点插入四叉树
 */
const insertNode = (quadNode, nodeId, x, y) => {
  // 更新节点信息
  quadNode.mass += 1;
  quadNode.centerOfMass.x += x;
  quadNode.centerOfMass.y += y;

  // 如果是叶节点且没有其他节点，直接添加
  if (quadNode.nodes.length === 0 && quadNode.children.length === 0) {
    quadNode.nodes.push({ id: nodeId, x, y });
    return;
  }

  // 如果是叶节点但已有节点，需要细分
  if (quadNode.nodes.length > 0 && quadNode.children.length === 0) {
    // 创建子节点
    const halfWidth = quadNode.width / 2;
    const halfHeight = quadNode.height / 2;

    quadNode.children = [
      { // 左上
        x: quadNode.x - halfWidth / 2,
        y: quadNode.y - halfHeight / 2,
        width: halfWidth,
        height: halfHeight,
        mass: 0,
        centerOfMass: { x: 0, y: 0 },
        children: [],
        nodes: [],
      },
      { // 右上
        x: quadNode.x + halfWidth / 2,
        y: quadNode.y - halfHeight / 2,
        width: halfWidth,
        height: halfHeight,
        mass: 0,
        centerOfMass: { x: 0, y: 0 },
        children: [],
        nodes: [],
      },
      { // 左下
        x: quadNode.x - halfWidth / 2,
        y: quadNode.y + halfHeight / 2,
        width: halfWidth,
        height: halfHeight,
        mass: 0,
        centerOfMass: { x: 0, y: 0 },
        children: [],
        nodes: [],
      },
      { // 右下
        x: quadNode.x + halfWidth / 2,
        y: quadNode.y + halfHeight / 2,
        width: halfWidth,
        height: halfHeight,
        mass: 0,
        centerOfMass: { x: 0, y: 0 },
        children: [],
        nodes: [],
      },
    ];

    // 重新分配现有节点
    const existingNodes = [...quadNode.nodes];
    quadNode.nodes = [];

    existingNodes.forEach(node => {
      insertNode(quadNode, node.id, node.x, node.y);
    });
  }

  // 确定节点应该放在哪个象限
  let index = 0;
  if (x >= quadNode.x) {index += 1;} // 右侧
  if (y >= quadNode.y) {index += 2;} // 下方

  // 递归插入到对应子节点
  if (quadNode.children[index]) {
    insertNode(quadNode.children[index], nodeId, x, y);
  } else {
    // 如果没有对应子节点（理论上不应该发生），添加到当前节点
    quadNode.nodes.push({ id: nodeId, x, y });
  }
};

/**
 * 计算四叉树节点的质量中心
 */
const calculateCenterOfMass = (quadNode) => {
  if (quadNode.mass > 0) {
    quadNode.centerOfMass.x /= quadNode.mass;
    quadNode.centerOfMass.y /= quadNode.mass;
  }

  // 递归计算子节点
  quadNode.children.forEach(child => {
    calculateCenterOfMass(child);
  });
};

/**
 * 应用Barnes-Hut算法计算斥力
 */
const applyRepulsiveForces = (nodeId, pos, quadNode, coefficient, theta) => {
  // 如果四叉树节点没有质量，直接返回
  if (quadNode.mass === 0) {return;}

  // 如果是叶节点且只包含当前节点，直接返回
  if (quadNode.nodes.length === 1 && quadNode.nodes[0].id === nodeId) {return;}

  // 计算节点到四叉树节点质量中心的距离
  const dx = quadNode.centerOfMass.x - pos.x;
  const dy = quadNode.centerOfMass.y - pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

  // 如果距离足够远，或者是叶节点，直接计算斥力
  if ((quadNode.width / distance < theta) || quadNode.children.length === 0) {
    // 避免自身斥力
    if (distance > 0) {
      // 斥力与距离的平方成反比，与质量成正比
      const repulsiveForce = coefficient * quadNode.mass / (distance * distance);

      // 应用斥力
      pos.vx -= dx / distance * repulsiveForce;
      pos.vy -= dy / distance * repulsiveForce;
    }
  } else {
    // 如果距离不够远，递归计算子节点
    quadNode.children.forEach(child => {
      applyRepulsiveForces(nodeId, pos, child, coefficient, theta);
    });
  }
};

/**
 * 计算节点数量和树的深度
 * @param {Object} node - 节点
 * @param {number} level - 当前层级
 * @returns {Object} 节点数量和最大深度
 */
const countNodesAndDepth = (node, level = 0) => {
  if (!node) {return { nodeCount: 0, maxDepth: 0 };}

  let nodeCount = 1;
  let maxDepth = level;

  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      const { nodeCount: childCount, maxDepth: childDepth } = countNodesAndDepth(child, level + 1);
      nodeCount += childCount;
      maxDepth = Math.max(maxDepth, childDepth);
    });
  }

  return { nodeCount, maxDepth };
};

/**
 * 计算每个层级的节点数量
 * @param {Object} node - 节点
 * @param {Object} counts - 计数对象
 * @param {number} level - 当前层级
 * @returns {Object} 每个层级的节点数量
 */
const countNodesByLevel = (node, counts = {}, level = 0) => {
  if (!node) {return counts;}

  counts[level] = (counts[level] || 0) + 1;

  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      countNodesByLevel(child, counts, level + 1);
    });
  }

  return counts;
};

/**
 * 计算子树宽度
 * @param {Object} node - 节点
 * @param {number} nodeWidth - 节点宽度
 * @param {number} nodeMarginX - 节点水平间距
 * @returns {Object} 子树宽度映射
 */
const calculateSubtreeSizes = (node, nodeWidth, nodeMarginX) => {
  const sizes = {};

  const calculateSize = (node) => {
    if (!node) {return 0;}

    if (!node.children || node.children.length === 0) {
      sizes[node.id] = nodeWidth;
      return nodeWidth;
    }

    let totalChildrenWidth = 0;
    node.children.forEach(child => {
      totalChildrenWidth += calculateSize(child) + nodeMarginX;
    });

    // 减去最后一个子节点后的间距
    totalChildrenWidth -= nodeMarginX;

    // 子树宽度至少为节点自身宽度
    const subtreeWidth = Math.max(nodeWidth, totalChildrenWidth);
    sizes[node.id] = subtreeWidth;

    return subtreeWidth;
  };

  calculateSize(node);
  return sizes;
};

/**
 * 计算子树高度
 * @param {Object} node - 节点
 * @param {number} nodeHeight - 节点高度
 * @param {number} nodeMarginY - 节点垂直间距
 * @returns {Object} 子树高度映射
 */
const calculateSubtreeHeights = (node, nodeHeight, nodeMarginY) => {
  const heights = {};

  const calculateHeight = (node) => {
    if (!node) {return 0;}

    if (!node.children || node.children.length === 0) {
      heights[node.id] = nodeHeight;
      return nodeHeight;
    }

    let totalChildrenHeight = 0;
    node.children.forEach(child => {
      totalChildrenHeight += calculateHeight(child) + nodeMarginY;
    });

    // 减去最后一个子节点后的间距
    totalChildrenHeight -= nodeMarginY;

    // 子树高度至少为节点自身高度
    const subtreeHeight = Math.max(nodeHeight, totalChildrenHeight);
    heights[node.id] = subtreeHeight;

    return subtreeHeight;
  };

  calculateHeight(node);
  return heights;
};

/**
 * 递归计算树形布局节点位置
 */
const calculateTreeNodePositions = (
  node,
  positions,
  level,
  index,
  x,
  y,
  nodeWidth,
  nodeHeight,
  nodeMarginX,
  nodeMarginY,
  subtreeSizes
) => {
  if (!node) {return;}

  // 设置当前节点位置
  positions[node.id] = { x, y };

  if (!node.children || node.children.length === 0) {return;}

  // 计算子节点起始位置
  const totalChildrenWidth = subtreeSizes[node.id];
  let startX = x - totalChildrenWidth / 2;

  // 为每个子节点计算位置
  node.children.forEach((child, childIndex) => {
    const childWidth = subtreeSizes[child.id];
    const childX = startX + childWidth / 2;
    const childY = y + nodeHeight + nodeMarginY;

    calculateTreeNodePositions(
      child,
      positions,
      level + 1,
      childIndex,
      childX,
      childY,
      nodeWidth,
      nodeHeight,
      nodeMarginX,
      nodeMarginY,
      subtreeSizes
    );

    startX += childWidth + nodeMarginX;
  });
};

/**
 * 递归计算放射状布局节点位置
 */
const calculateRadialNodePositions = (
  node,
  positions,
  level,
  centerX,
  centerY,
  initialRadius,
  radiusIncrement,
  startAngle,
  endAngle,
  levelCounts
) => {
  if (!node) {return;}

  if (level === 0) {
    // 根节点在中心
    positions[node.id] = { x: centerX, y: centerY };
  } else {
    // 计算当前层级的半径
    const radius = initialRadius + (level - 1) * radiusIncrement;

    // 获取当前层级的节点数量
    const nodesInLevel = levelCounts[level] || 1;

    // 计算当前节点在层级中的索引
    const indexInLevel = getNodeIndexInLevel(node, level);

    // 计算角度
    const angleRange = endAngle - startAngle;
    const angle = startAngle + (angleRange * indexInLevel) / nodesInLevel;

    // 计算位置
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    positions[node.id] = { x, y };
  }

  // 递归处理子节点
  if (node.children && node.children.length > 0) {
    node.children.forEach((child, index) => {
      calculateRadialNodePositions(
        child,
        positions,
        level + 1,
        centerX,
        centerY,
        initialRadius,
        radiusIncrement,
        startAngle,
        endAngle,
        levelCounts
      );
    });
  }
};

/**
 * 递归计算水平布局节点位置
 */
const calculateHorizontalNodePositions = (
  node,
  positions,
  level,
  index,
  x,
  y,
  nodeWidth,
  nodeHeight,
  nodeMarginX,
  nodeMarginY,
  subtreeSizes
) => {
  if (!node) {return;}

  // 设置当前节点位置
  positions[node.id] = { x, y };

  if (!node.children || node.children.length === 0) {return;}

  // 计算子节点起始位置
  const totalChildrenHeight = subtreeSizes[node.id];
  let startY = y - totalChildrenHeight / 2;

  // 为每个子节点计算位置
  node.children.forEach((child, childIndex) => {
    const childHeight = subtreeSizes[child.id];
    const childX = x + nodeWidth + nodeMarginX;
    const childY = startY + childHeight / 2;

    calculateHorizontalNodePositions(
      child,
      positions,
      level + 1,
      childIndex,
      childX,
      childY,
      nodeWidth,
      nodeHeight,
      nodeMarginX,
      nodeMarginY,
      subtreeSizes
    );

    startY += childHeight + nodeMarginY;
  });
};

/**
 * 获取节点在其层级中的索引
 * 改进版：使用节点ID的哈希值确保稳定的位置
 *
 * @param {Object} node - 节点
 * @param {number} targetLevel - 目标层级
 * @returns {number} 节点在层级中的索引
 */
const getNodeIndexInLevel = (node, targetLevel) => {
  // 使用节点ID生成一个稳定的哈希值
  const nodeId = node.id || '';

  // 简单的字符串哈希函数
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    const char = nodeId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }

  // 确保哈希值为正数
  hash = Math.abs(hash);

  // 使用哈希值作为索引基础，确保相同节点在不同渲染中位置一致
  return hash % 10000; // 使用较大的模数以减少冲突
};

/**
 * 解决节点重叠问题 - 增强版
 * 使用迭代式力导向算法专门解决重叠问题
 *
 * @param {Object} positions - 节点位置映射
 * @param {number} nodeWidth - 节点宽度
 * @param {number} nodeHeight - 节点高度
 */
const resolveOverlaps = (positions, nodeWidth, nodeHeight) => {
  const nodeIds = Object.keys(positions);
  const nodeCount = nodeIds.length;

  if (nodeCount <= 1) {return;}

  // 节点有效区域（考虑边距）
  const effectiveWidth = nodeWidth * 1.2;
  const effectiveHeight = nodeHeight * 1.2;

  // 创建临时速度对象
  const velocities = {};
  nodeIds.forEach(id => {
    velocities[id] = { vx: 0, vy: 0 };
  });

  // 迭代解决重叠
  const MAX_ITERATIONS = 50;
  const OVERLAP_FORCE = 0.3; // 重叠排斥力
  const DAMPING = 0.8; // 阻尼系数

  let hasOverlap = true;
  let iteration = 0;

  while (hasOverlap && iteration < MAX_ITERATIONS) {
    hasOverlap = false;
    iteration++;

    // 重置速度
    nodeIds.forEach(id => {
      velocities[id].vx = 0;
      velocities[id].vy = 0;
    });

    // 检测并解决重叠
    for (let i = 0; i < nodeCount; i++) {
      const nodeId1 = nodeIds[i];
      const pos1 = positions[nodeId1];

      for (let j = i + 1; j < nodeCount; j++) {
        const nodeId2 = nodeIds[j];
        const pos2 = positions[nodeId2];

        // 计算节点中心距离
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distanceSquared = dx * dx + dy * dy;

        // 计算最小无重叠距离
        const minDistanceX = effectiveWidth;
        const minDistanceY = effectiveHeight;

        // 检测重叠 - 使用更精确的椭圆重叠检测
        const overlapFactor = Math.pow(dx / minDistanceX, 2) + Math.pow(dy / minDistanceY, 2);

        if (overlapFactor < 1) {
          hasOverlap = true;

          // 计算排斥力 - 力的大小与重叠程度成反比
          const distance = Math.sqrt(distanceSquared) || 0.1; // 避免除以零
          const repulsionForce = OVERLAP_FORCE * (1 - overlapFactor);

          // 计算力的方向
          let forceX = dx / distance * repulsionForce;
          let forceY = dy / distance * repulsionForce;

          // 如果节点几乎重叠，添加随机扰动避免死锁
          if (distance < 5) {
            const angle = getStableAngle(`overlap-${nodeId1}-${nodeId2}`);
            forceX += Math.cos(angle) * 0.1;
            forceY += Math.sin(angle) * 0.1;
          }

          // 应用力到速度
          velocities[nodeId1].vx -= forceX;
          velocities[nodeId1].vy -= forceY;
          velocities[nodeId2].vx += forceX;
          velocities[nodeId2].vy += forceY;
        }
      }
    }

    // 更新位置
    nodeIds.forEach(id => {
      const vel = velocities[id];
      const pos = positions[id];

      // 应用阻尼
      vel.vx *= DAMPING;
      vel.vy *= DAMPING;

      // 更新位置
      pos.x += vel.vx;
      pos.y += vel.vy;
    });

    // 如果最后几次迭代没有明显改善，提前退出
    if (iteration > 30) {
      let totalMovement = 0;
      nodeIds.forEach(id => {
        const vel = velocities[id];
        totalMovement += Math.abs(vel.vx) + Math.abs(vel.vy);
      });

      if (totalMovement < 0.5) {break;}
    }
  }

  // 最终检查 - 处理任何剩余的严重重叠
  for (let i = 0; i < nodeCount; i++) {
    const nodeId1 = nodeIds[i];
    const pos1 = positions[nodeId1];

    for (let j = i + 1; j < nodeCount; j++) {
      const nodeId2 = nodeIds[j];
      const pos2 = positions[nodeId2];

      // 检测严重重叠
      if (
        Math.abs(pos1.x - pos2.x) < nodeWidth * 0.5 &&
        Math.abs(pos1.y - pos2.y) < nodeHeight * 0.5
      ) {
        // 强制分离
        const angle = getStableAngle(`separate-${nodeId1}-${nodeId2}`);
        const distance = Math.max(nodeWidth, nodeHeight) * 0.8;

        pos2.x = pos1.x + Math.cos(angle) * distance;
        pos2.y = pos1.y + Math.sin(angle) * distance;
      }
    }
  }
};

export default {
  buildNodeTree,
  calculateTreeLayout,
  calculateRadialLayout,
  calculateHorizontalLayout,
  calculateForceDirectedLayout,
};
