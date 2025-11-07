import { cleanAndParseJson, JsonSanitizationError } from './json-cleaner';

describe('cleanAndParseJson', () => {
  it('should remove markdown code fences', async () => {
    const raw = '```json\n{\n  "message": "hello"\n}\n```';
    const result = await cleanAndParseJson(raw) as { message: string };
    expect(result).toEqual({ message: 'hello' });
  });

  it('should repair trailing commas', async () => {
    const raw = '{"items": [1, 2, 3,],}';
    const result = await cleanAndParseJson(raw) as { items: number[] };
    expect(result.items).toEqual([1, 2, 3]);
  });

  it('should handle single quotes JSON', async () => {
    const raw = "{'status': 'ok', 'count': 2}";
    const result = await cleanAndParseJson(raw) as { status: string; count: number };
    expect(result).toEqual({ status: 'ok', count: 2 });
  });

  it('should extract JSON from surrounding text', async () => {
    const raw =
      'Here is the result you asked for: {"success": true, "data": {"value": 42}} Cheers!';
    const result = await cleanAndParseJson(raw) as {
      success: boolean;
      data: { value: number };
    };
    expect(result).toEqual({ success: true, data: { value: 42 } });
  });

  it('should repair json with comments', async () => {
    const raw = `{
      // comment line
      "name": "Aria",
      /* block comment */
      "level": 5,
    }`;
    const result = await cleanAndParseJson(raw) as { name: string; level: number };
    expect(result).toEqual({ name: 'Aria', level: 5 });
  });

  it('should throw JsonSanitizationError when repair fails', async () => {
    const raw = 'not-json-at-all';
    await expect(cleanAndParseJson(raw)).rejects.toThrow(JsonSanitizationError);
  });
});
