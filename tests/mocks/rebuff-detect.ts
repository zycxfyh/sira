// Mock implementation of Rebuff detect for testing
export const detect = async (
  input: string,
): Promise<{
  injectionDetected: boolean;
  explanation?: string;
}> => {
  // Mock implementation - always return no injection detected for tests
  return {
    injectionDetected: false,
  };
};

export default detect;
