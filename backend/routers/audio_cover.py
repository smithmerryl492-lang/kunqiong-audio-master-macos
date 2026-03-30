"""
添加封面路由
使用 FFmpeg 为音频添加专辑封�?
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
async def add_cover(
    audio_file: UploadFile = File(...),
    cover_image: UploadFile = File(...),
    output_path: str = Form("")
):
    """
    为音频添加封面图片
    
    参数:
    - audio_file: 音频文件
    - cover_image: 封面图片 (jpg/png)
    - output_path: 输出目录
    
    注意: 输出格式为 MP3，因为 MP3 对封面支持最好
    """
    audio_ext = os.path.splitext(audio_file.filename)[1].lower()
    image_ext = os.path.splitext(cover_image.filename)[1].lower()
    
    if image_ext not in ['.jpg', '.jpeg', '.png']:
        raise HTTPException(status_code=400, detail="封面图片必须是 JPG 或 PNG 格式")
    
    file_id = str(uuid.uuid4())
    audio_path = os.path.join(UPLOAD_DIR, f"{file_id}_audio{audio_ext}")
    image_path = os.path.join(UPLOAD_DIR, f"{file_id}_cover{image_ext}")
    
    try:
        # 保存文件
        audio_content = await audio_file.read()
        with open(audio_path, "wb") as f:
            f.write(audio_content)
        
        image_content = await cover_image.read()
        with open(image_path, "wb") as f:
            f.write(image_content)
        
        # 使用原文件名，但输出为mp3
        base_name = os.path.splitext(decode_filename(audio_file.filename))[0]
        output_filename = f"{base_name}.mp3"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        # FFmpeg 命令添加封面
        cmd = [
            'ffmpeg', '-y',
            '-i', audio_path,
            '-i', image_path,
            '-map', '0:a',
            '-map', '1:0',
            '-c:a', 'libmp3lame',
            '-b:a', '192k',
            '-c:v', 'mjpeg',
            '-id3v2_version', '3',
            '-metadata:s:v', 'title=Album cover',
            '-metadata:s:v', 'comment=Cover (front)',
            final_output
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "封面添加成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        for path in [audio_path, image_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
