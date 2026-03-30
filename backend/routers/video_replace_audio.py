"""
视频替换音频路由
使用 FFmpeg 替换视频中的音频轨道
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
async def replace_audio(
    video_file: UploadFile = File(...),
    audio_file: UploadFile = File(...),
    keep_original_audio: bool = Form(False),  # 是否保留原音频（混合�?
    audio_volume: float = Form(1.0),  # 新音频音�?
    output_path: str = Form("")
):
    """
    替换视频中的音频
    
    参数:
    - video_file: 视频文件
    - audio_file: 新音频文件
    - keep_original_audio: 是否保留原音频（混合）
    - audio_volume: 新音频音量(0-2)
    - output_path: 输出目录
    """
    video_ext = os.path.splitext(video_file.filename)[1].lower()
    audio_ext = os.path.splitext(audio_file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    
    video_path = os.path.join(UPLOAD_DIR, f"{file_id}_video{video_ext}")
    audio_path = os.path.join(UPLOAD_DIR, f"{file_id}_audio{audio_ext}")
    
    try:
        # 保存文件
        video_content = await video_file.read()
        with open(video_path, "wb") as f:
            f.write(video_content)
        
        audio_content = await audio_file.read()
        with open(audio_path, "wb") as f:
            f.write(audio_content)
        
        # 使用原文件名
        output_filename = decode_filename(video_file.filename)
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        if keep_original_audio:
            # 混合原音频和新音�?
            cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', audio_path,
                '-filter_complex',
                f"[1:a]volume={audio_volume}[new];[0:a][new]amix=inputs=2:duration=first[out]",
                '-map', '0:v',
                '-map', '[out]',
                '-c:v', 'copy',
                '-shortest',
                final_output
            ]
        else:
            # 完全替换音频
            if audio_volume != 1.0:
                cmd = [
                    'ffmpeg', '-y',
                    '-i', video_path,
                    '-i', audio_path,
                    '-map', '0:v',
                    '-map', '1:a',
                    '-c:v', 'copy',
                    '-af', f'volume={audio_volume}',
                    '-shortest',
                    final_output
                ]
            else:
                cmd = [
                    'ffmpeg', '-y',
                    '-i', video_path,
                    '-i', audio_path,
                    '-map', '0:v',
                    '-map', '1:a',
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-shortest',
                    final_output
                ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "音频替换成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        for path in [video_path, audio_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
