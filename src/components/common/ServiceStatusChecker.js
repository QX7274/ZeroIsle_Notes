/**
 * 服务状态检查组件
 * 用于在应用启动时检查服务初始化状态
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { checkAllServices } from '../../services/serviceChecker';

const ServiceStatusChecker = ({ onComplete }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [checkResults, setCheckResults] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const checkServices = async () => {
      try {
        console.log('服务状态检查组件: 开始检查服务...');
        const results = await checkAllServices();
        setCheckResults(results);
        
        // 如果所有必需服务都已初始化，则在短暂延迟后调用onComplete
        if (results.success) {
          console.log('服务状态检查组件: 所有必需服务已初始化');
          setTimeout(() => {
            setIsChecking(false);
            if (onComplete) {
              onComplete(true);
            }
          }, 500);
        } else {
          console.error('服务状态检查组件: 某些必需服务初始化失败');
          setIsChecking(false);
          setShowModal(true);
        }
      } catch (error) {
        console.error('服务状态检查组件: 检查服务失败', error);
        setIsChecking(false);
        setShowModal(true);
      }
    };

    checkServices();
  }, [onComplete]);

  const handleContinue = () => {
    setShowModal(false);
    if (onComplete) {
      onComplete(false);
    }
  };

  const renderServiceStatus = () => {
    if (!checkResults || !checkResults.results) {
      return null;
    }

    return checkResults.results.map((result, index) => (
      <View key={index} style={styles.serviceItem}>
        <Text style={styles.serviceName}>{result.name}</Text>
        <Text style={[
          styles.serviceStatus,
          result.initialized ? styles.statusSuccess : styles.statusError
        ]}>
          {result.initialized ? '已初始化' : '初始化失败'}
        </Text>
        {result.error && (
          <Text style={styles.errorText}>{result.error}</Text>
        )}
      </View>
    ));
  };

  return (
    <View style={styles.container}>
      {isChecking ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>正在检查服务状态...</Text>
        </View>
      ) : null}

      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>服务初始化状态</Text>
            
            <View style={styles.servicesList}>
              {renderServiceStatus()}
            </View>
            
            <Text style={styles.warningText}>
              某些必需服务初始化失败，应用可能无法正常工作。
            </Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={handleContinue}
              >
                <Text style={styles.buttonText}>继续使用</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  servicesList: {
    width: '100%',
    marginBottom: 15,
  },
  serviceItem: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  serviceStatus: {
    fontSize: 14,
  },
  statusSuccess: {
    color: 'green',
  },
  statusError: {
    color: 'red',
  },
  errorText: {
    fontSize: 12,
    color: 'red',
    marginTop: 4,
  },
  warningText: {
    fontSize: 14,
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default ServiceStatusChecker;
