# 3D 智能拼柜计算功能使用指南

## 概述

本功能集成了基于 OR-Tools 和 py3dbp 的 3D 装箱优化算法，支持集装箱智能装载计算和 3D 可视化。

## 架构说明

```
Next.js 前端 ⟷ API 代理 ⟷ FastAPI 后端
```

- **前端**: Next.js + Three.js + shadcn/ui
- **后端**: FastAPI + OR-Tools + py3dbp
- **通信**: RESTful API

## 启动步骤

### 1. 启动 FastAPI 后端

确保你有 Python FastAPI 服务（包含 `main.py`）：

```bash
# 在 FastAPI 项目目录
cd /path/to/your/fastapi/project

# 安装依赖
pip install fastapi uvicorn ortools py3dbp pydantic

# 启动服务（默认端口 8000）
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 配置环境变量

在项目根目录创建或编辑 `.env.local` 文件：

```env
# FastAPI 服务地址
FASTAPI_URL=http://localhost:8000
```

如果 FastAPI 运行在不同的端口或地址，请相应修改。

### 3. 启动 Next.js 前端

```bash
# 在 Next.js 项目目录
pnpm dev
```

### 4. 访问功能

浏览器访问：
```
http://localhost:3000/dashboard/fulfillment/container-loading
```

## 功能特性

### 算法能力

1. **双求解器支持**
   - OR-Tools: 精确求解，支持复杂约束
   - py3dbp: 启发式算法，快速求解

2. **智能规则**
   - ✓ 重物归底原则
   - ✓ 大件优先填充
   - ✓ 薄板竖放优化
   - ✓ 长条角落摆放
   - ✓ 四角支撑验证
   - ✓ 重心高度控制

3. **3D 可视化**
   - 实时 3D 渲染
   - 鼠标交互（旋转、缩放、平移）
   - 物品信息 Tooltip
   - 颜色区分不同物品

### 界面说明

**左侧面板**：
- 车厢尺寸设置
- 求解器选择
- 物品清单编辑
- 颜色选择器

**右侧视图**：
- 3D 装箱结果展示
- 装载率统计
- 操作提示

## API 端点

### 健康检查
```
GET /api/packing/solve
```

返回 FastAPI 服务状态。

### 装箱求解
```
POST /api/packing/solve
```

**请求体示例**：
```json
{
  "container": {
    "length": 12000,
    "width": 2350,
    "height": 2600,
    "max_weight": 12000,
    "unit": "mm"
  },
  "items": [
    {
      "id": "item-1",
      "name": "瓷砖箱",
      "length": 800,
      "width": 800,
      "height": 400,
      "quantity": 20,
      "color": "#dc2626"
    }
  ],
  "options": {
    "solver": "ortools",
    "time_limit_sec": 300
  }
}
```

## 故障排查

### 问题：无法连接到装箱服务

**检查清单**：
1. FastAPI 服务是否启动？
   ```bash
   curl http://localhost:8000/health
   ```
2. 环境变量 `FASTAPI_URL` 是否正确配置？
3. 端口是否被占用？

### 问题：求解时间过长

**解决方案**：
1. 切换到 `py3dbp` 求解器（更快但不支持复杂约束）
2. 减少物品数量
3. 增大 `time_limit_sec` 参数

### 问题：3D 渲染不显示

**检查清单**：
1. Three.js 是否正确安装？
   ```bash
   pnpm list three
   ```
2. 浏览器是否支持 WebGL？
3. 控制台是否有错误？

## 文件结构

```
app/
├── api/
│   └── packing/
│       └── solve/
│           └── route.ts          # API 代理路由
├── dashboard/
│   └── fulfillment/
│       └── container-loading/
│           └── page.tsx          # 主页面
├── lib/
│   └── container-packing-types.ts # 类型定义
└── ui/
    └── container-packing/
        ├── PackingForm.tsx       # 表单组件
        └── ThreeViewer.tsx       # 3D 渲染组件
```

## 性能优化建议

1. **生产环境部署**
   - 使用 Nginx 反向代理 FastAPI
   - 配置 CORS 策略
   - 启用 HTTPS

2. **求解优化**
   - 简单场景使用 py3dbp
   - 复杂约束使用 ortools
   - 合理设置 time_limit

3. **前端优化**
   - 大量物品时使用 LOD（细节层次）
   - 考虑使用 Web Worker 进行计算

## 下一步开发

- [ ] 添加装箱历史记录
- [ ] 支持导入/导出配置
- [ ] 批量求解多个方案
- [ ] 生成装箱报告 PDF
- [ ] 添加更多可视化选项

## 技术支持

如有问题，请查看：
- FastAPI 日志
- Next.js 开发服务器日志
- 浏览器控制台
