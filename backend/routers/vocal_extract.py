"""
人声-伴奏提取路由
使用 FFmpeg 中心声道消除（轻量方案）
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
async def extract_vocal(
    file: UploadFile = File(...),
    extract_type: str = Form("all"),  # all, vocals, accompaniment
    output_format: str = Form("mp3"),
    output_path: str = Form("")
):
    """
    人声-伴奏提取（使用 FFmpeg 中心声道消除）
    
    原理：人声通常位于立体声的中心位置，通过相位抵消可以分离
    
    参数:
    - file: 音频文件
    - extract_type: 提取类型 (all=全部, vocals=仅人声, accompaniment=仅伴奏)
    - output_format: 输出格式 (mp3, wav, flac)
    - output_path: 输出目录
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        # 保存上传文件
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        
        # 准备输出目录
        final_output_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        
        results = []
        
        # 提取伴奏（消除人声）
        if extract_type in ["all", "accompaniment"]:
            # 使用原文件名加后缀区分
            accompaniment_output = os.path.join(final_output_dir, f"{base_name}_伴奏.{output_format}")
            
            # 使用 pan 滤镜进行中心声道消除
            # 原理：左声道 - 右声道，人声（中心）被抵消
            cmd = [
                'ffmpeg', '-y', '-i', input_path,
                '-af', 'pan=stereo|c0=c0-c1|c1=c1-c0',
                '-q:a', '2',
                accompaniment_output
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
            if result.returncode == 0 and os.path.exists(accompaniment_output):
                results.append({
                    "type": "accompaniment",
                    "filename": f"{base_name}_伴奏.{output_format}",
                    "path": accompaniment_output,
                    "size": os.path.getsize(accompaniment_output)
                })
        
        # 提取人声（保留中心声道）
        if extract_type in ["all", "vocals"]:
            # 使用原文件名加后缀区分
            vocals_output = os.path.join(final_output_dir, f"{base_name}_人声.{output_format}")
            
            # 使用 stereotools 提取中心声道（人声）
            # mlev=1 表示只保留中心声�?
            cmd = [
                'ffmpeg', '-y', '-i', input_path,
                '-af', 'pan=mono|c0=0.5*c0+0.5*c1',
                '-q:a', '2',
                vocals_output
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
            if result.returncode == 0 and os.path.exists(vocals_output):
                results.append({
                    "type": "vocals",
                    "filename": f"{base_name}_人声.{output_format}",
                    "path": vocals_output,
                    "size": os.path.getsize(vocals_output)
                })
        
        if not results:
            raise HTTPException(status_code=500, detail="分离失败，请确保音频是立体声格式")
        
        return JSONResponse({
            "success": True,
            "message": "分离成功（基础模式）",
            "results": results,
            "output_dir": final_output_dir,
            "note": "此为基础分离模式，效果取决于原音频的立体声特性"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分离失败: {str(e)}")
    finally:
        # 清理临时文件
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.get("/info")
async def get_info():
    """获取人声分离功能信息"""
    return {
        "method": "FFmpeg 中心声道消除",
        "description": "使用相位抵消原理分离人声和伴奏",
        "limitations": [
            "效果取决于原音频的立体声混音方式",
            "对于单声道音频无效",
            "人声不在中心位置的音频效果较差"
        ],
        "best_for": [
            "标准立体声混音的流行音乐",
            "人声位于中心的录音"
        ]
    }
