// Mock implementation of jsonrepair for testing
export function jsonrepair(jsonString: string): string {
  // Simple but effective JSON repair for testing
  try {
    // First try to parse as-is
    JSON.parse(jsonString);
    return jsonString;
  } catch {
    // Apply common repairs
    let repaired = jsonString;

    // Remove trailing commas before closing braces/brackets
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

    // Remove JavaScript-style comments
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments
    repaired = repaired.replace(/\/\/.*$/gm, ''); // Single-line comments

    // Try to parse the repaired version
    try {
      JSON.parse(repaired.trim());
      return repaired.trim();
    } catch {
      // If repair fails, return the original (will be handled by next strategy)
      return jsonString;
    }
  }
}

export default { jsonrepair };
