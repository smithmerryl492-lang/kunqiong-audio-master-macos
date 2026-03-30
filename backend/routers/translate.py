from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
import os
os.environ["translators_default_region"] = "CN"
import translators as ts
from pathlib import Path

router = APIRouter()

# 语言代码映射
LANG_MAP = {
    "中文": "zh",
    "英语": "en",
    "日语": "ja",
    "韩语": "ko",
    "法语": "fr",
    "德语": "de",
    "西班牙语": "es",
    "俄语": "ru",
    "葡萄牙语": "pt",
    "意大利语": "it",
    "阿拉伯语": "ar",
    "泰语": "th",
    "越南语": "vi",
}

# 翻译引擎列表（按速度优先级）
# bing 通常最快且稳定
TRANSLATORS = ["bing", "alibaba", "baidu"]

# 支持的文档格式
SUPPORTED_DOC_FORMATS = [".txt", ".doc", ".docx"]
# 支持的图片格式
SUPPORTED_IMAGE_FORMATS = [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"]
# 文件大小限制 2MB
MAX_FILE_SIZE = 2 * 1024 * 1024


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "中文"
    target_lang: str = "英语"
    translator: str = "auto"


class TranslateResponse(BaseModel):
    success: bool
    translated_text: str
    source_lang: str
    target_lang: str
    translator: str
    message: str = ""


@router.post("/", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """翻译文本"""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="请输入要翻译的文本")

    if len(request.text) > 5000:
        raise HTTPException(status_code=400, detail="文本长度不能超过5000字符")

    from_lang = LANG_MAP.get(request.source_lang, "zh")
    to_lang = LANG_MAP.get(request.target_lang, "en")

    if from_lang == to_lang:
        return TranslateResponse(
            success=True,
            translated_text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            translator="none",
            message="源语言和目标语言相同",
        )

    translators_to_try = (
        [request.translator] if request.translator != "auto" else TRANSLATORS
    )

    last_error = None
    for translator in translators_to_try:
        try:
            result = ts.translate_text(
                request.text,
                translator=translator,
                from_language=from_lang,
                to_language=to_lang,
                timeout=10,  # 10秒超时
            )
            return TranslateResponse(
                success=True,
                translated_text=result,
                source_lang=request.source_lang,
                target_lang=request.target_lang,
                translator=translator,
            )
        except Exception as e:
            last_error = str(e)
            # 快速失败，不等待太久
            continue

    raise HTTPException(status_code=500, detail=f"翻译失败: {last_error}")


@router.get("/languages")
async def get_languages():
    """获取支持的语言列表"""
    return {"languages": list(LANG_MAP.keys())}


@router.get("/translators")
async def get_translators():
    """获取可用的翻译引擎"""
    return {"translators": ["auto"] + TRANSLATORS}


def translate_with_fallback(text: str, from_lang: str, to_lang: str, translator: str = "auto"):
    """使用翻译引擎翻译文本，支持自动回退"""
    translators_to_try = [translator] if translator != "auto" else TRANSLATORS
    last_error = None
    
    for t in translators_to_try:
        try:
            result = ts.translate_text(text, translator=t, from_language=from_lang, to_language=to_lang, timeout=10)
            return result, t
        except Exception as e:
            last_error = str(e)
            continue
    
    raise Exception(f"翻译失败: {last_error}")


@router.post("/document")
async def translate_document(
    file: UploadFile = File(...),
    source_lang: str = Form("中文"),
    target_lang: str = Form("英语"),
    translator: str = Form("auto")
):
    """翻译文档 (txt, doc, docx)"""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_DOC_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的文档格式，支持: {', '.join(SUPPORTED_DOC_FORMATS)}")
    
    content = await file.read()
    
    # 检查文件是否为空
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件内容为空，请检查文件是否有内容")
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过2MB")
    
    try:
        if ext == ".txt":
            text = None
            # 尝试多种编码
            for encoding in ["utf-8", "utf-8-sig", "gbk", "gb2312", "gb18030", "big5", "latin-1"]:
                try:
                    text = content.decode(encoding)
                    # 检查解码后是否有有效内容
                    if text.strip():
                        break
                except:
                    continue
            if text is None:
                raise HTTPException(status_code=400, detail="无法解析文件编码，请确保文件使用UTF-8或GBK编码")
        elif ext in [".doc", ".docx"]:
            try:
                import docx
                with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                    tmp.write(content)
                    tmp_path = tmp.name
                doc = docx.Document(tmp_path)
                text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
                os.unlink(tmp_path)
            except ImportError:
                raise HTTPException(status_code=500, detail="服务器未安装 python-docx 库")
        else:
            raise HTTPException(status_code=400, detail="不支持的文档格式")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文档解析失败: {str(e)}")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="文档内容为空")
    
    from_lang = LANG_MAP.get(source_lang, "zh")
    to_lang = LANG_MAP.get(target_lang, "en")
    
    try:
        translated, used_translator = translate_with_fallback(text, from_lang, to_lang, translator)
        return {
            "success": True,
            "original_text": text,
            "translated_text": translated,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "translator": used_translator,
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# OCR 实例缓存
_ocr_instance = None

def get_ocr():
    """获取 RapidOCR 实例"""
    global _ocr_instance
    
    if _ocr_instance is not None:
        return _ocr_instance
    
    try:
        from rapidocr_onnxruntime import RapidOCR
        _ocr_instance = RapidOCR()
        return _ocr_instance
    except ImportError:
        return None


def ocr_image(content: bytes, source_lang: str = "中文") -> str:
    """使用 RapidOCR 识别图片文字"""
    from PIL import Image, ImageEnhance, ImageFilter
    import io
    import numpy as np
    
    ocr = get_ocr()
    
    if ocr is None:
        raise ImportError("未安装 OCR 库，请运行: pip install rapidocr_onnxruntime")
    
    # 将图片转为numpy数组
    image = Image.open(io.BytesIO(content))
    
    # 转为RGB模式
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # 图片预处理：放大小图片以提高识别率
    width, height = image.size
    if width < 1000 or height < 500:
        scale = max(1000 / width, 500 / height, 2)
        new_size = (int(width * scale), int(height * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    
    # 增强对比度
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)
    
    # 锐化
    image = image.filter(ImageFilter.SHARPEN)
    
    img_array = np.array(image)
    
    # 识别
    result, _ = ocr(img_array)
    
    # 提取文字
    if result:
        texts = [line[1] for line in result]
        return '\n'.join(texts)
    
    return ""


@router.post("/image")
async def translate_image(
    file: UploadFile = File(...),
    source_lang: str = Form("中文"),
    target_lang: str = Form("英语"),
    translator: str = Form("auto")
):
    """翻译图片中的文字"""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的图片格式，支持: {', '.join(SUPPORTED_IMAGE_FORMATS)}")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="图片大小不能超过2MB")
    
    # OCR 识别文字
    try:
        text = ocr_image(content, source_lang)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"图片文字识别失败: {str(e)}")
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="未能从图片中识别出文字")
    
    from_lang = LANG_MAP.get(source_lang, "zh")
    to_lang = LANG_MAP.get(target_lang, "en")
    
    try:
        translated, used_translator = translate_with_fallback(text, from_lang, to_lang, translator)
        return {
            "success": True,
            "original_text": text,
            "translated_text": translated,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "translator": used_translator,
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image/ocr")
async def ocr_only(file: UploadFile = File(...), source_lang: str = Form("中文")):
    """仅识别图片文字，不翻译"""
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail=f"不支持的图片格式，支持: {', '.join(SUPPORTED_IMAGE_FORMATS)}")
    
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="图片大小不能超过2MB")
    
    try:
        text = ocr_image(content, source_lang)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"图片文字识别失败: {str(e)}")
    
    return {
        "success": True,
        "text": text,
        "filename": filename
    }
