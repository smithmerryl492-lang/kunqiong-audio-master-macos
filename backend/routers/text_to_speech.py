"""
文字转语音路由
使用 edge-tts 进行语音合成
"""
from fastapi import APIRouter, HTTPException, Form
from fastapi.responses import JSONResponse, FileResponse
import os
import uuid
import asyncio
import edge_tts
import re
import subprocess
import tempfile
import json
from .utils import get_unique_filename, prepare_output_directory
from .resource_path import get_resource_path

router = APIRouter()

from .config import OUTPUT_DIR

voices_config_path = get_resource_path("config/tts_voices.json")
with open(voices_config_path, "r", encoding="utf-8") as f:
    voices_config = json.load(f)

CHINESE_VOICES = voices_config.get("chinese", [])
ENGLISH_VOICES = voices_config.get("english", [])


def has_pause_markers(text: str) -> bool:
    """检查文本是否包含停顿标记"""
    pattern = r'\[(\d+(?:\.\d+)?)(s|ms)\]'
    return bool(re.search(pattern, text))


def parse_text_with_pauses(text: str) -> list:
    """
    解析文本，将文本分割成文本段和停顿段
    返回: [{'type': 'text', 'content': '...'}, {'type': 'pause', 'duration_ms': 1000}, ...]
    """
    pattern = r'\[(\d+(?:\.\d+)?)(s|ms)\]'
    segments = []
    last_end = 0
    
    for match in re.finditer(pattern, text):
        # 添加停顿前的文本
        if match.start() > last_end:
            text_content = text[last_end:match.start()]
            if text_content.strip():
                segments.append({'type': 'text', 'content': text_content})
        
        # 解析停顿时长
        value = float(match.group(1))
        unit = match.group(2)
        if unit == 's':
            duration_ms = int(value * 1000)
        else:
            duration_ms = int(value)
        duration_ms = min(duration_ms, 5000)  # 最大5秒
        
        segments.append({'type': 'pause', 'duration_ms': duration_ms})
        last_end = match.end()
    
    # 添加最后的文本
    if last_end < len(text):
        text_content = text[last_end:]
        if text_content.strip():
            segments.append({'type': 'text', 'content': text_content})
    
    return segments


def get_ffmpeg_path():
    """获取 FFmpeg 路径"""
    # 尝试从环境变量获取
    ffmpeg_path = os.environ.get('FFMPEG_PATH')
    if ffmpeg_path and os.path.exists(ffmpeg_path):
        return ffmpeg_path
    # 默认使用系统 ffmpeg
    return 'ffmpeg'


def generate_silence(duration_ms: int, output_path: str):
    """生成指定时长的静音音频"""
    ffmpeg = get_ffmpeg_path()
    duration_s = duration_ms / 1000.0
    cmd = [
        ffmpeg, '-y', '-f', 'lavfi', '-i', f'anullsrc=r=24000:cl=mono',
        '-t', str(duration_s), '-acodec', 'libmp3lame', '-q:a', '2', output_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)


def concat_audio_files(file_list: list, output_path: str):
    """合并多个音频文件"""
    if len(file_list) == 1:
        # 只有一个文件，直接复制
        import shutil
        shutil.copy(file_list[0], output_path)
        return
    
    ffmpeg = get_ffmpeg_path()
    
    # 创建文件列表
    list_file = output_path + '.txt'
    with open(list_file, 'w', encoding='utf-8') as f:
        for file_path in file_list:
            # 转义路径中的特殊字符，使用正斜杠
            escaped_path = file_path.replace('\\', '/').replace("'", "'\\''")
            f.write(f"file '{escaped_path}'\n")
    
    cmd = [
        ffmpeg, '-y', '-f', 'concat', '-safe', '0', '-i', list_file,
        '-acodec', 'libmp3lame', '-q:a', '2', output_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    
    # 清理临时文件
    try:
        os.remove(list_file)
    except:
        pass


async def generate_speech_with_pauses(
    text: str, voice: str, rate: str, pitch: str, volume: str, output_path: str
):
    """生成带停顿的语音"""
    segments = parse_text_with_pauses(text)
    
    if not segments:
        raise ValueError("没有有效的文本内容")
    
    temp_files = []
    temp_dir = os.path.dirname(output_path)
    
    try:
        for i, segment in enumerate(segments):
            temp_file = os.path.join(temp_dir, f"_temp_segment_{uuid.uuid4()}.mp3")
            
            if segment['type'] == 'text':
                # 生成语音
                communicate = edge_tts.Communicate(
                    text=segment['content'],
                    voice=voice,
                    rate=rate,
                    pitch=pitch,
                    volume=volume
                )
                await communicate.save(temp_file)
            else:
                # 生成静音（同步调用）
                generate_silence(segment['duration_ms'], temp_file)
            
            temp_files.append(temp_file)
        
        # 合并所有音频（同步调用）
        concat_audio_files(temp_files, output_path)
        
    finally:
        # 清理临时文件
        for temp_file in temp_files:
            try:
                os.remove(temp_file)
            except:
                pass


@router.post("/")
async def text_to_speech(
    text: str = Form(...),
    voice: str = Form("zh-CN-XiaoxiaoNeural"),
    rate: int = Form(0),      # 语速 -100 到 +100
    pitch: int = Form(0),     # 语调 -50 到 +50
    volume: int = Form(0),    # 音量 -100 到 +100
    output_format: str = Form("mp3"),
    output_path: str = Form(""),
    filename: str = Form("")
):
    """
    文字转语音
    
    参数:
    - text: 要转换的文字
    - voice: 语音ID
    - rate: 语速调整(-100 到 +100)
    - pitch: 语调调整 (-50 到 +50)
    - volume: 音量调整 (-100 到 +100)
    - output_format: 输出格式 (mp3/wav)
    - output_path: 输出目录
    - filename: 自定义文件名
    
    支持在文本中插入停顿标记:
    - [1s] 停顿1秒
    - [500ms] 停顿500毫秒
    - [0.5s] 停顿0.5秒
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="请输入要转换的文字")
    
    if len(text) > 5000:
        raise HTTPException(status_code=400, detail="文字长度不能超过5000字")
    
    try:
        # 构建语速、语调、音量字符串
        rate_str = f"+{rate}%" if rate >= 0 else f"{rate}%"
        pitch_str = f"+{pitch}Hz" if pitch >= 0 else f"{pitch}Hz"
        volume_str = f"+{volume}%" if volume >= 0 else f"{volume}%"
        
        # 生成输出文件名
        if filename:
            output_filename = f"{filename}.{output_format}"
        else:
            # 使用文字前10个字符作为文件名（移除停顿标记）
            clean_text = re.sub(r'\[\d+(?:\.\d+)?(s|ms)\]', '', text)
            safe_name = "".join(c for c in clean_text[:10] if c.isalnum() or c in ' _-')
            safe_name = safe_name.strip() or "speech"
            output_filename = f"{safe_name}.{output_format}"
        
        # 准备输出目录
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        # 检查是否包含停顿标记
        if has_pause_markers(text):
            # 使用分段合成方式处理停顿
            await generate_speech_with_pauses(text, voice, rate_str, pitch_str, volume_str, final_output)
        else:
            # 普通文本，直接合成
            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate=rate_str,
                pitch=pitch_str,
                volume=volume_str
            )
            await communicate.save(final_output)
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "转换成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")


@router.post("/preview")
async def preview_speech(
    text: str = Form(...),
    voice: str = Form("zh-CN-XiaoxiaoNeural"),
    rate: int = Form(0),
    pitch: int = Form(0),
    volume: int = Form(0)
):
    """
    试听语音（生成临时文件）
    支持停顿标记: [1s], [500ms], [0.5s] 等
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="请输入要转换的文字")
    
    try:
        rate_str = f"+{rate}%" if rate >= 0 else f"{rate}%"
        pitch_str = f"+{pitch}Hz" if pitch >= 0 else f"{pitch}Hz"
        volume_str = f"+{volume}%" if volume >= 0 else f"{volume}%"
        
        temp_file = os.path.join(OUTPUT_DIR, f"preview_{uuid.uuid4()}.mp3")
        
        # 检查是否包含停顿标记
        if has_pause_markers(text):
            # 使用分段合成方式处理停顿
            await generate_speech_with_pauses(text, voice, rate_str, pitch_str, volume_str, temp_file)
        else:
            # 普通文本，直接合成
            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate=rate_str,
                pitch=pitch_str,
                volume=volume_str
            )
            await communicate.save(temp_file)
        
        return FileResponse(
            temp_file,
            media_type="audio/mpeg",
            filename="preview.mp3",
            background=None  # 不在后台删除，让前端播放完
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"试听失败: {str(e)}")


def split_sentences(text: str) -> list:
    """按标点符号分句"""
    sentences = []
    current = ''
    for char in text:
        current += char
        if char in '。！？；.!?;\n':
            if current.strip():
                sentences.append(current.strip())
            current = ''
    if current.strip():
        sentences.append(current.strip())
    return sentences


@router.post("/preview-with-timestamps")
async def preview_with_timestamps(
    text: str = Form(...),
    voice: str = Form("zh-CN-XiaoxiaoNeural"),
    rate: int = Form(0),
    pitch: int = Form(0),
    volume: int = Form(0)
):
    """
    试听语音并返回句子时间戳
    返回音频文件路径和每句话的开始/结束时间
    支持停顿标记: [1s], [500ms], [0.5s] 等
    """
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="请输入要转换的文字")
    
    try:
        rate_str = f"+{rate}%" if rate >= 0 else f"{rate}%"
        pitch_str = f"+{pitch}Hz" if pitch >= 0 else f"{pitch}Hz"
        volume_str = f"+{volume}%" if volume >= 0 else f"{volume}%"
        
        temp_file = os.path.join(OUTPUT_DIR, f"preview_{uuid.uuid4()}.mp3")
        
        # 对于带停顿的文本，先生成音频，时间戳简化处理
        if has_pause_markers(text):
            await generate_speech_with_pauses(text, voice, rate_str, pitch_str, volume_str, temp_file)
            # 移除停顿标记后分句
            clean_text = re.sub(r'\[\d+(?:\.\d+)?(s|ms)\]', '', text)
            sentences = split_sentences(clean_text)
            # 简化的时间戳（无法精确获取带停顿的时间戳）
            sentence_timestamps = [{"text": s, "start": 0, "end": 0} for s in sentences]
        else:
            # 普通文本，可以获取精确时间戳
            communicate = edge_tts.Communicate(
                text=text,
                voice=voice,
                rate=rate_str,
                pitch=pitch_str,
                volume=volume_str
            )
            
            # 收集词级别的时间戳
            word_timestamps = []
            
            with open(temp_file, "wb") as f:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        f.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        word_timestamps.append({
                            "text": chunk["text"],
                            "offset": chunk["offset"] / 10000000,
                            "duration": chunk["duration"] / 10000000
                        })
            
            # 分句
            sentences = split_sentences(text)
            
            # 计算每句话的时间戳
            sentence_timestamps = []
            word_idx = 0
            
            for sentence in sentences:
                sentence_start = None
                sentence_end = 0
                sentence_text = sentence.replace(' ', '').replace('\n', '')
                matched_text = ''
                
                while word_idx < len(word_timestamps) and len(matched_text) < len(sentence_text):
                    word = word_timestamps[word_idx]
                    if sentence_start is None:
                        sentence_start = word["offset"]
                    sentence_end = word["offset"] + word["duration"]
                    matched_text += word["text"].replace(' ', '')
                    word_idx += 1
                
                sentence_timestamps.append({
                    "text": sentence,
                    "start": sentence_start or 0,
                    "end": sentence_end
                })
        
        return JSONResponse({
            "success": True,
            "audio_url": f"/api/tts/audio/{os.path.basename(temp_file)}",
            "sentences": sentence_timestamps
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"试听失败: {str(e)}")


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    """获取音频文件"""
    file_path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="音频文件不存在")
    return FileResponse(file_path, media_type="audio/mpeg")


@router.get("/voices")
async def get_voices():
    """获取可用的语音列表"""
    return {
        "chinese": CHINESE_VOICES,
        "english": ENGLISH_VOICES
    }


@router.get("/voices/all")
async def get_all_voices():
    """获取所有可用的语音（从 edge-tts 获取）"""
    try:
        voices = await edge_tts.list_voices()
        return {"voices": voices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取语音列表失败: {str(e)}")
