// Mock implementation of jsonrepair for testing
export function jsonrepair(jsonString: string): string {
  console.log('jsonrepair called with:', JSON.stringify(jsonString));
  // Simple but effective JSON repair for testing
  try {
    // First try to parse as-is
    JSON.parse(jsonString);
    console.log('jsonrepair returning original (already valid):', JSON.stringify(jsonString));
    return jsonString;
  } catch {
    // Apply common repairs
    let repaired = jsonString;

    // Remove trailing commas in arrays first
    repaired = repaired.replace(/,(\s*)\]/g, ']');
    // Then remove trailing commas in objects
    repaired = repaired.replace(/,(\s*)\}/g, '}');

    // Remove JavaScript-style comments
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments
    repaired = repaired.replace(/\/\/.*$/gm, ''); // Single-line comments

    // Try to parse the repaired version
    try {
      JSON.parse(repaired.trim());
      console.log('jsonrepair returning repaired:', JSON.stringify(repaired.trim()));
      return repaired.trim();
    } catch (repairError) {
      console.log(
        `jsonrepair failed to repair: ${JSON.stringify(jsonString)} -> ${JSON.stringify(repaired)}, error:`,
        repairError,
      );
      // If repair fails, return the original (will be handled by next strategy)
      return jsonString;
    }
  }
}

export { jsonrepair };
export default { jsonrepair };
