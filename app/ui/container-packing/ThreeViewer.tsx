"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PackingResponse } from "@/app/lib/container-packing-types";

interface ThreeViewerProps {
    renderData: PackingResponse["render"] | null;
}

export default function ThreeViewer({ renderData }: ThreeViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const animationIdRef = useRef<number>(0);
    const itemMeshesRef = useRef<THREE.Mesh[]>([]);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // 初始化 Three.js 场景
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // 创建场景
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#f8fafc");
        sceneRef.current = scene;

        // 创建相机
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
        camera.position.set(15, 12, 12);
        cameraRef.current = camera;

        // 创建渲染器
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // 创建控制器
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;

        // 添加光源
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(10, 15, 10);
        scene.add(dirLight);

        // 动画循环
        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // 窗口大小调整
        const handleResize = () => {
            if (!containerRef.current || !renderer || !camera) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", handleResize);

        // 清理函数
        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(animationIdRef.current);
            renderer.dispose();
            controls.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    // 鼠标移动处理（用于 tooltip）
    useEffect(() => {
        const canvas = rendererRef.current?.domElement;
        if (!canvas) return;

        const handleMouseMove = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            setMousePos({ x: event.clientX, y: event.clientY });

            const raycaster = new THREE.Raycaster();
            const pointer = new THREE.Vector2(x, y);
            raycaster.setFromCamera(pointer, cameraRef.current!);
            const hits = raycaster.intersectObjects(itemMeshesRef.current, false);

            if (hits.length > 0) {
                const hitMesh = hits[0].object as THREE.Mesh;
                setHoveredItem(hitMesh.userData.id);
                // 高亮
                (hitMesh.material as THREE.MeshStandardMaterial).color.setHex(0xfacc15);
            } else {
                // 取消高亮
                itemMeshesRef.current.forEach((mesh) => {
                    (mesh.material as THREE.MeshStandardMaterial).color.setHex(
                        mesh.userData._baseColor
                    );
                });
                setHoveredItem(null);
            }
        };

        const handleMouseLeave = () => {
            itemMeshesRef.current.forEach((mesh) => {
                (mesh.material as THREE.MeshStandardMaterial).color.setHex(
                    mesh.userData._baseColor
                );
            });
            setHoveredItem(null);
        };

        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, [renderData]);

    // 渲染装箱结果
    useEffect(() => {
        if (!renderData || !sceneRef.current || !controlsRef.current) return;

        const scene = sceneRef.current;
        const controls = controlsRef.current;

        // 清除旧的网格
        while (scene.children.length > 2) {
            const obj = scene.children[2];
            scene.remove(obj);
        }
        itemMeshesRef.current = [];

        const { container, items } = renderData;
        const size = container.size;
        const maxDim = Math.max(size.length, size.width, size.height);
        const scale = 10 / maxDim;

        // 创建容器边框
        const containerGeo = new THREE.BoxGeometry(
            size.length * scale,
            size.height * scale,
            size.width * scale
        );
        const edges = new THREE.EdgesGeometry(containerGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x1f2937 });
        const containerMesh = new THREE.LineSegments(edges, lineMat);
        scene.add(containerMesh);

        // 创建物品
        const itemGroup = new THREE.Group();
        items.forEach((item) => {
            const geo = new THREE.BoxGeometry(
                item.size.length * scale,
                item.size.height * scale,
                item.size.width * scale
            );
            const mat = new THREE.MeshStandardMaterial({
                color: item.color || "#93c5fd",
                transparent: true,
                opacity: item.opacity ?? 0.9,
            });
            const mesh = new THREE.Mesh(geo, mat);

            // 坐标映射
            mesh.position.set(
                (item.position.x + item.size.length / 2 - size.length / 2) * scale,
                (item.position.z + item.size.height / 2 - size.height / 2) * scale,
                (item.position.y + item.size.width / 2 - size.width / 2) * scale
            );

            mesh.userData = item;
            mesh.userData._baseColor = new THREE.Color(item.color || "#93c5fd").getHex();
            itemMeshesRef.current.push(mesh);
            itemGroup.add(mesh);

            // 添加边框
            const edge = new THREE.LineSegments(
                new THREE.EdgesGeometry(geo),
                new THREE.LineBasicMaterial({ color: 0x0f172a })
            );
            edge.position.copy(mesh.position);
            itemGroup.add(edge);
        });

        scene.add(itemGroup);
        controls.target.set(0, 0, 0);
        controls.update();
    }, [renderData]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="h-full w-full" />

            {/* Tooltip */}
            {hoveredItem && renderData && (
                <div
                    ref={tooltipRef}
                    className="pointer-events-none fixed z-50 rounded-md bg-slate-900/95 px-3 py-2 text-xs text-white shadow-lg"
                    style={{
                        left: `${mousePos.x + 10}px`,
                        top: `${mousePos.y + 10}px`,
                    }}
                >
                    {(() => {
                        const item = renderData.items.find((i) => i.id === hoveredItem);
                        if (!item) return null;
                        return (
                            <div className="whitespace-pre">
                                <div className="font-semibold">{item.name}</div>
                                <div>ID: {item.id}</div>
                                <div>
                                    尺寸: {item.size.length}×{item.size.width}×{item.size.height}
                                </div>
                                <div>
                                    位置: ({item.position.x}, {item.position.y}, {item.position.z})
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

      {/* 操作提示 */}
      <div className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
        🖱️ 拖拽旋转 | 滚轮缩放 | 右键平移
      </div>
        </div>
    );
}
