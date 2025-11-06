# Changesets

本仓库使用 [Changesets](https://github.com/changesets/changesets) 来管理版本和生成变更日志。

## 如何添加变更集

当您创建或修改功能时，请添加一个变更集来描述您的更改：

```bash
pnpm changeset
```

这将引导您：
1. 选择受影响的包
2. 选择变更类型（major, minor, patch）
3. 描述变更内容

## 变更类型

- **major**: 破坏性变更（不兼容的 API 变更）
- **minor**: 新功能（向后兼容）
- **patch**: Bug 修复（向后兼容）

## 发布流程

1. 合并包含变更集的 PR
2. 运行 `pnpm changeset version` 更新版本号
3. 运行 `pnpm changeset publish` 发布包

## 示例变更集

```markdown
---
"@tuheg/common-backend": patch
---

修复 AI Provider 工厂的类型错误
```

