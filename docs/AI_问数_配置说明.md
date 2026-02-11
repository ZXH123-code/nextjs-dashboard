# AI 问数：配置说明

AI 问数支持三种接入方式，**任选其一**配置即可（优先级：Gateway > DeepSeek 直连 > OpenAI 直连）。

## 一、三种接入方式

| 方式 | 环境变量 | 说明 |
|------|----------|------|
| **Vercel AI Gateway** | `AI_GATEWAY_API_KEY` | 统一入口、多模型（OpenAI/DeepSeek 等），需在 Vercel 控制台绑卡后才能使用免费 $5 额度。 |
| **DeepSeek 直连** | `DEEPSEEK_API_KEY` | 直连 DeepSeek 官方 API，无需绑卡，按量付费，性价比高。 |
| **OpenAI 直连** | `OPENAI_API_KEY` | 直连 OpenAI，无需 Vercel 绑卡，使用自己的 OpenAI 余额。 |

## 二、DeepSeek 直连（推荐，性价比高）

### 1. 获取 API Key

在 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并创建 API Key。

### 2. 环境变量

```env
# DeepSeek 直连（与 OpenAI/Gateway 二选一即可）
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥

# 可选：模型，不写默认 deepseek-chat（V3.2 非思考模式）
# DEEPSEEK_MODEL=deepseek-chat
# DEEPSEEK_MODEL=deepseek-reasoner
```

### 3. 全球可访问性与延迟

- **可访问性**：DeepSeek 提供统一端点 `https://api.deepseek.com`，**全球均可调用**，无地域限制。
- **延迟**：基础设施主要在中国大陆。从**海外**请求时首包延迟可能略高于 US 机房；从**国内**访问延迟较低。

## 三、OpenAI 直连

```env
OPENAI_API_KEY=sk-你的OpenAI密钥
# 可选，默认 gpt-4o-mini
# OPENAI_MODEL=gpt-4o-mini
```

## 四、Vercel AI Gateway

需在 [Vercel 控制台](https://vercel.com) 为团队添加付款方式后，才能使用 Gateway 的免费额度。

```env
AI_GATEWAY_API_KEY=你的Gateway密钥
# 可选，例如 deepseek/deepseek-v3.2、openai/gpt-4o-mini
# AI_GATEWAY_MODEL=deepseek/deepseek-v3.2
```

## 五、优先级与冲突

同时配置多个 Key 时，实际使用顺序为：

1. `AI_GATEWAY_API_KEY`
2. `DEEPSEEK_API_KEY`
3. `OPENAI_API_KEY`

例如只配了 `DEEPSEEK_API_KEY`，则使用 DeepSeek 直连。

## 六、只读数据库（可选）

为降低风险，建议为 AI 问数配置只读 DB 用户，见 [AI_问数_只读数据库用户.md](./AI_问数_只读数据库用户.md)。
