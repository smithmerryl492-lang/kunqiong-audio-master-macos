import zhCN from '../locales/zh-CN.json';
import zhTW from '../locales/zh-TW.json';
import en from '../locales/en.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import ar from '../locales/ar.json';
import bn from '../locales/bn.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import fa from '../locales/fa.json';
import fr from '../locales/fr.json';
import he from '../locales/he.json';
import hi from '../locales/hi.json';
import id from '../locales/id.json';
import it from '../locales/it.json';
import ms from '../locales/ms.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import ptBR from '../locales/pt-BR.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';
import sw from '../locales/sw.json';
import ta from '../locales/ta.json';
import th from '../locales/th.json';
import tl from '../locales/tl.json';
import tr from '../locales/tr.json';
import uk from '../locales/uk.json';
import ur from '../locales/ur.json';
import vi from '../locales/vi.json';

const locales: Record<string, any> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en': en,
  'ja': ja,
  'ko': ko,
  'ar': ar,
  'bn': bn,
  'de': de,
  'es': es,
  'fa': fa,
  'fr': fr,
  'he': he,
  'hi': hi,
  'id': id,
  'it': it,
  'ms': ms,
  'nl': nl,
  'pl': pl,
  'pt-BR': ptBR,
  'pt': pt,
  'ru': ru,
  'sw': sw,
  'ta': ta,
  'th': th,
  'tl': tl,
  'tr': tr,
  'uk': uk,
  'ur': ur,
  'vi': vi,
};

export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'th', name: 'ไทย' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'ur', name: 'اردو' },
  { code: 'ar', name: 'العربية' },
  { code: 'he', name: 'עברית' },
  { code: 'fa', name: 'فارسی' },
  { code: 'uk', name: 'Українська' },
  { code: 'sw', name: 'Kiswahili' },
  { code: 'tl', name: 'Tagalog' },
];

let currentLocaleCode = localStorage.getItem('app_language') || 'zh-CN';
let currentLocale = locales[currentLocaleCode] || zhCN;

/**
 * 设置当前语言
 * @param code 语言代码
 */
export const setLocale = (code: string) => {
  if (locales[code]) {
    currentLocaleCode = code;
    currentLocale = locales[code];
    localStorage.setItem('app_language', code);
    // 触发全局重绘，这里简单处理，实际项目中建议使用 Context 或状态管理
    window.dispatchEvent(new Event('languageChange'));
  }
};

/**
 * 获取当前语言代码
 */
export const getCurrentLocale = () => currentLocaleCode;

/**
 * 翻译函数
 * @param path 翻译路径，例如 'header.login'
 * @param params 替换参数
 * @returns 翻译后的字符串
 */
export const t = (path: string, params?: Record<string, string | number>): string => {
  const keys = path.split('.');
  let result: any = currentLocale;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      // 如果当前语言找不到，尝试从简体中文找
      let fallback: any = zhCN;
      for (const fkey of keys) {
        if (fallback && typeof fallback === 'object' && fkey in fallback) {
          fallback = fallback[fkey];
        } else {
          fallback = path;
          break;
        }
      }
      return typeof fallback === 'string' ? fallback : path;
    }
  }

  if (typeof result !== 'string') {
    return path;
  }

  // 处理参数替换
  if (params) {
    let finalString = result;
    Object.entries(params).forEach(([key, value]) => {
      finalString = finalString.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    });
    return finalString;
  }

  return result;
};

export default t;
