import json
import os

# 获取当前文件所在目录
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
# JSON 文件路径
LOCALE_PATH = os.path.join(os.path.dirname(CURRENT_DIR), "locales", "zh-CN.json")

_translations = {}

def load_translations():
    global _translations
    try:
        with open(LOCALE_PATH, "r", encoding="utf-8") as f:
            _translations = json.load(f)
    except Exception as e:
        print(f"Failed to load translations: {e}")
        _translations = {}

def t(path: str, **kwargs) -> str:
    if not _translations:
        load_translations()
    
    keys = path.split('.')
    result = _translations
    
    for key in keys:
        if isinstance(result, dict) and key in result:
            result = result[key]
        else:
            return path
            
    if not isinstance(result, str):
        return path
        
    if kwargs:
        try:
            return result.format(**kwargs)
        except KeyError:
            return result
            
    return result

# 初始加载
load_translations()
