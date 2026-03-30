"""
添加音效路由
使用 FFmpeg 在音频开头或结尾添加音效
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, FileResponse
import subprocess
import os
import uuid
import json
from typing import List, Optional
from .utils import get_unique_filename, decode_filename, prepare_output_directory
from .resource_path import get_effects_dir, get_upload_dir, get_output_dir

router = APIRouter()

UPLOAD_DIR = str(get_upload_dir())
OUTPUT_DIR = str(get_output_dir())
EFFECTS_DIR = str(get_effects_dir())

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(EFFECTS_DIR, exist_ok=True)

# 支持的音效格式
SUPPORTED_FORMATS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']


def scan_effects_directory():
    """扫描音效目录，获取所有音效文件"""
    effects = []
    if not os.path.exists(EFFECTS_DIR):
        os.makedirs(EFFECTS_DIR, exist_ok=True)
        return effects
    
    for filename in os.listdir(EFFECTS_DIR):
        file_path = os.path.join(EFFECTS_DIR, filename)
        if os.path.isfile(file_path):
            ext = os.path.splitext(filename)[1].lower()
            if ext in SUPPORTED_FORMATS:
                name = os.path.splitext(filename)[0]
                duration = get_audio_duration(file_path)
                effects.append({
                    "id": name,
                    "name": name,
                    "file": filename,
                    "duration": duration,
                    "path": file_path
                })
    
    # 按名称排序
    effects.sort(key=lambda x: x['name'])
    return effects


def get_audio_duration(file_path: str) -> float:
    """获取音频时长"""
    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', file_path]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    try:
        info = json.loads(result.stdout)
        return float(info.get('format', {}).get('duration', 0))
    except:
        return 0


@router.post("/")
async def add_sound_effect(
    file: UploadFile = File(...),
    start_effect: str = Form(""),      # 开头音效ID或自定义音效路径
    end_effect: str = Form(""),        # 结尾音效ID或自定义音效路径
    start_volume: float = Form(1.0),   # 开头音效音量
    end_volume: float = Form(1.0),     # 结尾音效音量
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    添加音效
    
    参数:
    - file: 音频文件
    - start_effect: 开头音效（内置音效ID或"custom:路径"）
    - end_effect: 结尾音效（内置音效ID或"custom:路径"）
    - start_volume: 开头音效音量 (0-2)
    - end_volume: 结尾音效音量 (0-2)
    - output_format: 输出格式
    - output_path: 输出目录
    """
    if not start_effect and not end_effect:
        raise HTTPException(status_code=400, detail="请至少选择一个音效")
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        main_duration = get_audio_duration(input_path)
        
        out_ext = f".{output_format.lower()}" if output_format else file_ext
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        # 获取音效文件路径
        start_effect_path = None
        end_effect_path = None
        effects = scan_effects_directory()
        
        if start_effect:
            effect = next((e for e in effects if e['id'] == start_effect), None)
            if effect:
                start_effect_path = effect['path']
        
        if end_effect:
            effect = next((e for e in effects if e['id'] == end_effect), None)
            if effect:
                end_effect_path = effect['path']
        
        # 构建 FFmpeg 命令
        if start_effect_path and end_effect_path:
            # 开头和结尾都有音效
            start_dur = get_audio_duration(start_effect_path)
            end_dur = get_audio_duration(end_effect_path)
            
            cmd = [
                'ffmpeg', '-y',
                '-i', start_effect_path,
                '-i', input_path,
                '-i', end_effect_path,
                '-filter_complex',
                f"[0:a]volume={start_volume}[start];"
                f"[2:a]volume={end_volume}[end];"
                f"[start][1:a][end]concat=n=3:v=0:a=1[out]",
                '-map', '[out]',
                final_output
            ]
        elif start_effect_path:
            # 只有开头音效
            cmd = [
                'ffmpeg', '-y',
                '-i', start_effect_path,
                '-i', input_path,
                '-filter_complex',
                f"[0:a]volume={start_volume}[start];"
                f"[start][1:a]concat=n=2:v=0:a=1[out]",
                '-map', '[out]',
                final_output
            ]
        else:
            # 只有结尾音效
            cmd = [
                'ffmpeg', '-y',
                '-i', input_path,
                '-i', end_effect_path,
                '-filter_complex',
                f"[1:a]volume={end_volume}[end];"
                f"[0:a][end]concat=n=2:v=0:a=1[out]",
                '-map', '[out]',
                final_output
            ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"处理失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "音效添加成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.post("/batch")
async def batch_add_effect(
    files: List[UploadFile] = File(...),
    start_effect: str = Form(""),
    end_effect: str = Form(""),
    start_volume: float = Form(1.0),
    end_volume: float = Form(1.0),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量添加音效"""
    if not start_effect and not end_effect:
        raise HTTPException(status_code=400, detail="请至少选择一个音效")
    
    # 获取音效文件路径
    start_effect_path = None
    end_effect_path = None
    effects = scan_effects_directory()
    
    if start_effect:
        effect = next((e for e in effects if e['id'] == start_effect), None)
        if effect:
            start_effect_path = effect['path']
    
    if end_effect:
        effect = next((e for e in effects if e['id'] == end_effect), None)
        if effect:
            end_effect_path = effect['path']
    
    results = []
    
    for file in files:
        file_ext = os.path.splitext(file.filename)[1].lower()
        file_id = str(uuid.uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
        
        try:
            content = await file.read()
            with open(input_path, "wb") as f:
                f.write(content)
            
            out_ext = f".{output_format.lower()}" if output_format else file_ext
            base_name = os.path.splitext(decode_filename(file.filename))[0]
            output_filename = f"{base_name}{out_ext}"
            
            # 准备输出目录

            
            save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
            output_filename = get_unique_filename(save_dir, output_filename)
            final_output = os.path.join(save_dir, output_filename)
            
            # 构建命令
            if start_effect_path and end_effect_path:
                cmd = [
                    'ffmpeg', '-y',
                    '-i', start_effect_path,
                    '-i', input_path,
                    '-i', end_effect_path,
                    '-filter_complex',
                    f"[0:a]volume={start_volume}[start];"
                    f"[2:a]volume={end_volume}[end];"
                    f"[start][1:a][end]concat=n=3:v=0:a=1[out]",
                    '-map', '[out]',
                    final_output
                ]
            elif start_effect_path:
                cmd = [
                    'ffmpeg', '-y',
                    '-i', start_effect_path,
                    '-i', input_path,
                    '-filter_complex',
                    f"[0:a]volume={start_volume}[start];"
                    f"[start][1:a]concat=n=2:v=0:a=1[out]",
                    '-map', '[out]',
                    final_output
                ]
            else:
                cmd = [
                    'ffmpeg', '-y',
                    '-i', input_path,
                    '-i', end_effect_path,
                    '-filter_complex',
                    f"[1:a]volume={end_volume}[end];"
                    f"[0:a][end]concat=n=2:v=0:a=1[out]",
                    '-map', '[out]',
                    final_output
                ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
            
            if result.returncode == 0:
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "output_path": final_output,
                    "output_filename": output_filename,
                    "size": os.path.getsize(final_output)
                })
            else:
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "message": result.stderr
                })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "success": False,
                "message": str(e)
            })
        finally:
            if os.path.exists(input_path):
                try:
                    os.remove(input_path)
                except:
                    pass
    
    return JSONResponse({
        "success": all(r.get('success') for r in results),
        "message": f"处理完成: {sum(1 for r in results if r.get('success'))}/{len(results)} 成功",
        "results": results
    })


@router.get("/effects")
async def get_effects():
    """获取可用的音效列表（扫描 effects 目录）"""
    effects = scan_effects_directory()
    return {"effects": effects}


@router.get("/preview/{effect_id}")
async def preview_effect(effect_id: str):
    """预览音效"""
    effects = scan_effects_directory()
    effect = next((e for e in effects if e['id'] == effect_id), None)
    
    if not effect or not os.path.exists(effect['path']):
        raise HTTPException(status_code=404, detail="音效不存在")
    
    return FileResponse(effect['path'], media_type="audio/mpeg")


@router.post("/upload-effect")
async def upload_custom_effect(
    file: UploadFile = File(...),
    name: str = Form("")
):
    """上传自定义音效"""
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail="不支持的音效格式")
    
    # 使用原文件名或自定义名称
    effect_name = name if name else os.path.splitext(decode_filename(file.filename))[0]
    effect_path = os.path.join(EFFECTS_DIR, f"{effect_name}{file_ext}")
    
    # 如果文件已存在，添加序号
    if os.path.exists(effect_path):
        counter = 1
        while os.path.exists(os.path.join(EFFECTS_DIR, f"{effect_name}_{counter}{file_ext}")):
            counter += 1
        effect_path = os.path.join(EFFECTS_DIR, f"{effect_name}_{counter}{file_ext}")
        effect_name = f"{effect_name}_{counter}"
    
    content = await file.read()
    with open(effect_path, "wb") as f:
        f.write(content)
    
    duration = get_audio_duration(effect_path)
    
    return JSONResponse({
        "success": True,
        "effect": {
            "id": effect_name,
            "name": effect_name,
            "file": f"{effect_name}{file_ext}",
            "duration": duration
        }
    })


@router.get("/open-folder")
async def open_effects_folder():
    """打开音效文件夹"""
    import platform
    
    os.makedirs(EFFECTS_DIR, exist_ok=True)
    
    try:
        if platform.system() == 'Windows':
            os.startfile(EFFECTS_DIR)
        elif platform.system() == 'Darwin':
            subprocess.run(['open', EFFECTS_DIR])
        else:
            subprocess.run(['xdg-open', EFFECTS_DIR])
        return {"success": True, "path": EFFECTS_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/effect/{effect_id}")
async def delete_effect(effect_id: str):
    """删除音效"""
    effects = scan_effects_directory()
    effect = next((e for e in effects if e['id'] == effect_id), None)
    
    if not effect:
        raise HTTPException(status_code=404, detail="音效不存在")
    
    try:
        os.remove(effect['path'])
        return {"success": True, "message": "删除成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
