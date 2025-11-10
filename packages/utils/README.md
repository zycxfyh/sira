# @sira/utils - 工具函数库

提供通用的工具函数，包括异步处理、数据验证、对象操作、字符串处理、时间日期和数组操作。

## 功能特性

- ⚡ **异步工具**: Promise处理、超时控制、重试机制
- ✅ **数据验证**: 类型检查、格式验证、对象验证
- 🔧 **对象操作**: 深度克隆、合并、展平、选择
- 📝 **字符串处理**: 格式转换、截断、HTML转义
- 📅 **时间日期**: 格式化、相对时间、时间计算
- 📊 **数组操作**: 分块、去重、洗牌、集合运算

## 安装使用

```javascript
const {
  AsyncUtils,
  ValidationUtils,
  ObjectUtils,
  StringUtils,
  DateUtils,
  ArrayUtils
} = require('@sira/utils');

// 异步重试
const result = await AsyncUtils.retry(
  () => fetchData(),
  { maxRetries: 3, delay: 1000 }
);

// 数据验证
const isValid = ValidationUtils.isEmail('user@example.com');

// 对象操作
const merged = ObjectUtils.deepMerge(obj1, obj2);
```

## API 接口

### AsyncUtils - 异步工具

#### `delay(ms)`
延迟执行。

```javascript
await AsyncUtils.delay(1000) // 延迟1秒
```

#### `retry(fn, options)`
重试函数执行。

```javascript
await AsyncUtils.retry(
  () => apiCall(),
  { maxRetries: 3, delay: 1000, backoff: 2 }
)
```

#### `timeout(promise, ms)`
为Promise添加超时。

```javascript
await AsyncUtils.timeout(fetchData(), 5000)
```

#### `parallelLimit(tasks, limit)`
限制并发数的并行执行。

```javascript
await AsyncUtils.parallelLimit(tasks, 5)
```

#### `batchProcess(items, batchSize, processor)`
批处理执行。

```javascript
await AsyncUtils.batchProcess(items, 10, processBatch)
```

### ValidationUtils - 数据验证

#### `isEmpty(value)`
检查是否为空。

```javascript
ValidationUtils.isEmpty('') // true
ValidationUtils.isEmpty([]) // true
```

#### `isEmail(email)`
邮箱格式验证。

```javascript
ValidationUtils.isEmail('user@example.com') // true
```

#### `isUrl(url)`
URL格式验证。

```javascript
ValidationUtils.isUrl('https://example.com') // true
```

#### `validateObject(obj, schema)`
深度对象验证。

```javascript
const result = ValidationUtils.validateObject(data, {
  name: { required: true, type: 'string', minLength: 2 },
  email: { required: true, custom: ValidationUtils.isEmail }
})
```

### ObjectUtils - 对象操作

#### `deepClone(obj)`
深度克隆对象。

```javascript
const copy = ObjectUtils.deepClone(original)
```

#### `deepMerge(target, source)`
深度合并对象。

```javascript
const merged = ObjectUtils.deepMerge(target, source)
```

#### `flatten(obj, prefix)`
对象展平。

```javascript
ObjectUtils.flatten({ a: { b: 1 } }) // { 'a.b': 1 }
```

#### `unflatten(obj)`
对象展开。

```javascript
ObjectUtils.unflatten({ 'a.b': 1 }) // { a: { b: 1 } }
```

#### `pick(obj, keys)`
选择对象属性。

```javascript
ObjectUtils.pick(obj, ['name', 'email'])
```

#### `omit(obj, keys)`
排除对象属性。

```javascript
ObjectUtils.omit(obj, ['password', 'secret'])
```

### StringUtils - 字符串处理

#### `camelToSnake(str)`
驼峰转下划线。

```javascript
StringUtils.camelToSnake('userName') // 'user_name'
```

#### `snakeToCamel(str)`
下划线转驼峰。

```javascript
StringUtils.snakeToCamel('user_name') // 'userName'
```

#### `capitalize(str)`
首字母大写。

```javascript
StringUtils.capitalize('hello') // 'Hello'
```

#### `truncate(str, length, suffix)`
字符串截断。

```javascript
StringUtils.truncate('long text', 10) // 'long text...'
```

#### `stripHtml(html)`
移除HTML标签。

```javascript
StringUtils.stripHtml('<p>Hello</p>') // 'Hello'
```

### DateUtils - 时间日期

#### `format(date, format)`
格式化日期。

```javascript
DateUtils.format(new Date(), 'YYYY-MM-DD HH:mm:ss')
```

#### `parseRelativeTime(str)`
解析相对时间。

```javascript
DateUtils.parseRelativeTime('5m') // 300000 (5分钟的毫秒数)
```

#### `getTimeDiff(date1, date2)`
计算时间差。

```javascript
DateUtils.getTimeDiff(date1, date2)
// { days: 1, hours: 2, minutes: 30, seconds: 45 }
```

#### `addTime(date, amount, unit)`
添加时间。

```javascript
DateUtils.addTime(date, 1, 'days') // 加1天
```

### ArrayUtils - 数组操作

#### `chunk(array, size)`
数组分块。

```javascript
ArrayUtils.chunk([1,2,3,4,5], 2) // [[1,2], [3,4], [5]]
```

#### `unique(array, keyFn)`
数组去重。

```javascript
ArrayUtils.unique([1,2,2,3]) // [1,2,3]
ArrayUtils.unique(objects, obj => obj.id)
```

#### `shuffle(array)`
数组洗牌。

```javascript
ArrayUtils.shuffle([1,2,3,4,5]) // [3,1,5,2,4] (随机)
```

#### `sample(array, count)`
随机采样。

```javascript
ArrayUtils.sample([1,2,3,4,5], 2) // [3,1]
```

#### `difference(array1, array2)`
差集。

```javascript
ArrayUtils.difference([1,2,3], [2,3,4]) // [1]
```

#### `intersection(array1, array2)`
交集。

```javascript
ArrayUtils.intersection([1,2,3], [2,3,4]) // [2,3]
```

#### `union(...arrays)`
并集。

```javascript
ArrayUtils.union([1,2], [2,3], [3,4]) // [1,2,3,4]
```

## 示例

```javascript
const { AsyncUtils, ValidationUtils, ObjectUtils } = require('@sira/utils');

// API调用重试
async function robustApiCall() {
  return await AsyncUtils.retry(
    () => fetch('/api/data'),
    {
      maxRetries: 3,
      delay: 1000,
      shouldRetry: (error) => error.status >= 500
    }
  );
}

// 数据验证和处理
function processUserData(rawData) {
  // 验证数据
  const validation = ValidationUtils.validateObject(rawData, {
    name: { required: true, type: 'string', minLength: 2 },
    email: { required: true, custom: ValidationUtils.isEmail },
    age: { type: 'number', min: 0, max: 150 }
  });

  if (!validation.isValid) {
    throw new Error('Invalid data: ' + validation.errors.join(', '));
  }

  // 清理敏感数据
  return ObjectUtils.omit(rawData, ['password', 'ssn']);
}

// 批量处理
async function processLargeDataset(items) {
  return await AsyncUtils.batchProcess(
    items,
    100, // 每批100个
    async (batch) => {
      // 处理一批数据
      return await Promise.all(batch.map(processItem));
    }
  );
}
```

## 性能考虑

- `deepClone`和`deepMerge`对大型对象可能影响性能
- `flatten`/`unflatten`适用于配置对象，不适合大数据
- 异步工具函数都支持取消和超时控制
- 验证函数优先性能，错误信息详细且有用
