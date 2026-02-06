"use client";

import { useWatermark } from "@/hooks/use-watermark";

interface WatermarkProps {
  /** 水印文字 */
  text: string;
  /** 字体大小，默认 16 */
  fontSize?: number;
  /** 文字颜色，默认 #000000 */
  color?: string;
  /** 透明度，默认 0.1 */
  opacity?: number;
  /** 旋转角度（度），默认 -45 */
  angle?: number;
  /** 水印间距，默认 150 */
  gap?: number;
  /** 层级，默认 9999 */
  zIndex?: number;
}

/**
 * 水印组件
 * 在页面中添加可视水印，具备基本的防删除能力
 * 
 * @example
 * ```tsx
 * <Watermark text="内部使用" />
 * ```
 */
export function Watermark({
  text,
  fontSize = 16,
  color = "#000000",
  opacity = 0.1,
  angle = -45,
  gap = 150,
  zIndex = 9999,
}: WatermarkProps) {
  const containerRef = useWatermark({
    text,
    fontSize,
    color,
    opacity,
    angle,
    gap,
    zIndex,
  });

  return <div ref={containerRef} data-watermark="true" />;
}
