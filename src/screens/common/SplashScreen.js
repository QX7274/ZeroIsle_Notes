/**
 * 统一启动屏幕组件
 * 集成所有初始化阶段 - 美化版
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Animated, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const SplashScreen = ({ onComplete }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [slideAnim] = useState(new Animated.Value(30));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [progressAnim] = useState(new Animated.Value(0));
  const [currentStage, setCurrentStage] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [progress, setProgress] = useState(0);

  const pulseRef = useRef();

  // 定义加载阶段
  const stages = [
    { name: '服务初始化', message: '正在初始化基础服务...', duration: 1000 },
    { name: '服务检查', message: '正在检查服务状态...', duration: 1500 },
    { name: '认证检查', message: '正在检查认证状态...', duration: 1500 },
    { name: '完成', message: '即将进入应用...', duration: 500 },
  ];

  useEffect(() => {
    // 启动淡入动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Logo缩放动画
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // 文本滑入动画
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // 脉冲动画
    const createPulseAnimation = () => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
    };

    pulseRef.current = createPulseAnimation();
    pulseRef.current.start();

    let isCancelled = false;

    // 执行分阶段加载
    const runStages = async () => {
      let currentProgress = 0;

      for (let i = 0; i < stages.length; i++) {
        if (isCancelled) {return;}

        setCurrentStage(i);
        setStageMessage(stages[i].message);

        // 模拟进度增长
        const stepProgress = 100 / stages.length;
        const startProgress = currentProgress;
        const endProgress = currentProgress + stepProgress;

        // 平滑进度条动画
        const progressInterval = setInterval(() => {
          if (isCancelled) {
            clearInterval(progressInterval);
            return;
          }
          currentProgress += 2;
          if (currentProgress >= endProgress) {
            currentProgress = endProgress;
            clearInterval(progressInterval);
          }
          setProgress(currentProgress);

          // 更新进度条动画
          Animated.timing(progressAnim, {
            toValue: currentProgress,
            duration: 100,
            useNativeDriver: false,
          }).start();
        }, 50);

        // 等待当前阶段完成
        await new Promise(resolve => setTimeout(resolve, stages[i].duration));
        clearInterval(progressInterval);
        setProgress(endProgress);
      }

      if (isCancelled) {return;}

      // 所有阶段完成，淡出并调用回调
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (onComplete && !isCancelled) {
          onComplete();
        }
      });
    };

    runStages();

    // 清理函数
    return () => {
      isCancelled = true;
      if (pulseRef.current) {
        pulseRef.current.stop();
      }
    };
  }, [onComplete]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* 背景装饰 */}
      <View style={styles.backgroundDecoration} />

      {/* Logo容器 */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        <View style={styles.logoWrapper}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
          />
          {/* Logo光晕效果 */}
          <View style={styles.logoGlow} />
        </View>
      </Animated.View>

      {/* 文本内容 */}
      <Animated.View
        style={[
          styles.textContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={styles.title}>零屿笔记</Text>
        <Text style={styles.subtitle}>AI驱动</Text>
        <Text style={styles.tagline}>从零开始构建您的知识岛屿</Text>
      </Animated.View>

      {/* 进度条容器 */}
      <Animated.View
        style={[
          styles.progressContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
          {/* 进度条光效 */}
          <Animated.View
            style={[
              styles.progressGlow,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </Animated.View>

      {/* 加载指示器 */}
      <Animated.View
        style={[
          styles.loaderContainer,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
        {/* 加载指示器背景 */}
        <View style={styles.loaderBackground} />
      </Animated.View>

      {/* 状态消息 */}
      <Animated.Text
        style={[
          styles.message,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {stageMessage}
      </Animated.Text>

      {/* 阶段指示器 */}
      <Animated.View
        style={[
          styles.stageIndicator,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {stages.map((stage, index) => (
          <View
            key={index}
            style={[
              styles.stageDot,
              index <= currentStage && styles.stageDotActive,
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    position: 'relative',
  },
  // 背景装饰
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%)',
    opacity: 0.3,
  },
  // Logo容器
  logoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
    zIndex: 2,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2196F3',
    opacity: 0.1,
    zIndex: 1,
  },
  // 文本容器
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 8,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#2196F3',
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  tagline: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: screenWidth * 0.8,
  },
  // 进度条容器
  progressContainer: {
    width: '50%',
    marginBottom: 30,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 2,
    position: 'relative',
  },
  progressGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#90CAF9',
    borderRadius: 2,
    opacity: 0.6,
  },
  progressText: {
    fontSize: 13,
    color: '#2196F3',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // 加载指示器
  loaderContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    zIndex: 2,
  },
  loaderBackground: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    zIndex: 1,
  },
  // 状态消息
  message: {
    fontSize: 14,
    color: '#6C757D',
    textAlign: 'center',
    minHeight: 20,
    marginBottom: 20,
    fontWeight: '500',
  },
  // 阶段指示器
  stageIndicator: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  stageDotActive: {
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
    transform: [{ scale: 1.2 }],
  },
});

export default SplashScreen;
