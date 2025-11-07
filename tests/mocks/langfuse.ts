// Mock implementation of Langfuse for testing
export class Langfuse {
  constructor(options?: any) {
    // Mock constructor
  }

  trace(options: any) {
    return {
      generation: (options: any) => ({
        end: () => ({
          // Mock trace object
        }),
      }),
      span: (options: any) => ({
        end: () => ({
          // Mock span object
        }),
      }),
      end: () => ({
        // Mock trace end
      }),
    };
  }

  shutdown() {
    // Mock shutdown
    return Promise.resolve();
  }

  // Mock other methods as needed
  authWithApiKey() {
    return this;
  }

  getDataset() {
    return Promise.resolve({
      items: [],
      meta: { totalItems: 0, totalPages: 0, page: 1 },
    });
  }

  createDataset() {
    return Promise.resolve({
      id: 'mock-dataset-id',
      name: 'mock-dataset',
    });
  }

  createDatasetItem() {
    return Promise.resolve({
      id: 'mock-dataset-item-id',
      input: 'mock-input',
      expectedOutput: 'mock-output',
    });
  }
}

export default Langfuse;
