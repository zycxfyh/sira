// Mock implementation of langfuse-core for testing
export class LangfuseCore {
  constructor(options?: any) {
    // Mock constructor
  }

  // Mock methods that might be called via dynamic import
  async dynamicImport() {
    return Promise.resolve({});
  }

  // Add other methods as needed
}

export class LangfuseWebStateless {
  constructor(options?: any) {
    // Mock constructor
  }

  // Mock methods
  authCheck() {
    return Promise.resolve({ valid: true });
  }
}

export class LangfuseTraceClient {
  constructor(options?: any) {
    // Mock constructor
  }

  end() {
    return this;
  }
}

export class LangfuseSpanClient {
  constructor(options?: any) {
    // Mock constructor
  }

  end() {
    return this;
  }
}

export class LangfuseGenerationClient {
  constructor(options?: any) {
    // Mock constructor
  }

  end() {
    return this;
  }
}

export class LangfusePromptClient {
  constructor(options?: any) {
    // Mock constructor
  }
}

export class ChatPromptClient {
  constructor(options?: any) {
    // Mock constructor
  }
}

export class TextPromptClient {
  constructor(options?: any) {
    // Mock constructor
  }
}

export class LangfuseEventClient {
  constructor(options?: any) {
    // Mock constructor
  }
}

export class LangfuseMedia {
  constructor(options?: any) {
    // Mock constructor
  }
}

export class LangfusePromptRecord {
  constructor(options?: any) {
    // Mock constructor
  }
}

// Type definitions
export type LangfuseCoreOptions = any;
export type LangfusePersistedProperty = any;
export type LangfuseFetchOptions = any;
export type LangfuseFetchResponse = any;
export type CreateLangfuseTraceBody = any;
export type CreateLangfuseGenerationBody = any;

export default LangfuseCore;
