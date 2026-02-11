import React from 'react';

/**
 * 8种加载图标类型：
 * 
 * 1. 'spinner' - 经典旋转环形加载器，带背景圆环和旋转楔形
 * 2. 'arc' - 简约弧形旋转加载器
 * 3. 'double-arc' - 双弧形旋转加载器，更饱满的视觉效果
 * 4. 'bars-scale' - 三条竖线缩放动画（适合音频/数据加载）
 * 5. 'bars-bounce' - 三条竖线上下弹跳动画（活泼风格）
 * 6. 'bars-wave' - 三条竖线波浪式伸缩动画（流畅优雅）
 * 7. 'bars-fade' - 三条竖线渐变闪烁动画（简洁低调）
 * 8. 'bars-pulse' - 三条竖线脉冲式伸缩+渐变动画（强烈动感）
 */
export type LoadingSpinnerType = 
  | 'spinner'      // 旋转环形（经典）
  | 'arc'          // 弧形旋转（简约）
  | 'double-arc'   // 双弧形旋转（饱满）
  | 'bars-scale'   // 竖线缩放（音频风）
  | 'bars-bounce'  // 竖线弹跳（活泼）
  | 'bars-wave'    // 竖线波浪（优雅）
  | 'bars-fade'    // 竖线渐变（低调）
  | 'bars-pulse';  // 竖线脉冲（动感）

interface LoadingSpinnerProps {
  /** 加载图标类型 */
  type?: LoadingSpinnerType;
  /** 图标大小（像素） */
  size?: number;
  /** 图标颜色 */
  color?: string;
  /** 自定义类名 */
  className?: string;
}

export function LoadingSpinner({
  type = 'spinner',
  size = 40,
  color = 'currentColor',
  className = '',
}: LoadingSpinnerProps) {
  const svgProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    xmlnsXlink: 'http://www.w3.org/1999/xlink',
    style: { display: 'inline-block' },
  };

  const renderSpinner = () => {
    switch (type) {
      case 'spinner':
        // 经典旋转环形加载器
        return (
          <svg
            {...svgProps}
            width={size}
            height={size}
            viewBox="0 0 40 40"
            className={className}
          >
            <path
              opacity="0.2"
              fill={color}
              d="M20.201,5.169c-8.254,0-14.946,6.692-14.946,14.946c0,8.255,6.692,14.946,14.946,14.946
                s14.946-6.691,14.946-14.946C35.146,11.861,28.455,5.169,20.201,5.169z M20.201,31.749c-6.425,0-11.634-5.208-11.634-11.634
                c0-6.425,5.209-11.634,11.634-11.634c6.425,0,11.633,5.209,11.633,11.634C31.834,26.541,26.626,31.749,20.201,31.749z"
            />
            <path
              fill={color}
              d="M26.013,10.047l1.654-2.866c-2.198-1.272-4.743-2.012-7.466-2.012h0v3.312h0
                C22.32,8.481,24.301,9.057,26.013,10.047z"
            >
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="rotate"
                from="0 20 20"
                to="360 20 20"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        );

      case 'arc':
        // 简约弧形旋转加载器
        return (
          <svg
            {...svgProps}
            width={size}
            height={size}
            viewBox="0 0 50 50"
            className={className}
          >
            <path
              fill={color}
              d="M25.251,6.461c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615V6.461z"
            >
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="rotate"
                from="0 25 25"
                to="360 25 25"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        );

      case 'double-arc':
        // 双弧形旋转加载器
        return (
          <svg
            {...svgProps}
            width={size}
            height={size}
            viewBox="0 0 50 50"
            className={className}
          >
            <path
              fill={color}
              d="M43.935,25.145c0-10.318-8.364-18.683-18.683-18.683c-10.318,0-18.683,8.365-18.683,18.683h4.068c0-8.071,6.543-14.615,14.615-14.615c8.072,0,14.615,6.543,14.615,14.615H43.935z"
            >
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="rotate"
                from="0 25 25"
                to="360 25 25"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        );

      case 'bars-scale':
        // 三条竖线缩放动画
        return (
          <svg
            {...svgProps}
            width={size}
            height={size * 0.6}
            viewBox="0 0 24 24"
            className={className}
          >
            <rect x="0" y="0" width="4" height="7" fill={color}>
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="scale"
                values="1,1; 1,3; 1,1"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="10" y="0" width="4" height="7" fill={color}>
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="scale"
                values="1,1; 1,3; 1,1"
                begin="0.2s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="20" y="0" width="4" height="7" fill={color}>
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="scale"
                values="1,1; 1,3; 1,1"
                begin="0.4s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        );

      case 'bars-bounce':
        // 三条竖线上下弹跳动画
        return (
          <svg
            {...svgProps}
            width={size}
            height={size * 0.75}
            viewBox="0 0 24 30"
            className={className}
          >
            <rect x="0" y="0" width="4" height="10" fill={color}>
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="translate"
                values="0 0; 0 20; 0 0"
                begin="0"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="10" y="0" width="4" height="10" fill={color}>
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="translate"
                values="0 0; 0 20; 0 0"
                begin="0.2s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="20" y="0" width="4" height="10" fill={color}>
              <animateTransform
                attributeType="xml"
                attributeName="transform"
                type="translate"
                values="0 0; 0 20; 0 0"
                begin="0.4s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        );

      case 'bars-wave':
        // 三条竖线波浪式伸缩动画
        return (
          <svg
            {...svgProps}
            width={size}
            height={size * 0.75}
            viewBox="0 0 24 30"
            className={className}
          >
            <rect x="0" y="13" width="4" height="5" fill={color}>
              <animate
                attributeName="height"
                attributeType="XML"
                values="5;21;5"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                attributeType="XML"
                values="13; 5; 13"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="10" y="13" width="4" height="5" fill={color}>
              <animate
                attributeName="height"
                attributeType="XML"
                values="5;21;5"
                begin="0.15s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                attributeType="XML"
                values="13; 5; 13"
                begin="0.15s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="20" y="13" width="4" height="5" fill={color}>
              <animate
                attributeName="height"
                attributeType="XML"
                values="5;21;5"
                begin="0.3s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                attributeType="XML"
                values="13; 5; 13"
                begin="0.3s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        );

      case 'bars-fade':
        // 三条竖线渐变闪烁动画
        return (
          <svg
            {...svgProps}
            width={size}
            height={size * 0.75}
            viewBox="0 0 24 30"
            className={className}
          >
            <rect x="0" y="0" width="4" height="20" fill={color}>
              <animate
                attributeName="opacity"
                attributeType="XML"
                values="1; .2; 1"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="7" y="0" width="4" height="20" fill={color}>
              <animate
                attributeName="opacity"
                attributeType="XML"
                values="1; .2; 1"
                begin="0.2s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="14" y="0" width="4" height="20" fill={color}>
              <animate
                attributeName="opacity"
                attributeType="XML"
                values="1; .2; 1"
                begin="0.4s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        );

      case 'bars-pulse':
        // 三条竖线脉冲式伸缩+渐变动画
        return (
          <svg
            {...svgProps}
            width={size}
            height={size * 0.75}
            viewBox="0 0 24 30"
            className={className}
          >
            <rect x="0" y="10" width="4" height="10" fill={color} opacity="0.2">
              <animate
                attributeName="opacity"
                attributeType="XML"
                values="0.2; 1; .2"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="height"
                attributeType="XML"
                values="10; 20; 10"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                attributeType="XML"
                values="10; 5; 10"
                begin="0s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="8" y="10" width="4" height="10" fill={color} opacity="0.2">
              <animate
                attributeName="opacity"
                attributeType="XML"
                values="0.2; 1; .2"
                begin="0.15s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="height"
                attributeType="XML"
                values="10; 20; 10"
                begin="0.15s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                attributeType="XML"
                values="10; 5; 10"
                begin="0.15s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="16" y="10" width="4" height="10" fill={color} opacity="0.2">
              <animate
                attributeName="opacity"
                attributeType="XML"
                values="0.2; 1; .2"
                begin="0.3s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="height"
                attributeType="XML"
                values="10; 20; 10"
                begin="0.3s"
                dur="0.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                attributeType="XML"
                values="10; 5; 10"
                begin="0.3s"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        );

      default:
        return null;
    }
  };

  return renderSpinner();
}
