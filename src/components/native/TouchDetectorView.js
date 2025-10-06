/**
 * 原生触摸检测组件
 * 用于直接拦截原生触摸事件
 */

import React from 'react';
import { requireNativeComponent, NativeEventEmitter, NativeModules } from 'react-native';

const TouchDetectorViewNative = requireNativeComponent('TouchDetectorView');

class TouchDetectorView extends React.Component {
  constructor(props) {
    super(props);
    this.eventEmitter = new NativeEventEmitter(NativeModules.TouchTypeDetection);
    console.log('🔧 [TouchDetectorView] 初始化, TouchTypeDetection模块:', NativeModules.TouchTypeDetection ? '存在' : '不存在');
  }

  componentDidMount() {
    console.log('🔧 [TouchDetectorView] componentDidMount, 开始监听NativeTouchDetected事件');
    
    // 监听原生触摸检测事件
    this.touchListener = this.eventEmitter.addListener(
      'NativeTouchDetected',
      (touchData) => {
        if (this.props.onTouchDetected) {
          this.props.onTouchDetected(touchData);
        }
      }
    );
    
    console.log('🔧 [TouchDetectorView] 事件监听器已设置');
  }

  componentWillUnmount() {
    console.log('🔧 [TouchDetectorView] componentWillUnmount, 移除监听器');
    if (this.touchListener) {
      this.touchListener.remove();
    }
  }

  render() {
    const { enabled = true } = this.props;
    
    // 如果禁用，返回null以避免性能开销
    if (!enabled) {
      return null;
    }
    
    return (
      <TouchDetectorViewNative
        {...this.props}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
          },
          this.props.style,
        ]}
      />
    );
  }
}

export default TouchDetectorView;


