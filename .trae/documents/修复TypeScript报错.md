## 修复npm run lint报错计划

### 问题分析

lint报错主要分为四类：

1. **@typescript-eslint/no-explicit-any** (20个错误)：禁止使用`any`类型
2. **@next/next/no-html-link-for-pages** (6个错误)：禁止使用`<a>`标签导航到内部页面
3. **@next/next/no-img-element** (1个警告)：建议使用`<Image />`组件替代`<img>`标签
4. **@typescript-eslint/no-unused-vars** (2个警告)：存在未使用的变量

### 修复方案

#### 1. 修复@typescript-eslint/no-explicit-any错误

**文件**：所有API路由文件和组件文件

**修复内容**：

* 将`any`类型替换为更具体的类型

* 对于API响应，使用`unknown`类型并添加类型检查

* 对于上下文类型，使用具体的接口定义

#### 2. 修复@next/next/no-html-link-for-pages错误

**文件**：

* `src/app/documents/[id]/page.tsx`

* `src/app/documents/page.tsx`

* `src/app/page.tsx`

* `src/app/runs/[id]/page.tsx`

* `src/app/runs/page.tsx`

**修复内容**：

* 导入`next/link`的`Link`组件

* 将`<a>`标签替换为`<Link>`组件

* 保持原有的href和其他属性

#### 3. 修复@next/next/no-img-element警告

**文件**：`src/components/MarkdownRenderer.tsx`

**修复内容**：

* 这是警告，不影响构建，选择忽略（保持原有功能）

#### 4. 修复@typescript-eslint/no-unused-vars警告

**文件**：

* `src/components/MarkdownRenderer.tsx`

* `src/store/chatStore.ts`

**修复内容**：

* 删除未使用的变量`props`

* 对于未使用的参数`e`，在变量名前加下划线`_e`表示有意忽略

### 修复后的效果

* 所有lint错误将被解决

* 代码将符合ESLint规则

* 应用可以正常构建和运行

* 不影响现有功能

### 实施步骤

1. 修改所有API路由文件，替换`any`类型
2. 修改所有页面文件，替换`<a>`标签为`<Link>`组件
3. 修复组件和store中的未使用变量
4. 运行`npm run lint`验证修复结果

