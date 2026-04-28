/**
 * 无限画布增强服务
 *
 * 优化无限画布的性能和交互：
 * - 视口管理
 * - 分块渲染
 * - 缩放和平移优化
 * - 智能裁剪
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 画布分块配置
const TILE_SIZE = 512; // 每个分块的大小
const BUFFER_TILES = 1; // 缓冲区分块数
const MAX_CACHED_TILES = 50; // 最大缓存分块数

/**
 * 视口类
 */
class Viewport {
    constructor(width = SCREEN_WIDTH, height = SCREEN_HEIGHT) {
        this.x = 0;
        this.y = 0;
        this.width = width;
        this.height = height;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;
        this.listeners = new Set();
    }

    /**
     * 设置位置
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.notifyChange();
    }

    /**
     * 移动
     */
    pan(dx, dy) {
        this.x += dx / this.scale;
        this.y += dy / this.scale;
        this.notifyChange();
    }

    /**
     * 设置缩放
     */
    setScale(scale, centerX = null, centerY = null) {
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, scale));

        if (centerX !== null && centerY !== null) {
            // 以指定点为中心缩放
            const worldX = this.x + centerX / this.scale;
            const worldY = this.y + centerY / this.scale;

            this.scale = newScale;

            this.x = worldX - centerX / this.scale;
            this.y = worldY - centerY / this.scale;
        } else {
            this.scale = newScale;
        }

        this.notifyChange();
    }

    /**
     * 缩放
     */
    zoom(factor, centerX = null, centerY = null) {
        this.setScale(this.scale * factor, centerX, centerY);
    }

    /**
     * 重置视口
     */
    reset() {
        this.x = 0;
        this.y = 0;
        this.scale = 1;
        this.notifyChange();
    }

    /**
     * 获取世界坐标边界
     */
    getWorldBounds() {
        return {
            left: this.x,
            top: this.y,
            right: this.x + this.width / this.scale,
            bottom: this.y + this.height / this.scale,
            width: this.width / this.scale,
            height: this.height / this.scale,
        };
    }

    /**
     * 屏幕坐标转世界坐标
     */
    screenToWorld(screenX, screenY) {
        return {
            x: this.x + screenX / this.scale,
            y: this.y + screenY / this.scale,
        };
    }

    /**
     * 世界坐标转屏幕坐标
     */
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.scale,
            y: (worldY - this.y) * this.scale,
        };
    }

    /**
     * 检查世界坐标点是否在视口内
     */
    containsPoint(worldX, worldY) {
        const bounds = this.getWorldBounds();
        return worldX >= bounds.left && worldX <= bounds.right &&
            worldY >= bounds.top && worldY <= bounds.bottom;
    }

    /**
     * 检查矩形是否与视口相交
     */
    intersectsRect(rect) {
        const bounds = this.getWorldBounds();
        return !(rect.right < bounds.left ||
            rect.left > bounds.right ||
            rect.bottom < bounds.top ||
            rect.top > bounds.bottom);
    }

    /**
     * 添加变化监听器
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyChange() {
        this.listeners.forEach(listener => listener(this));
    }
}

/**
 * 分块管理器
 */
class TileManager {
    constructor(tileSize = TILE_SIZE) {
        this.tileSize = tileSize;
        this.tiles = new Map(); // key: "x,y" -> tile data
        this.tileCache = new Map(); // 渲染缓存
        this.dirtyTiles = new Set(); // 需要重绘的分块
    }

    /**
     * 获取覆盖视口的分块范围
     */
    getTileRange(viewport) {
        const bounds = viewport.getWorldBounds();

        const startCol = Math.floor(bounds.left / this.tileSize) - BUFFER_TILES;
        const endCol = Math.ceil(bounds.right / this.tileSize) + BUFFER_TILES;
        const startRow = Math.floor(bounds.top / this.tileSize) - BUFFER_TILES;
        const endRow = Math.ceil(bounds.bottom / this.tileSize) + BUFFER_TILES;

        return { startCol, endCol, startRow, endRow };
    }

    /**
     * 获取可见分块
     */
    getVisibleTiles(viewport) {
        const { startCol, endCol, startRow, endRow } = this.getTileRange(viewport);
        const visible = [];

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const key = `${col},${row}`;
                visible.push({
                    key,
                    col,
                    row,
                    x: col * this.tileSize,
                    y: row * this.tileSize,
                    width: this.tileSize,
                    height: this.tileSize,
                    data: this.tiles.get(key),
                    cached: this.tileCache.has(key),
                    dirty: this.dirtyTiles.has(key),
                });
            }
        }

        return visible;
    }

    /**
     * 添加内容到分块
     */
    addToTile(col, row, content) {
        const key = `${col},${row}`;

        if (!this.tiles.has(key)) {
            this.tiles.set(key, []);
        }

        this.tiles.get(key).push(content);
        this.dirtyTiles.add(key);
    }

    /**
     * 根据世界坐标获取分块
     */
    getTileAt(worldX, worldY) {
        const col = Math.floor(worldX / this.tileSize);
        const row = Math.floor(worldY / this.tileSize);
        return { col, row, key: `${col},${row}` };
    }

    /**
     * 将笔画分配到相应分块
     */
    assignStrokeToTiles(stroke) {
        if (!stroke.points || stroke.points.length === 0) {return;}

        const affectedTiles = new Set();

        for (const point of stroke.points) {
            const { col, row, key } = this.getTileAt(point.x, point.y);
            affectedTiles.add(key);

            if (!this.tiles.has(key)) {
                this.tiles.set(key, []);
            }
        }

        // 将笔画添加到所有涉及的分块
        affectedTiles.forEach(key => {
            const tileStrokes = this.tiles.get(key);
            if (!tileStrokes.includes(stroke.id)) {
                tileStrokes.push(stroke.id);
                this.dirtyTiles.add(key);
            }
        });

        return Array.from(affectedTiles);
    }

    /**
     * 缓存分块渲染结果
     */
    cacheTile(key, renderedData) {
        this.tileCache.set(key, renderedData);
        this.dirtyTiles.delete(key);

        // 限制缓存大小
        if (this.tileCache.size > MAX_CACHED_TILES) {
            const oldestKey = this.tileCache.keys().next().value;
            this.tileCache.delete(oldestKey);
        }
    }

    /**
     * 获取缓存的分块
     */
    getCachedTile(key) {
        return this.tileCache.get(key);
    }

    /**
     * 清除分块缓存
     */
    clearCache() {
        this.tileCache.clear();
        this.dirtyTiles = new Set(this.tiles.keys());
    }

    /**
     * 标记分块为dirty
     */
    markDirty(key) {
        this.dirtyTiles.add(key);
        this.tileCache.delete(key);
    }
}

/**
 * 无限画布服务
 */
class InfiniteCanvasService {
    constructor() {
        this.viewport = new Viewport();
        this.tileManager = new TileManager();
        this.strokes = new Map(); // id -> stroke
        this.elements = new Map(); // id -> element (images, text, etc.)
        this.selectedElements = new Set();

        // 性能配置
        this.renderThrottleMs = 16; // ~60fps
        this.lastRenderTime = 0;
        this.pendingRender = false;
    }

    /**
     * 添加笔画
     */
    addStroke(stroke) {
        this.strokes.set(stroke.id, stroke);
        this.tileManager.assignStrokeToTiles(stroke);
        this.requestRender();
    }

    /**
     * 添加元素（图片、文本等）
     */
    addElement(element) {
        this.elements.set(element.id, element);

        // 将元素分配到分块
        const { col, row, key } = this.tileManager.getTileAt(element.x, element.y);
        this.tileManager.addToTile(col, row, { type: 'element', id: element.id });

        this.requestRender();
    }

    /**
     * 移动元素
     */
    moveElement(elementId, dx, dy) {
        const element = this.elements.get(elementId);
        if (!element) {return;}

        element.x += dx;
        element.y += dy;

        // 重新分配到分块
        this.tileManager.assignStrokeToTiles({
            id: elementId,
            points: [{ x: element.x, y: element.y }],
        });

        this.requestRender();
    }

    /**
     * 删除笔画
     */
    deleteStroke(strokeId) {
        this.strokes.delete(strokeId);
        this.tileManager.clearCache(); // 简化处理，清空缓存
        this.requestRender();
    }

    /**
     * 获取可见内容
     */
    getVisibleContent() {
        const visibleTiles = this.tileManager.getVisibleTiles(this.viewport);
        const visibleStrokes = new Set();
        const visibleElements = new Set();

        visibleTiles.forEach(tile => {
            if (tile.data) {
                tile.data.forEach(item => {
                    if (typeof item === 'string') {
                        // 笔画ID
                        visibleStrokes.add(item);
                    } else if (item.type === 'element') {
                        visibleElements.add(item.id);
                    }
                });
            }
        });

        return {
            tiles: visibleTiles,
            strokes: Array.from(visibleStrokes).map(id => this.strokes.get(id)).filter(Boolean),
            elements: Array.from(visibleElements).map(id => this.elements.get(id)).filter(Boolean),
        };
    }

    /**
     * 裁剪笔画到视口
     * 只返回视口内的点
     */
    clipStrokeToViewport(stroke) {
        if (!stroke.points || stroke.points.length === 0) {return null;}

        const bounds = this.viewport.getWorldBounds();
        const clippedPoints = [];
        let inViewport = false;

        for (let i = 0; i < stroke.points.length; i++) {
            const point = stroke.points[i];
            const isInside = this.viewport.containsPoint(point.x, point.y);

            if (isInside) {
                clippedPoints.push(point);
                inViewport = true;
            } else if (inViewport) {
                // 刚离开视口，添加最后一个点以保持连续性
                clippedPoints.push(point);
            }

            // 如果点在视口外但下一个点在视口内，添加当前点
            if (!isInside && i < stroke.points.length - 1) {
                const nextPoint = stroke.points[i + 1];
                if (this.viewport.containsPoint(nextPoint.x, nextPoint.y)) {
                    clippedPoints.push(point);
                }
            }
        }

        if (clippedPoints.length < 2) {return null;}

        return {
            ...stroke,
            points: clippedPoints,
        };
    }

    /**
     * 请求渲染（节流）
     */
    requestRender() {
        if (this.pendingRender) {return;}

        const now = Date.now();
        const elapsed = now - this.lastRenderTime;

        if (elapsed >= this.renderThrottleMs) {
            this.render();
        } else {
            this.pendingRender = true;
            setTimeout(() => {
                this.pendingRender = false;
                this.render();
            }, this.renderThrottleMs - elapsed);
        }
    }

    /**
     * 执行渲染
     */
    render() {
        this.lastRenderTime = Date.now();
        // 实际渲染逻辑由组件处理
        this.onRender?.();
    }

    /**
     * 设置渲染回调
     */
    setRenderCallback(callback) {
        this.onRender = callback;
    }

    /**
     * 导出画布内容
     */
    exportCanvas() {
        return {
            strokes: Array.from(this.strokes.values()),
            elements: Array.from(this.elements.values()),
            viewport: {
                x: this.viewport.x,
                y: this.viewport.y,
                scale: this.viewport.scale,
            },
        };
    }

    /**
     * 导入画布内容
     */
    importCanvas(data) {
        this.strokes.clear();
        this.elements.clear();
        this.tileManager = new TileManager();

        if (data.strokes) {
            data.strokes.forEach(stroke => {
                this.strokes.set(stroke.id, stroke);
                this.tileManager.assignStrokeToTiles(stroke);
            });
        }

        if (data.elements) {
            data.elements.forEach(element => {
                this.addElement(element);
            });
        }

        if (data.viewport) {
            this.viewport.setPosition(data.viewport.x, data.viewport.y);
            this.viewport.setScale(data.viewport.scale);
        }

        this.requestRender();
    }

    /**
     * 获取画布边界（包含所有内容）
     */
    getContentBounds() {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        this.strokes.forEach(stroke => {
            stroke.points?.forEach(point => {
                minX = Math.min(minX, point.x);
                minY = Math.min(minY, point.y);
                maxX = Math.max(maxX, point.x);
                maxY = Math.max(maxY, point.y);
            });
        });

        this.elements.forEach(element => {
            minX = Math.min(minX, element.x);
            minY = Math.min(minY, element.y);
            maxX = Math.max(maxX, element.x + (element.width || 0));
            maxY = Math.max(maxY, element.y + (element.height || 0));
        });

        if (minX === Infinity) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    /**
     * 适配内容到视口
     */
    fitContent() {
        const bounds = this.getContentBounds();
        if (bounds.width === 0 || bounds.height === 0) {return;}

        const padding = 50;
        const scaleX = (this.viewport.width - padding * 2) / bounds.width;
        const scaleY = (this.viewport.height - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY, 1);

        this.viewport.setScale(scale);
        this.viewport.setPosition(
            bounds.x - padding / scale,
            bounds.y - padding / scale
        );
    }
}

// 导出单例
export const infiniteCanvasService = new InfiniteCanvasService();
export { Viewport, TileManager };

export default infiniteCanvasService;
