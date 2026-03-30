"""
添加BGM路由
使用 FFmpeg amix 滤镜混合音频
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import uuid
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR


@router.post("/")
async def add_bgm(
    main_audio: UploadFile = File(...),
    bgm_audio: UploadFile = File(...),
    bgm_volume: float = Form(0.3),  # BGM音量 0-1
    loop_bgm: bool = Form(True),  # 是否循环BGM
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    给音频添加背景音乐
    
    参数:
    - main_audio: 主音频文件
    - bgm_audio: 背景音乐文件
    - bgm_volume: BGM音量 (0-1)
    - loop_bgm: 是否循环BGM以匹配主音频长度
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if bgm_volume < 0 or bgm_volume > 1:
        raise HTTPException(status_code=400, detail="BGM音量必须在 0-1 之间")
    
    main_ext = os.path.splitext(main_audio.filename)[1].lower()
    bgm_ext = os.path.splitext(bgm_audio.filename)[1].lower()
    file_id = str(uuid.uuid4())
    
    main_path = os.path.join(UPLOAD_DIR, f"{file_id}_main{main_ext}")
    bgm_path = os.path.join(UPLOAD_DIR, f"{file_id}_bgm{bgm_ext}")
    
    try:
        # 保存文件
        main_content = await main_audio.read()
        with open(main_path, "wb") as f:
            f.write(main_content)
        
        bgm_content = await bgm_audio.read()
        with open(bgm_path, "wb") as f:
            f.write(bgm_content)
        
        # 获取主音频时长
        main_duration = get_audio_duration(main_path)
        
        out_ext = f".{output_format.lower()}" if output_format else main_ext
        # 使用原文件名
        base_name = os.path.splitext(decode_filename(main_audio.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        # 构建 FFmpeg 命令
        if loop_bgm:
            # 循环BGM并调整音量，然后混合
            cmd = [
                'ffmpeg', '-y',
                '-i', main_path,
                '-stream_loop', '-1', '-i', bgm_path,
                '-filter_complex',
                f"[1:a]volume={bgm_volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]",
                '-map', '[out]',
                '-t', str(main_duration),
                final_output
            ]
        else:
            # 不循环，直接混合
            cmd = [
                'ffmpeg', '-y',
                '-i', main_path,
                '-i', bgm_path,
                '-filter_complex',
                f"[1:a]volume={bgm_volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]",
                '-map', '[out]',
                final_output
            ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "BGM添加成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        for path in [main_path, bgm_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass


def get_audio_duration(file_path: str) -> float:
    """获取音频时长"""
    import json
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    try:
        info = json.loads(result.stdout)
        return float(info.get('format', {}).get('duration', 0))
    except:
        return 0
