## 问题分析
GitHub Actions构建失败，错误信息：`Error: Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.`

**根本原因**：
1. Next.js 15.5.5在构建阶段会收集页面数据（`Collecting page data`）
2. 当收集`/api/ask`路由数据时，会执行该文件的导入语句
3. 这导致`ai-client.ts`和`embedClient.ts`在模块顶层执行
4. 这些文件使用非空断言（`!`）访问`AI_API_KEY`环境变量，当环境变量不存在时崩溃

## 修复方案

### 1. 修复 `ai-client.ts`
**文件**：`src/lib/ai-client.ts`
**修复内容**：
- 使用延迟初始化，避免在模块顶层创建OpenAI实例
- 移除非空断言，添加运行时环境变量检查
- 移除模块顶层的console.log输出

### 2. 修复 `embedClient.ts`
**文件**：`src/lib/embedClient.ts`
**修复内容**：
- 使用延迟初始化，避免在模块顶层创建OpenAIEmbeddings实例
- 移除非空断言，添加运行时环境变量检查

## 修复后的效果
- 构建过程不会因缺少环境变量而崩溃
- 环境变量检查延迟到运行时执行
- 代码具有更好的CI/CD兼容性

## 实施步骤
1. 修改 `src/lib/ai-client.ts`，实现AI客户端的延迟初始化
2. 修改 `src/lib/embedClient.ts`，实现embeddings的延迟初始化
3. 运行 `npm run build` 验证修复结果