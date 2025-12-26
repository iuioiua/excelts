# ExcelTS

[![Build Status](https://github.com/cjnoname/excelts/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/cjnoname/excelts/actions/workflows/ci.yml)

现代化的 TypeScript Excel 工作簿管理器 - 读取、操作和写入电子表格数据和样式到 XLSX 和 JSON。

## 关于本项目

ExcelTS 是 [ExcelJS](https://github.com/exceljs/exceljs) 的现代化版本，具有以下特性:

- 🚀 **零运行时依赖** - 纯 TypeScript 实现，无任何外部包依赖
- ✅ **完整的 TypeScript 支持** - 完整的类型定义和现代 TypeScript 模式
- ✅ **现代构建系统** - 使用 Rolldown 进行更快的构建
- ✅ **增强的测试** - 迁移到 Vitest 并支持浏览器测试
- ✅ **ESM 优先** - 原生 ES Module 支持，兼容 CommonJS
- ✅ **Node 20+** - 针对现代 Node.js 版本优化
- ✅ **命名导出** - 所有导出都是命名导出，更好的 tree-shaking
- ✅ **广泛浏览器支持** - 支持 Chrome 85+、Firefox 79+、Safari 14+，内置兼容方案

## 翻译

- [English Documentation](README.md)

## 安装

````bash
npm install @cj-tech-master/excelts

## 快速开始

### 创建工作簿

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();
const sheet = workbook.addWorksheet("我的工作表");

// 添加数据
sheet.addRow(["姓名", "年龄", "邮箱"]);
sheet.addRow(["张三", 30, "zhang@example.com"]);
sheet.addRow(["李四", 25, "li@example.com"]);

// 保存文件
await workbook.xlsx.writeFile("output.xlsx");
````

### 读取工作簿

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();
await workbook.xlsx.readFile("input.xlsx");

const worksheet = workbook.getWorksheet(1);
worksheet.eachRow((row, rowNumber) => {
  console.log("第 " + rowNumber + " 行 = " + JSON.stringify(row.values));
});
```

### 单元格样式

```javascript
// 设置单元格值和样式
const cell = worksheet.getCell("A1");
cell.value = "你好";
cell.font = {
  name: "Arial",
  size: 16,
  bold: true,
  color: { argb: "FFFF0000" }
};
cell.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" }
};
```

## 功能特性

- **Excel 操作**
  - 创建、读取和修改 XLSX 文件
  - 多工作表支持
  - 单元格样式（字体、颜色、边框、填充）
  - 单元格合并和格式化
  - 行和列属性
  - 冻结窗格和拆分视图

- **数据处理**
  - 富文本支持
  - 公式和计算值
  - 数据验证
  - 条件格式
  - 图片和图表
  - 超链接
  - 数据透视表

- **高级功能**
  - 大文件流式处理
  - CSV 导入/导出
  - 带自动筛选的表格
  - 页面设置和打印选项
  - 数据保护
  - 注释和批注

## 流式 API（Node.js）

处理大型 Excel 文件时无需将整个文件加载到内存中，ExcelTS 提供了流式读写 API。

### 流式读取器

以最小内存占用读取大型 XLSX 文件：

```javascript
import { WorkbookReader } from "@cj-tech-master/excelts";

// 从文件路径读取
const reader = new WorkbookReader("large-file.xlsx", {
  worksheets: "emit", // 触发工作表事件
  sharedStrings: "cache", // 缓存共享字符串以获取单元格值
  hyperlinks: "ignore", // 忽略超链接
  styles: "ignore" // 忽略样式以加快解析
});

for await (const worksheet of reader) {
  console.log(`正在读取: ${worksheet.name}`);
  for await (const row of worksheet) {
    console.log(row.values);
  }
}
```

### 流式写入器

逐行写入大型 XLSX 文件：

```javascript
import { WorkbookWriter } from "@cj-tech-master/excelts";

const workbook = new WorkbookWriter({
  filename: "output.xlsx",
  useSharedStrings: true,
  useStyles: true
});

const sheet = workbook.addWorksheet("Data");

// 逐行写入
for (let i = 0; i < 1000000; i++) {
  sheet.addRow([`第 ${i} 行`, i, new Date()]).commit();
}

// 提交工作表并完成
sheet.commit();
await workbook.commit();
```

## CSV 支持

### Node.js（完整流式支持）

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();

// 从文件读取 CSV（流式）
await workbook.csv.readFile("data.csv");

// 从流读取 CSV
import fs from "fs";
const stream = fs.createReadStream("data.csv");
await workbook.csv.read(stream, { sheetName: "Imported" });

// 写入 CSV 到文件（流式）
await workbook.csv.writeFile("output.csv");

// 写入 CSV 到流
const writeStream = fs.createWriteStream("output.csv");
await workbook.csv.write(writeStream);

// 写入 CSV 到 buffer
const buffer = await workbook.csv.writeBuffer();
```

### 浏览器（内存中）

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();

// 从字符串加载 CSV
workbook.csv.load(csvString);

// 从 ArrayBuffer 加载 CSV（例如从 fetch 或文件输入）
const response = await fetch("data.csv");
const arrayBuffer = await response.arrayBuffer();
workbook.csv.load(arrayBuffer);

// 写入 CSV 为字符串
const csvOutput = workbook.csv.writeString();

// 写入 CSV 为 Uint8Array buffer
const buffer = workbook.csv.writeBuffer();
```

## 浏览器支持

ExcelTS 原生支持浏览器环境，现代打包工具**无需任何配置**。

### 在打包工具中使用（Vite, Webpack, Rollup, esbuild）

直接导入 ExcelTS - 无需 polyfills 或额外配置：

```javascript
import { Workbook } from "@cj-tech-master/excelts";

const workbook = new Workbook();
const sheet = workbook.addWorksheet("Sheet1");
sheet.getCell("A1").value = "你好，浏览器！";

// 写入 buffer 并下载
const buffer = await workbook.xlsx.writeBuffer();
const blob = new Blob([buffer], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
});
const url = URL.createObjectURL(blob);
// ... 触发下载
```

### 使用 Script 标签（无打包工具）

```html
<script src="https://unpkg.com/@cj-tech-master/excelts/dist/browser/excelts.iife.min.js"></script>
<script>
  const { Workbook } = ExcelTS;
  const wb = new Workbook();
  // ... 使用 workbook API
</script>
```

### 浏览器版本注意事项

- **支持 CSV 操作**（使用原生 RFC 4180 标准实现）
  - 使用 `csv.load(stringOrArrayBuffer)` 读取 CSV
  - 使用 `csv.writeString()` 或 `csv.writeBuffer()` 写入 CSV
- 使用 `xlsx.load(arrayBuffer)` 代替 `xlsx.readFile()`
- 使用 `xlsx.writeBuffer()` 代替 `xlsx.writeFile()`
- 完全支持带密码的工作表保护（纯 JS SHA-512 实现）

## 系统要求

### Node.js

- **Node.js >= 20.0.0**（原生支持 ES2020）

### 浏览器（无需 Polyfills）

- **Chrome >= 85**（2020年8月）
- **Edge >= 85**（2020年8月）
- **Firefox >= 79**（2020年7月）
- **Safari >= 14**（2020年9月）
- **Opera >= 71**（2020年9月）

对于不支持原生 `CompressionStream` API 的旧浏览器（Firefox < 113, Safari < 16.4），ExcelTS 会自动使用内置的纯 JavaScript DEFLATE 实现 - 无需任何配置或 polyfills。

## 维护者

本项目由 [CJ (@cjnoname)](https://github.com/cjnoname) 积极维护。

### 维护状态

**积极维护中** - 本项目处于积极维护状态，重点关注：

- 🔒 **安全更新** - 及时的安全补丁和依赖项更新
- 🐛 **Bug 修复** - 关键 Bug 修复和稳定性改进
- 📦 **依赖管理** - 保持依赖项最新且安全
- 🔍 **代码审查** - 审查和合并社区贡献

### 贡献

虽然我可能没有足够的时间定期开发新功能，但**非常重视和欢迎社区贡献！**

- 💡 **欢迎 Pull Request** - 我会及时审查并合并高质量的 PR
- 🚀 **功能提议** - 在实现前请先开 issue 讨论新功能
- 🐛 **Bug 报告** - 请提供可重现的示例报告 Bug
- 📖 **文档改进** - 始终欢迎文档改进

## API 文档

详细的 API 文档，请参考以下综合文档部分：

- 工作簿管理
- 工作表
- 单元格和值
- 样式
- 公式
- 数据验证
- 条件格式
- 文件输入输出

API 与原始 ExcelJS 保持高度兼容。

## 贡献指南

欢迎贡献！请随时提交 Pull Request。

### 提交 PR 前

1. **Bug 修复**：在 `src/__test__` 文件夹中添加能重现问题的单元测试或集成测试
2. **新功能**：先开 issue 讨论功能和实现方案
3. **文档**：更新相关文档和类型定义
4. **代码风格**：遵循现有代码风格并通过所有代码检查（`npm run lint`）
5. **测试**：确保所有测试通过（`npm test`）并为新功能添加测试

### 重要说明

- **版本号**：请不要在 PR 中修改 package 版本。版本通过发布管理。
- **许可证**：所有贡献都将包含在项目的 MIT 许可证下
- **提交信息**：编写清晰、描述性的提交信息

### 获取帮助

如果需要帮助或有疑问：

- 📖 查看现有的 [issues](https://github.com/cjnoname/excelts/issues) 和[文档](https://github.com/cjnoname/excelts)
- 💬 开一个[新 issue](https://github.com/cjnoname/excelts/issues/new) 讨论
- 🐛 使用 issue 模板报告 Bug

## 许可证

MIT License

基于 [ExcelJS](https://github.com/exceljs/exceljs) 由 [Guyon Roche](https://github.com/guyonroche) 创建

## 致谢

本项目是 ExcelJS 的现代化分支。原始实现的所有功劳归于：

- **Guyon Roche** - ExcelJS 原作者
- 所有 [ExcelJS 贡献者](https://github.com/exceljs/exceljs/graphs/contributors)

## 链接

- [GitHub 仓库](https://github.com/cjnoname/excelts)
- [原始 ExcelJS](https://github.com/exceljs/exceljs)
- [问题跟踪](https://github.com/cjnoname/excelts/issues)

## 更新日志

详细版本历史请查看 [CHANGELOG.md](CHANGELOG.md)。
