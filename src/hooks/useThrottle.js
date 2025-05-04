/**
 * 节流钩子
 * 用于限制函数执行频率
 */
import { useState, useEffect, useRef } from 'react';

/**
 * 节流钩子
 * @param {any} value - 需要节流的值
 * @param {number} limit - 节流时间（毫秒）
 * @returns {any} - 节流后的值
 */
function useThrottle(value, limit = 200) {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      const now = Date.now();
      if (now - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = now;
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

export default useThrottle;
