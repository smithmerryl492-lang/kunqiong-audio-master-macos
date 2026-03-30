
import json
import os
import re

def has_cjk(text):
    return bool(re.search(r'[\u4e00-\u9fff]', text))

def flatten_dict(d, parent_key='', sep='.'):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def check_locales(directory, source_lang='zh-CN.json'):
    source_path = os.path.join(directory, source_lang)
    if not os.path.exists(source_path):
        print(f"Source file {source_path} not found.")
        return

    with open(source_path, 'r', encoding='utf-8') as f:
        source_data = json.load(f)
    
    source_keys_dict = flatten_dict(source_data)
    source_keys = set(source_keys_dict.keys())
    
    en_path = os.path.join(directory, 'en.json')
    en_keys_dict = {}
    if os.path.exists(en_path):
        with open(en_path, 'r', encoding='utf-8') as f:
            en_keys_dict = flatten_dict(json.load(f))
    
    files = [f for f in os.listdir(directory) if f.endswith('.json')]
    
    results = {}
    
    for filename in files:
        if filename == source_lang:
            continue
            
        file_path = os.path.join(directory, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            results[filename] = {"error": str(e)}
            continue
            
        flat_data = flatten_dict(data)
        current_keys = set(flat_data.keys())
        
        if len(current_keys) != len(source_keys):
             results[filename] = results.get(filename, {})
             results[filename]["key_count"] = {
                 "current": len(current_keys),
                 "source": len(source_keys)
             }
        
        missing_keys = source_keys - current_keys
        extra_keys = current_keys - source_keys
        
        if missing_keys:
            results[filename] = results.get(filename, {})
            results[filename]["missing"] = list(missing_keys)
            
        untranslated = []
        is_duplicate_of_en = True if filename != 'en.json' and en_keys_dict else False
        
        for k, v in flat_data.items():
            if k in source_keys:
                source_val = source_keys_dict[k]
                
                is_cjk_lang = filename in ['ja.json', 'ko.json', 'zh-TW.json']
                
                if not is_cjk_lang and has_cjk(v):
                    untranslated.append(k)
                elif is_cjk_lang and v == source_val:
                    if len(v) > 3:
                        untranslated.append(k)
                
                if is_duplicate_of_en and k in en_keys_dict:
                    if v != en_keys_dict[k]:
                        is_duplicate_of_en = False
        
        if is_duplicate_of_en:
             results[filename] = results.get(filename, {})
             results[filename]["duplicate_of_en"] = True
        
        if untranslated:
            results[filename] = results.get(filename, {})
            results[filename]["untranslated"] = {k: flat_data[k] for k in untranslated}
            
        empty_values = [k for k, v in flat_data.items() if not v]
        if empty_values:
            results[filename] = results.get(filename, {})
            results[filename]["empty"] = empty_values
            
    return results

if __name__ == "__main__":
    for loc_dir in ['backend/locales', 'electron/locales', 'src/locales']:
        print(f"\n--- Checking {loc_dir} ---")
        if not os.path.exists(loc_dir):
            print(f"Directory {loc_dir} not found.")
            continue
            
        results = check_locales(loc_dir)
        files = [f for f in os.listdir(loc_dir) if f.endswith('.json')]
        print(f"Checked {len(files)} files.")
        
        if not results:
            print(f"All {loc_dir} translations look good.")
        else:
            for lang, issues in results.items():
                print(f"Language: {lang}")
                if "key_count" in issues:
                    print(f"  Key count mismatch: current={issues['key_count']['current']}, source={issues['key_count']['source']}")
                if "missing" in issues:
                    print(f"  Missing keys ({len(issues['missing'])}): {issues['missing'][:5]}...")
                if "untranslated" in issues:
                    print(f"  Untranslated: {list(issues['untranslated'].keys())[:5]}...")
                if "duplicate_of_en" in issues:
                    print(f"  Warning: Entire file is a duplicate of en.json")
                if "empty" in issues:
                    print(f"  Empty values ({len(issues['empty'])}): {issues['empty'][:5]}...")
