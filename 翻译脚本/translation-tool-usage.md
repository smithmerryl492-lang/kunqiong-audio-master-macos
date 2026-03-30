# 翻译脚本使用指南（通用于其他项目）

本文档介绍如何将本仓库中的翻译工具独立用于其他软件项目，包括 JSON 语言包与 Java `.properties` 文件两类常见场景。

## 组件说明
- translate_locales.py  
  - 输入：嵌套 JSON（叶子必须是字符串）  
  - 输出：按 `<lang>.json` 生成目标语言文件  
  - 接口：OpenAI 兼容 Chat Completions（已默认适配豆包 Ark）  
  - 特性：分块、并发、占位符保护（`{{name}}`）、失败回退、`--self-test`
- props_translate.py  
  - 输入：Java ResourceBundle 格式 `messages_en.properties`  
  - 过程：自动转 JSON → 调用 translate_locales.py 翻译 → 还原为 `.properties`  
  - 输出：`messages_<lang>.properties`

## 环境要求
- Python 3.x（仅用标准库）
- 可访问 OpenAI 兼容接口的网络环境
- 一个有效的 API Key（示例使用豆包 Ark）

## 凭证与默认值
优先读取环境变量（推荐）：
- 基础地址：`LLM_BASE_URL`（其次 `ARK_BASE_URL`，缺省 `https://ark.cn-beijing.volces.com/api/v3`）
- 模型/端点：`LLM_MODEL`（其次 `ARK_MODEL` 或 `ARK_ENDPOINT_ID`）
- API Key：`LLM_API_KEY`（其次 `ARK_API_KEY` 或 `OPENAI_API_KEY`）

示例（Windows PowerShell）：
```
$env:LLM_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
$env:LLM_MODEL="ep-xxxxxxxxxxxxxxxx"
$env:LLM_API_KEY="YOUR_API_KEY"
```

也可直接用命令行参数覆盖（见下文）。

## 一、JSON 项目（如前端 i18n）
1) 准备英文母本：`en.json`（允许嵌套，仅字符串为叶子）
2) 执行翻译：
```
python ".\translate_locales.py" ^
  --source "D:\yourproj\i18n\en.json" ^
  --output-dir "D:\yourproj\i18n\locales" ^
  --langs "zh_CN,ja,fr,de" ^
  --concurrency 3 ^
  --chunk-size 200
```
3) 产物：在 `--output-dir` 下生成 `zh_CN.json`、`ja.json` 等
4) 自测连通性（可选）：
```
python ".\translate_locales.py" --self-test
```

常用参数：
- `--source`：源 JSON 路径
- `--output-dir`：输出目录（文件名为 `<lang>.json`）
- `--langs`：目标语言列表，逗号分隔（如 `zh_CN,ja,fr`）
- `--base-url`/`--model`/`--api-key`：如不使用环境变量需显式传入
- `--chunk-size`：每次请求包含的键数（默认 220）
- `--concurrency`：并发语言数（默认 3）
- `--retries`/`--retry-backoff-sec`/`--timeout-sec`：重试与超时控制
- `--force`：覆盖已存在文件

占位符与校验：
- 默认保护 `{{name}}`/`{{ count }}` 等双大括号占位符，译文与原文必须严格一致，否则回退或报错
- 模型若返回结构异常，会自动降级为“按顺序数组”策略并逐项验证

## 二、Java `.properties` 项目
1) 准备英文母本：`messages_en.properties`（键使用点号层级）  
2) 执行翻译并落地：
```
python ".\props_translate.py" ^
  --source-props ".\src\main\resources\i18n\messages_en.properties" ^
  --output-dir    ".\src\main\resources\i18n" ^
  --langs "ja,fr,de,es,zh_TW" ^
  --force
```
3) 产物：在 `--output-dir` 下生成 `messages_<lang>.properties`
4) Java 接入：`ResourceBundle.getBundle("i18n.messages", locale)` 自动按 `messages_*.properties` 加载

注意：
- `.properties` 将 `key=value` 转换为扁平 JSON 再翻译，适合 UI 文案键值对场景
- 请保持键名稳定；脚本会要求译文与源键数量/键名一致

## 与常见框架集成（示例）
React（i18next）：
```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, 'zh-CN': { translation: zhCN } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

Vue 3（vue-i18n）：
```ts
import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en, 'zh-CN': zhCN } });
```

Java（ResourceBundle）：
```java
ResourceBundle bundle = ResourceBundle.getBundle("i18n.messages", Locale.forLanguageTag("fr"));
String title = bundle.getString("app.title");
```

## 最佳实践
- 术语一致性：相同产品名/品牌名请固定表达，可在英文母本中写清楚语境；后续可扩展“冻结词”保护。
- 分块与并发：一般 `chunk-size` 150–300，`concurrency` 2–4；遇到 429/限流建议降低并发并上调重试/退避。
- 语言代码：优先使用 BCP‑47（如 `zh-CN`、`pt-BR`）；`.properties` 文件使用下划线（`zh_CN`、`pt_BR`）更常见，脚本已兼容。
- 占位符：使用 `{{name}}` 风格以获得最稳妥的占位符保护；换行符 `\n` 会被保留。

## 常见问题
- 报 “Missing API key”：设置 `LLM_API_KEY` 或传 `--api-key`
- 报 “Only string leaf values are supported”：源 JSON 存在非字符串叶子，请先清理结构
- 报 “Placeholder mismatch” 或 “Translated key count mismatch”：减小 `--chunk-size` 或降低并发；必要时重复运行
- 429/限流：降低 `--concurrency`；上调 `--retries` 与 `--retry-backoff-sec`
- 连通性诊断：`python translate_locales.py --self-test`（返回 `ok` 表示接口正常）

## 安全提示
- 不要把真实 API Key 写入仓库或脚本；建议通过环境变量或 CI 密钥管理器传入
- 避免在日志中打印完整的请求与凭证

## 许可与复用
- 脚本与文档可在你的其他项目中直接复用；如需二次封装（例如接入 CI、定期增量翻译、术语表保护），可在此基础上扩展。

