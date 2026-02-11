# CRM 线索批量导入 · AI 智能字段映射说明

> 功能：在现有「线索批量导入」的基础上，增加一层 **AI 辅助字段映射**，用于解决 Excel 表头命名不规范但语义对应的问题。  
> 目标：减少对“严格中文表头”的依赖，让运营同学可以直接导入第三方来源的 Excel，而不必手工改列名。

---

## 一、整体思路概览

现有导入流程分为两大阶段：

1. **字段映射配置阶段（可选用 AI，必须人工确认）**
2. **按“已确认映射”做解析预览与最终导入**

AI 仅参与「字段映射配置」阶段，帮助给出“Excel 列 → 标准字段”的建议。  
**一旦映射被确认，后续的“解析并预览”与“确认导入”都严格使用这份确认映射，保证整个导入批次的一致性。**

---

## 二、入口与开关

- 入口页面与原来一致：  
  - `仪表盘 → CRM → 线索管理表`（`/dashboard/crm/leads`）  
  - 右上角点击「批量导入」进入导入页 `/dashboard/crm/leads/import`
- 在上传区域下方新增一个「字段映射策略」区域：
  - 文案示例：
    - 标题：**字段映射策略**
    - 说明：解析并预览前，先决定是否使用 AI 映射；若开启 AI，需先确认映射后才能预览。
  - 开关：
    - 复选框：**使用 AI 智能识别字段**
    - 默认关闭（保持与老版本行为一致）

---

## 三、AI 智能字段映射阶段

### 1. 目标标准字段列表

AI 要做的事：把 Excel 中的「表头 + 示例值」映射到以下标准字段之一（或不映射）：

- `customerName`：客户名称（必填）
- `nickname`：昵称
- `contactPerson`：联系人
- `contactEmail`：联系人邮箱
- `city`：城市
- `address`：详细地址
- `industry`：行业
- `leadSource`：线索来源
- `customerTier`：客户分层
- `remark`：备注

> 说明：  
> - 未被映射为上述字段、且未被显式忽略的列，会按照原有逻辑进入 `extraFields`（扩展 JSON 字段）。  
> - `customerName` 仍然是必填字段：即便使用 AI，若最终无法为某行得到客户名称，该行依然会被判定为错误并跳过。

### 2. AI 调用与返回结构

当前实现中，AI 智能映射通过 `/api/crm/leads/import/ai-map` 完成：

1. 前端上传同一个 Excel 文件（仅用于分析，不写库）；
2. 后端解析第一张工作表，读取表头与前 30 行数据，构造：
   - `columns: { excelHeader: string; sampleValues: string[] }[]`
3. 构造目标字段元数据 `targetFields`，包含 id、中文说明、是否必填、数据库列名；
4. 调用 DeepSeek / OpenAI：
   - 提供目标字段列表 + Excel 列和示例值；
   - 要求模型返回形如：

```json
{
  "mappings": [
    {
      "excel_header": "公司名称",
      "target_field": "customerName",
      "confidence": 0.93,
      "reason": "绝大多数值看起来是公司主体名称"
    }
  ]
}
```

5. 使用 `zod` 校验和清洗：
   - `excel_header` 必须存在于当前 Excel 表头中；
   - `target_field` 必须是上述标准字段 id 或 `null`；
   - `confidence` 归一化到 `[0,1]`；
   - 对明显“一个必填字段被多列竞争”的情况，打上 `conflict: true`（在前端高亮提示）。

接口返回结构（简化）：

```ts
{
  success: boolean;
  columns: {
    excelHeader: string;
    suggestedField: "customerName" | "nickname" | ... | null;
    confidence: number | null;
    reason?: string;
    conflict?: boolean;
    sampleValues: string[];
  }[];
  targetFields: {
    id: string;        // 与上面的 suggestedField 一致
    label: string;     // 中文展示，例如「客户名称」
    description: string;
    required?: boolean;
  }[];
}
```

> 降级策略：  
> - 若 AI 返回为空或格式不合法，后端会返回 `success: true, columns: []`，前端会给出提示“AI 暂未给出字段映射建议，请手动选择字段”，此时导入逻辑退化为完全手动/旧逻辑。

### 3. 前端映射编辑与确认

当前导入页中，AI 映射相关的前端状态分为两层：

- `editingMapping`（组件内为 `aiMapping.mapping`）：
  - 包含 AI 建议 + 用户手动调整；
  - 用户在映射表中改下拉选择时，只会修改这份“编辑中”的映射。
- `confirmedMapping`：
  - 用户点击「确认字段映射」之后，从 `editingMapping` 拷贝一份快照；
  - **只有这份快照会被真正用于预览和导入**。

交互要点：

1. **执行 AI 识别**
   - 点击「AI 智能识别字段」按钮：
     - 拉取 AI 建议，填充 `editingMapping`；
     - 自动标记当前映射为 `mappingDirty = true`（尚未确认）。
2. **人工调整 + 确认映射**
   - 在映射表中逐列调整：
     - 下拉选项：
       - 某个标准字段：例如「客户名称」「联系人」等；
       - 「作为扩展字段保存到 extraFields」：不进入标准字段，只进 `extraFields`；
       - 「不导入（忽略该列）」：既不进标准字段，也不进 `extraFields`。
   - 点击「确认字段映射」按钮：
     - 校验：至少有一列被映射为 `customerName`；
     - 把 `editingMapping` 拷贝为 `confirmedMapping`；
     - 清除 `mappingDirty` 标记；
     - 自动清空之前的预览结果 `result`，要求用户重新预览。
3. 只要在映射表中再次修改了某一列：
   - 会自动把 `mappingDirty` 设为 `true`；
   - 清空旧的 `result`（上一次预览不再有效）；
   - 前端禁止继续预览/导入，直到再次点击「确认字段映射」。

---

## 四、解析并预览与最终导入阶段

### 1. 条件约束

- 当 **未开启 AI** 时：
  - 行为与老版本完全一致：
    - 点击「解析并预览」：
      - 仅携带文件和 `mode=preview`；
      - 后端只依赖中文规范表头 + `extraFields`；
    - 预览成功后可点击「确认导入」，走 `mode=import` 真正写库。

- 当 **开启 AI** 时：
  - 在允许“解析并预览”前，必须满足：
    1. 已执行过一次 AI 智能识别（拿到 `editingMapping`）；
    2. 当前映射已经通过「确认字段映射」按钮生成了 `confirmedMapping`；
    3. 映射之后没有进一步修改（`mappingDirty === false`）。
  - 若不满足以上任一条件，点击「解析并预览」会直接提示错误，不会发送请求。

### 2. 后端导入接口如何使用映射

后端导入接口 `/api/crm/leads/import` 在请求体中读取可选字段：

- `mapping: { [excelHeader: string]: { targetField: string | null } }`
  - 为 `null`：表示该列被显式“忽略”；
  - 为标准字段 id：映射到对应 `crm_lead` 字段；
  - 未出现在 mapping 里：沿用老逻辑（规范中文表头 → 标准字段，否则进 `extraFields`）。

具体行为：

1. 构建 `headersByTargetField`：
   - 将 `mapping` 反向索引为 `targetField → [excelHeader...]`。
2. 字段取值函数 `getMappedStr(row, targetField, fallbackHeaders[])`：
   - 优先根据 `headersByTargetField[targetField]` 在当前行中读取非空值；
   - 若找不到，再尝试老的中文表头（例如 `["客户名称"]`、`["联系人"]` 等）。
3. 标准字段写入：
   - `customerName` / `nickname` / `contactPerson` / `contactEmail` / `city` / `address` / `industry` / `leadSource` / `customerTier` / `remark` 均通过 `getMappedStr` 取值。
4. `extraFields` 行为：
   - 遍历一行中的所有列：
     - 若该列在 `mapping` 中，且 `targetField` 为标准字段或为 `null`（忽略），则 **不会** 进入 `extraFields`；
     - 否则：
       - 若表头不在规范字段集中，且当前值非空，就写入 `extraFields[表头] = 单元格原始值`。
5. 预览与导入共享逻辑：
   - `mode=preview`：仅构造 `RowPreview` 与 `dataToInsert`，不写库；
   - `mode=import`：真正执行 `prisma.crm_lead.createMany({ data: dataToInsert })`；
   - 两者都严格使用同一份 `mapping`（也就是前端的 `confirmedMapping`）。

---

## 五、典型使用流程（含 AI）

1. **上传 Excel 文件**
   - 与旧版相同，支持拖拽或点击选择 `.xlsx` 文件。
2. **选择是否启用 AI 字段映射**
   - 若不开启：直接走原有「解析并预览 → 确认导入」流程。
   - 若开启：进入 AI 字段映射阶段。
3. **执行 AI 智能识别**
   - 点击「AI 智能识别字段」：
     - 稍等 3～5 秒；
     - 页面下方出现“字段映射预览（按列）”表格。
4. **逐列检查/调整映射**
   - 每一列都可以：
     - 接受 AI 建议的标准字段；
     - 改成其他标准字段；
     - 设置为“作为扩展字段保存到 extraFields”；
     - 或“**不导入**（忽略该列）”。
5. **确认字段映射**
   - 确认前：
     - 至少需要有一列映射为「客户名称」；
   - 点击「确认字段映射」后：
     - 映射被锁定为 `confirmedMapping`；
     - 按当前映射生成的任何旧预览会被清空，需要重新解析。
6. **解析并预览**
   - 使用 `confirmedMapping` 调用后端，生成每行的预览结果；
   - 预览中可以确认：映射后的客户名称、联系人、城市等字段是否符合预期。
7. **若不满意**
   - 回到映射表，继续调整列映射；
   - 再次点击「确认字段映射」；
   - 重新点击「解析并预览」；
   - 如此循环，直到预览结果满意。
8. **确认导入**
   - 满足：
     - 预览成功（有 `willInsert > 0`）；
     - 若启用 AI，则映射已确认且无修改；
   - 点击「确认导入」真正写入数据库。

---

## 六、与旧版本的兼容性说明

- 不启用「使用 AI 智能识别字段」时：
  - 前端不会调用 `/api/crm/leads/import/ai-map`；
  - 不会携带 `mapping` 字段给后端；
  - 导入行为与 `CRM_线索批量导入说明.md` 中描述的逻辑完全一致。
- 启用 AI 时：
  - 仅在字段取值和 `extraFields` 归属上做了“列级重排”，不会改变权限校验、文件格式校验、行级错误处理等其他逻辑。

---

## 七、后续可扩展方向（建议）

1. **映射模板化**
   - 将本次确认的 `confirmedMapping` 以「模板名称 + 映射规则」方式保存；
   - 下次导入类似来源的 Excel 时，可以先选择一个模板再调用 AI 做微调。
2. **扩展到其他导入场景**
   - 将当前 AI 字段映射抽象为通用模块（例如 `suggestImportMapping(modelName, targetFields, columns)`）；
   - 未来在「客户导入」「商机导入」等新功能中复用同一套逻辑。
3. **更细粒度的检查提示**
   - 在“确认字段映射”时附带一个简短的“映射摘要”，例如：
     - `公司名称 → 客户名称`
     - `城市（City） → 城市`
     - `来源渠道 → 线索来源`
   - 方便业务同学在不打开预览表的情况下快速确认整体映射是否合理。 

