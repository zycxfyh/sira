// Type declarations for jsonrepair module
// Since jsonrepair doesn't have official TypeScript definitions,
// we provide our own based on the package documentation

declare module 'jsonrepair' {
  /**
   * Repairs malformed JSON strings
   * @param jsonString - The malformed JSON string to repair
   * @returns The repaired JSON string
   * @throws Error if the JSON cannot be repaired
   */
  export function jsonrepair(jsonString: string): string;

  /**
   * Default export for the jsonrepair function
   */
  export default function jsonrepair(jsonString: string): string;
}
