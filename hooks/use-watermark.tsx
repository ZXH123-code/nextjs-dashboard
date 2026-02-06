"use client";

import { useEffect, useRef } from "react";

interface WatermarkOptions {
  text: string;
  fontSize?: number;
  color?: string;
  opacity?: number;
  angle?: number;
  gap?: number;
  zIndex?: number;
}

/**
 * 现代化的水印 Hook
 * 使用 Canvas 生成水印，具备基本的防删除能力
 */
export function useWatermark({
  text,
  fontSize = 16,
  color = "#000000",
  opacity = 0.1,
  angle = -45,
  gap = 150,
  zIndex = 9999,
}: WatermarkOptions) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 创建 Canvas 生成水印图片
    const createWatermark = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      // 设置画布大小
      canvas.width = gap;
      canvas.height = gap;

      // 设置文字样式
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
      
      // 处理颜色和透明度
      let rgbaColor: string;
      if (color.startsWith("#")) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        rgbaColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      } else if (color.startsWith("rgb")) {
        rgbaColor = color.replace("rgb", "rgba").replace(")", `, ${opacity})`);
      } else {
        rgbaColor = `rgba(0, 0, 0, ${opacity})`;
      }

      ctx.fillStyle = rgbaColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 旋转并绘制文字
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
      ctx.restore();

      return canvas.toDataURL();
    };

    const dataURL = createWatermark();
    const container = containerRef.current;

    // 设置水印样式
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.backgroundImage = `url(${dataURL})`;
    container.style.backgroundRepeat = "repeat";
    container.style.backgroundSize = `${gap}px ${gap}px`;
    container.style.pointerEvents = "none";
    container.style.zIndex = String(zIndex);

    // 监听 DOM 变化，防止水印被删除
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.removedNodes.length) {
          mutation.removedNodes.forEach((node) => {
            if (node === container) {
              // 如果水印被删除，重新创建
              const newContainer = document.createElement("div");
              newContainer.setAttribute("data-watermark", "true");
              Object.assign(newContainer.style, {
                position: "fixed",
                top: "0",
                left: "0",
                width: "100%",
                height: "100%",
                backgroundImage: `url(${dataURL})`,
                backgroundRepeat: "repeat",
                backgroundSize: `${gap}px ${gap}px`,
                pointerEvents: "none",
                zIndex: String(zIndex),
              });
              document.body.appendChild(newContainer);
              containerRef.current = newContainer;
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [text, fontSize, color, opacity, angle, gap, zIndex]);

  return containerRef;
}
