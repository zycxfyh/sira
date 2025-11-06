// 文件路径: packages/common--backend/src/exceptions/rule-engine-exception.ts

export class RuleEngineExecutionException extends Error {
  // [核心修复] 将 details 的类型从 any 修正为 Record<string, unknown>
  // 这意味着我们期望 details 是一个对象，但我们不关心它内部具体的属性是什么。
  // 这比 any 更安全，因为它阻止了我们对 details 属性进行不安全的直接访问。
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RuleEngineExecutionException";
  }
}
