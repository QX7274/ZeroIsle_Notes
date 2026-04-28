import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useTheme } from '../../context/ThemeContext';
import { useWindowDimensions } from 'react-native';

// --- Configuration ---
const NUM_PARTICLES = 80; // Reduced for performance with React state updates
const PARTICLE_RADIUS = 1.5;
const MAX_SPEED = 0.3;
const CONVERGE_SPEED = 0.05;
const EXPLODE_SPEED = 2;
const DRIFT_DURATION = 12000;
const CONVERGE_DURATION = 5000;
const EXPLODE_DURATION = 2000;

const hashStringToInt = value => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getStableUnitValue = seed => {
  const hash = hashStringToInt(seed);
  return (hash % 10000) / 10000;
};

const ParticleBackground = () => {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const [particles, setParticles] = useState([]);
  const [status, setStatus] = useState('drifting');
  const frameRef = useRef(null);
  const explodeCycleRef = useRef(0);

  const center = useMemo(() => ({ x: width / 2, y: height / 2 }), [width, height]);

  // Initialize particles
  useEffect(() => {
    if (width > 0 && height > 0) {
      const particleColors = [colors.primary, colors.secondary, colors.accent || colors.primary];
      setParticles(
        Array.from({ length: NUM_PARTICLES }).map((_, index) => {
          const xSeed = getStableUnitValue(`init-${index}-x`);
          const ySeed = getStableUnitValue(`init-${index}-y`);
          const vxSeed = getStableUnitValue(`init-${index}-vx`);
          const vySeed = getStableUnitValue(`init-${index}-vy`);
          const opacitySeed = getStableUnitValue(`init-${index}-opacity`);
          const colorSeed = getStableUnitValue(`init-${index}-color`);

          return {
            x: xSeed * width,
            y: ySeed * height,
            vx: (vxSeed - 0.5) * MAX_SPEED,
            vy: (vySeed - 0.5) * MAX_SPEED,
            initialVx: 0,
            initialVy: 0,
            opacity: 0.1 + opacitySeed * 0.5,
            color: particleColors[Math.floor(colorSeed * particleColors.length)],
          };
        })
      );
    }
  }, [width, height, colors]);

  // Animation cycle controller
  useEffect(() => {
    if (particles.length === 0) {return;}
    const schedule = () => {
      const driftTimer = setTimeout(() => {
        setStatus('converging');
        const convergeTimer = setTimeout(() => {
          explodeCycleRef.current += 1;
          setParticles(prevParticles =>
            prevParticles.map((p, index) => {
              const angleSeed = getStableUnitValue(`explode-${explodeCycleRef.current}-${index}-angle`);
              const speedSeed = getStableUnitValue(`explode-${explodeCycleRef.current}-${index}-speed`);
              const angle = angleSeed * 2 * Math.PI;
              const speed = speedSeed * EXPLODE_SPEED;
              return {
                ...p,
                initialVx: Math.cos(angle) * speed,
                initialVy: Math.sin(angle) * speed,
              };
            })
          );
          setStatus('exploding');
          const explodeTimer = setTimeout(() => {
            setStatus('drifting');
            schedule();
          }, EXPLODE_DURATION);
          return () => clearTimeout(explodeTimer);
        }, CONVERGE_DURATION);
        return () => clearTimeout(convergeTimer);
      }, DRIFT_DURATION);
      return () => clearTimeout(driftTimer);
    };

    const cleanup = schedule();
    return cleanup;
  }, [particles.length]);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    if (particles.length === 0) {return;}
    const animate = () => {
      setParticles(prevParticles =>
        prevParticles.map(p => {
          let newParticle = { ...p };
          if (status === 'drifting') {
            newParticle.x += newParticle.vx;
            newParticle.y += newParticle.vy;
            if (newParticle.x > width) {newParticle.x = 0;}
            if (newParticle.x < 0) {newParticle.x = width;}
            if (newParticle.y > height) {newParticle.y = 0;}
            if (newParticle.y < 0) {newParticle.y = height;}
          } else if (status === 'converging') {
            const dx = center.x - newParticle.x;
            const dy = center.y - newParticle.y;
            newParticle.x += dx * CONVERGE_SPEED;
            newParticle.y += dy * CONVERGE_SPEED;
          } else if (status === 'exploding') {
            newParticle.x += newParticle.initialVx;
            newParticle.y += newParticle.initialVy;
            newParticle.initialVx *= 0.98; // Dampening
            newParticle.initialVy *= 0.98; // Dampening
          }
          return newParticle;
        })
      );
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [status, width, height, center, particles.length]);

  if (width === 0 || height === 0 || particles.length === 0) {
    return null;
  }

  return (
    <Canvas style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Group>
        {particles.map((particle, index) => (
          <Circle
            key={index}
            cx={particle.x}
            cy={particle.y}
            r={PARTICLE_RADIUS}
            color={particle.color}
            opacity={particle.opacity}
          />
        ))}
      </Group>
    </Canvas>
  );
};

export default ParticleBackground;


