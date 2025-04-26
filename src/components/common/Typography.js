/**
 * 排版组件
 */
import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * 标题组件
 * @param {React.ReactNode} children - 文本内容
 * @param {string} level - 标题级别：h1, h2, h3, h4, h5, h6
 * @param {string} color - 文本颜色：primary, secondary, success, info, warning, error
 * @param {boolean} center - 是否居中
 * @param {object} style - 自定义样式
 */
export const Heading = ({
  children,
  level = 'h1',
  color,
  center = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // 标题样式
  const headingStyle = [];

  // 根据级别添加样式
  switch (level) {
    case 'h1':
      headingStyle.push(typography.HEADING.H1);
      break;
    case 'h2':
      headingStyle.push(typography.HEADING.H2);
      break;
    case 'h3':
      headingStyle.push(typography.HEADING.H3);
      break;
    case 'h4':
      headingStyle.push(typography.HEADING.H4);
      break;
    case 'h5':
      headingStyle.push(typography.HEADING.H5);
      break;
    case 'h6':
      headingStyle.push(typography.HEADING.H6);
      break;
    default:
      headingStyle.push(typography.HEADING.H1);
  }

  // 添加颜色
  if (color) {
    switch (color) {
      case 'primary':
        headingStyle.push({ color: colors.primary });
        break;
      case 'secondary':
        headingStyle.push({ color: colors.secondary });
        break;
      case 'success':
        headingStyle.push({ color: colors.success });
        break;
      case 'info':
        headingStyle.push({ color: colors.info });
        break;
      case 'warning':
        headingStyle.push({ color: colors.warning });
        break;
      case 'error':
        headingStyle.push({ color: colors.error });
        break;
      default:
        headingStyle.push({ color: colors.text });
    }
  } else {
    headingStyle.push({ color: colors.text });
  }

  // 居中样式
  if (center) {
    headingStyle.push({ textAlign: 'center' });
  }

  // 添加自定义样式
  if (style) {
    headingStyle.push(style);
  }

  return (
    <RNText style={headingStyle} {...props}>
      {children}
    </RNText>
  );
};

/**
 * 正文组件
 * @param {React.ReactNode} children - 文本内容
 * @param {string} size - 文本大小：small, medium, large
 * @param {string} color - 文本颜色：primary, secondary, success, info, warning, error
 * @param {boolean} bold - 是否加粗
 * @param {boolean} italic - 是否斜体
 * @param {boolean} center - 是否居中
 * @param {object} style - 自定义样式
 */
export const Body = ({
  children,
  size = 'medium',
  color,
  bold = false,
  italic = false,
  center = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // 正文样式
  const bodyStyle = [];

  // 根据大小添加样式
  switch (size) {
    case 'tiny':
      bodyStyle.push(typography.BODY.TINY);
      break;
    case 'small':
      bodyStyle.push(typography.BODY.SMALL);
      break;
    case 'medium':
      bodyStyle.push(typography.BODY.MEDIUM);
      break;
    case 'large':
      bodyStyle.push(typography.BODY.LARGE);
      break;
    default:
      bodyStyle.push(typography.BODY.MEDIUM);
  }

  // 添加颜色
  if (color) {
    switch (color) {
      case 'primary':
        bodyStyle.push({ color: colors.primary });
        break;
      case 'secondary':
        bodyStyle.push({ color: colors.secondary });
        break;
      case 'success':
        bodyStyle.push({ color: colors.success });
        break;
      case 'info':
        bodyStyle.push({ color: colors.info });
        break;
      case 'warning':
        bodyStyle.push({ color: colors.warning });
        break;
      case 'error':
        bodyStyle.push({ color: colors.error });
        break;
      case 'hint':
        bodyStyle.push({ color: colors.textHint });
        break;
      case 'disabled':
        bodyStyle.push({ color: colors.textDisabled });
        break;
      default:
        bodyStyle.push({ color: colors.text });
    }
  } else {
    bodyStyle.push({ color: colors.text });
  }

  // 加粗样式
  if (bold) {
    bodyStyle.push({ fontWeight: typography.FONT_WEIGHT.BOLD });
  }

  // 斜体样式
  if (italic) {
    bodyStyle.push({ fontStyle: 'italic' });
  }

  // 居中样式
  if (center) {
    bodyStyle.push({ textAlign: 'center' });
  }

  // 添加自定义样式
  if (style) {
    bodyStyle.push(style);
  }

  return (
    <RNText style={bodyStyle} {...props}>
      {children}
    </RNText>
  );
};

/**
 * 标签组件
 * @param {React.ReactNode} children - 文本内容
 * @param {string} size - 文本大小：small, medium, large
 * @param {string} color - 文本颜色：primary, secondary, success, info, warning, error
 * @param {boolean} center - 是否居中
 * @param {object} style - 自定义样式
 */
export const Label = ({
  children,
  size = 'medium',
  color,
  center = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  // 标签样式
  const labelStyle = [];

  // 根据大小添加样式
  switch (size) {
    case 'small':
      labelStyle.push(typography.LABEL.SMALL);
      break;
    case 'medium':
      labelStyle.push(typography.LABEL.MEDIUM);
      break;
    case 'large':
      labelStyle.push(typography.LABEL.LARGE);
      break;
    default:
      labelStyle.push(typography.LABEL.MEDIUM);
  }

  // 添加颜色
  if (color) {
    switch (color) {
      case 'primary':
        labelStyle.push({ color: colors.primary });
        break;
      case 'secondary':
        labelStyle.push({ color: colors.secondary });
        break;
      case 'success':
        labelStyle.push({ color: colors.success });
        break;
      case 'info':
        labelStyle.push({ color: colors.info });
        break;
      case 'warning':
        labelStyle.push({ color: colors.warning });
        break;
      case 'error':
        labelStyle.push({ color: colors.error });
        break;
      default:
        labelStyle.push({ color: colors.text });
    }
  } else {
    labelStyle.push({ color: colors.text });
  }

  // 居中样式
  if (center) {
    labelStyle.push({ textAlign: 'center' });
  }

  // 添加自定义样式
  if (style) {
    labelStyle.push(style);
  }

  return (
    <RNText style={labelStyle} {...props}>
      {children}
    </RNText>
  );
};

/**
 * 通用文本组件
 * @param {React.ReactNode} children - 文本内容
 * @param {string} variant - 文本变体：body, heading, label
 * @param {string} size - 文本大小：small, medium, large
 * @param {string} level - 标题级别：h1, h2, h3, h4, h5, h6
 * @param {string} color - 文本颜色：primary, secondary, success, info, warning, error
 * @param {boolean} bold - 是否加粗
 * @param {boolean} italic - 是否斜体
 * @param {boolean} center - 是否居中
 * @param {object} style - 自定义样式
 */
export const Text = ({
  children,
  variant = 'body',
  size = 'medium',
  level = 'h1',
  color,
  bold = false,
  italic = false,
  center = false,
  style,
  ...props
}) => {
  // 根据变体选择不同的组件
  switch (variant) {
    case 'heading':
      return (
        <Heading
          level={level}
          color={color}
          center={center}
          style={style}
          {...props}
        >
          {children}
        </Heading>
      );
    case 'label':
      return (
        <Label
          size={size}
          color={color}
          center={center}
          style={style}
          {...props}
        >
          {children}
        </Label>
      );
    case 'body':
    default:
      return (
        <Body
          size={size}
          color={color}
          bold={bold}
          italic={italic}
          center={center}
          style={style}
          {...props}
        >
          {children}
        </Body>
      );
  }
};

export default Text;
