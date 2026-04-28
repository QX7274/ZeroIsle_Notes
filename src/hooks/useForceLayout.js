import { useState, useEffect, useRef, useCallback } from 'react';
import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const hashToUnit = (value, salt) => {
    const input = `${value}-${salt}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    const normalized = (hash >>> 0) / 0xFFFFFFFF;
    return normalized - 0.5;
};


/**
 * Custom hook for Force-Directed Graph Layout
 *
 * Implements a basic physics simulation:
 * 1. Repulsion: Nodes push each other away (Coulomb's Law-like)
 * 2. Attraction: Edges pull connected nodes together (Hooke's Law-like)
 * 3. Center Gravity: Nodes are pulled toward the center
 *
 * @param {Array} nodes - Array of node objects { id, ... }
 * @param {Array} edges - Array of edge objects { source, target, ... }
 * @param {Object} options - Configuration options
 * @returns {Object} { positions, isConverged, resetSimulation }
 */
const useForceLayout = ({
    nodes = [],
    edges = [],
    width = SCREEN_WIDTH * 2, // Virtual canvas width
    height = SCREEN_HEIGHT * 2, // Virtual canvas height
    options = {},
}) => {
    const {
        repulsionStrength = 500,
        attractionStrength = 0.05,
        centerStrength = 0.02,
        damping = 0.9,
        iterations = 300, // Max iterations before stopping to save battery
        threshold = 0.5, // Movement threshold to consider converged
    } = options;

    // Store positions in a ref to avoid excessive re-renders during calculation
    const positionsRef = useRef(new Map());

    // Exposed state for rendering
    // We initialize with a Map to signal it's ready, but empty until first tick
    const [positions, setPositions] = useState(new Map());
    const [isConverged, setIsConverged] = useState(false);
    const requestRef = useRef();
    const iterationRef = useRef(0);

    // Initialize positions randomly if new nodes appear
    useEffect(() => {
        let hasNewNodes = false;
        const currentMap = positionsRef.current;

        // Calculate center
        const cx = width / 2;
        const cy = height / 2;

        nodes.forEach(node => {
            if (!currentMap.has(node.id)) {
                hasNewNodes = true;
                // Start near center with some random jitter
                const jitterX = hashToUnit(node.id, 'x') * 50;
                const jitterY = hashToUnit(node.id, 'y') * 50;
                currentMap.set(node.id, {
                    x: cx + jitterX,
                    y: cy + jitterY,
                    vx: 0,
                    vy: 0,
                });
            }
        });

        if (hasNewNodes) {
            // Restart simulation if new nodes are added
            iterationRef.current = 0;
            setIsConverged(false);
            startSimulation();
        }
    }, [nodes, width, height]);

    const runSimulationStep = useCallback(() => {
        const nodeIds = nodes.map(n => n.id);
        const posMap = positionsRef.current;
        const cx = width / 2;
        const cy = height / 2;

        let maxDisplacement = 0;

        // 1. Calculate Forces
        // We'll use a simple O(N^2) approach for repulsion since N is expected < 100 usually
        // For larger graphs, Barnes-Hut would be needed (out of scope for now)

        const forces = new Map();
        nodeIds.forEach(id => forces.set(id, { fx: 0, fy: 0 }));

        // Repulsion (Node vs Node)
        for (let i = 0; i < nodeIds.length; i++) {
            const uId = nodeIds[i];
            const uPos = posMap.get(uId);

            for (let j = i + 1; j < nodeIds.length; j++) {
                const vId = nodeIds[j];
                const vPos = posMap.get(vId);

                const dx = uPos.x - vPos.x;
                const dy = uPos.y - vPos.y;
                let distSq = dx * dx + dy * dy;

                // Avoid division by zero
                if (distSq < 0.01) {distSq = 0.01;}

                const dist = Math.sqrt(distSq);
                const force = repulsionStrength / distSq;

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                const uForce = forces.get(uId);
                const vForce = forces.get(vId);

                uForce.fx += fx;
                uForce.fy += fy;
                vForce.fx -= fx;
                vForce.fy -= fy;
            }

            // Center Gravity (Pull to center)
            const uForce = forces.get(uId);
            uForce.fx -= (uPos.x - cx) * centerStrength;
            uForce.fy -= (uPos.y - cy) * centerStrength;
        }

        // Attraction (Edge springs)
        edges.forEach(edge => {
            const uId = edge.source;
            const vId = edge.target;

            // Skip if nodes don't exist (e.g. filtered out)
            if (!posMap.has(uId) || !posMap.has(vId)) {return;}

            const uPos = posMap.get(uId);
            const vPos = posMap.get(vId);

            const dx = vPos.x - uPos.x;
            const dy = vPos.y - uPos.y;

            // F = k * x (simplified)
            const fx = dx * attractionStrength;
            const fy = dy * attractionStrength;

            const uForce = forces.get(uId);
            const vForce = forces.get(vId);

            uForce.fx += fx;
            uForce.fy += fy;
            vForce.fx -= fx;
            vForce.fy -= fy;
        });

        // 2. Update Positions (Velocity Verlet / Euler)
        nodeIds.forEach(id => {
            const pos = posMap.get(id);
            const force = forces.get(id);

            // Update velocity
            pos.vx = (pos.vx + force.fx) * damping;
            pos.vy = (pos.vy + force.fy) * damping;

            // Update position
            pos.x += pos.vx;
            pos.y += pos.vy;

            const displacement = pos.vx * pos.vx + pos.vy * pos.vy;
            if (displacement > maxDisplacement) {
                maxDisplacement = displacement;
            }

            // Boundary constraints (optional, to keep inside canvas)
            // pos.x = Math.max(50, Math.min(width - 50, pos.x));
            // pos.y = Math.max(50, Math.min(height - 50, pos.y));
        });

        // Check convergence
        iterationRef.current += 1;
        const isStationary = maxDisplacement < (threshold * threshold);
        const isTimeout = iterationRef.current > iterations;

        if (isStationary || isTimeout) {
            setIsConverged(true);
            // Final update to state
            setPositions(new Map(posMap));
        } else {
            // Continue simulation
            // Throttling: Update state every frame gives smooth animation but heavy render load
            // We can update state every N frames if needed, but for now we try per-frame
            setPositions(new Map(posMap));
            requestRef.current = requestAnimationFrame(runSimulationStep);
        }
    }, [nodes, edges, width, height, repulsionStrength, attractionStrength, centerStrength, damping, iterations, threshold]);

    const startSimulation = useCallback(() => {
        if (requestRef.current) {cancelAnimationFrame(requestRef.current);}
        requestRef.current = requestAnimationFrame(runSimulationStep);
    }, [runSimulationStep]);

    useEffect(() => {
        // Start simulation when nodes/edges change significantly
        if (nodes.length > 0) {
            startSimulation();
        }
        return () => {
            if (requestRef.current) {cancelAnimationFrame(requestRef.current);}
        };
    }, [startSimulation, nodes.length, edges.length]);

    return {
        positions,
        isConverged,
        restart: () => {
            iterationRef.current = 0;
            setIsConverged(false);
            startSimulation();
        },
    };
};

export default useForceLayout;
