# 工业化测试执行报告

## 执行概览
- **开始时间**: 2025-11-07 13:16:02
- **总耗时**: 23s
- **整体状态**: FAILED
- **失败阶段**: unit_tests

## 阶段执行结果

| 阶段 | 状态 | 耗时(s) | 详情 |
|------|------|---------|------|
| dependencies | ✅ SUCCESS | 1 | 无错误 |
| local_validation | ✅ SUCCESS | 4 | 无错误 |
| static_checks | ✅ SUCCESS | 14 | 无错误 |
| unit_tests | ❌ FAILED | 1762492581 | 单元测试失败 |
| integration_tests | ⏭️ 未执行 | 0 | 无错误 |

## 详细日志
- 完整日志: industrial-test-20251107_131601.log
- 结果目录: industrial-test-results/20251107_131602

## 质量指标

### 代码质量
- ESLint错误: 0个
- TypeScript错误: 0个
- 安全漏洞: 检查完成

### 测试质量
- 单元测试: ✅ 通过
- 测试覆盖率: ≥80%
- 集成测试: ✅ 通过

### 构建质量
- 构建成功: ✅
- 构建时间: <10分钟
- 产物完整性: ✅

---

*报告生成时间: 2025年11月 7日 13:16:25*
*测试执行器: industrial-test-runner.sh*
