import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Result } from '../components/feedback';
import { FadeIn } from '../components/animations';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <FadeIn>
      <Result
        status="404"
        title="页面未找到"
        subTitle="抱歉，您访问的页面不存在。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回首页
          </Button>
        }
        showBack={false}
      />
    </FadeIn>
  );
};

export default NotFound;
