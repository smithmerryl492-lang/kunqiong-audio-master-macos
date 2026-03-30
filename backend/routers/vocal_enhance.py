"""
人声增强路由
使用 FFmpeg 滤镜组合增强人声清晰度
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import subprocess
import os
import uuid
from typing import List
from .utils import get_unique_filename, decode_filename, prepare_output_directory

router = APIRouter()

from .config import UPLOAD_DIR, OUTPUT_DIR

# 预设配置
PRESETS = {
    "light": {
        "name": "轻度增强",
        "description": "轻微提升人声清晰度",
        "highpass": 80,
        "lowpass": 12000,
        "eq_300": 2,
        "eq_1000": 3,
        "eq_3000": 2,
        "compressor": "0.3",
        "normalize": True
    },
    "medium": {
        "name": "中度增强",
        "description": "明显提升人声，适合一般录音",
        "highpass": 100,
        "lowpass": 10000,
        "eq_300": 3,
        "eq_1000": 4,
        "eq_3000": 3,
        "compressor": "0.4",
        "normalize": True
    },
    "strong": {
        "name": "强力增强",
        "description": "大幅提升人声，适合嘈杂环境录音",
        "highpass": 120,
        "lowpass": 8000,
        "eq_300": 4,
        "eq_1000": 5,
        "eq_3000": 4,
        "compressor": "0.5",
        "normalize": True
    },
    "podcast": {
        "name": "播客模式",
        "description": "优化语音播客效果",
        "highpass": 80,
        "lowpass": 14000,
        "eq_300": 2,
        "eq_1000": 3,
        "eq_3000": 4,
        "eq_6000": 2,
        "compressor": "0.35",
        "normalize": True
    },
    "phone": {
        "name": "电话录音",
        "description": "优化电话或低质量录音",
        "highpass": 200,
        "lowpass": 6000,
        "eq_300": 3,
        "eq_1000": 5,
        "eq_3000": 4,
        "compressor": "0.5",
        "normalize": True
    }
}


@router.post("/")
async def enhance_vocal(
    file: UploadFile = File(...),
    preset: str = Form("medium"),
    # 自定义参数（覆盖预设）
    highpass: int = Form(0),      # 高通滤波(Hz)
    lowpass: int = Form(0),       # 低通滤波(Hz)
    eq_300: float = Form(0),      # 300Hz 增益 (dB)
    eq_1000: float = Form(0),     # 1kHz 增益 (dB)
    eq_3000: float = Form(0),     # 3kHz 增益 (dB)
    compression: float = Form(0), # 压缩强度 0-1
    normalize: bool = Form(True), # 是否标准化音�?
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """
    人声增强
    
    原理�?
    1. 高通滤波去除低频噪�?
    2. 低通滤波去除高频噪�?
    3. 均衡器增强人声频�?(300Hz, 1kHz, 3kHz)
    4. 动态压缩使音量更均匀
    5. 响度标准�?
    """
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}{file_ext}")
    
    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
        
        # 获取预设配置
        config = PRESETS.get(preset, PRESETS["medium"]).copy()
        
        # 自定义参数覆盖预设
        if highpass > 0:
            config["highpass"] = highpass
        if lowpass > 0:
            config["lowpass"] = lowpass
        if eq_300 != 0:
            config["eq_300"] = eq_300
        if eq_1000 != 0:
            config["eq_1000"] = eq_1000
        if eq_3000 != 0:
            config["eq_3000"] = eq_3000
        if compression > 0:
            config["compressor"] = str(compression)
        config["normalize"] = normalize
        
        out_ext = f".{output_format.lower()}" if output_format else file_ext
        base_name = os.path.splitext(decode_filename(file.filename))[0]
        output_filename = f"{base_name}{out_ext}"
        
        # 准备输出目录

        
        save_dir, is_fallback = prepare_output_directory(output_path, OUTPUT_DIR)
        output_filename = get_unique_filename(save_dir, output_filename)
        final_output = os.path.join(save_dir, output_filename)
        
        os.makedirs(save_dir, exist_ok=True)
        
        # 构建滤镜链
        filters = []
        
        # 1. 高通滤波（去除低频噪音）
        if config.get("highpass", 0) > 0:
            filters.append(f"highpass=f={config['highpass']}")
        
        # 2. 低通滤波（去除高频噪音）
        if config.get("lowpass", 0) > 0:
            filters.append(f"lowpass=f={config['lowpass']}")
        
        # 3. 均衡器增强人声频段
        eq_bands = []
        if config.get("eq_300", 0) != 0:
            eq_bands.append(f"equalizer=f=300:t=q:w=1:g={config['eq_300']}")
        if config.get("eq_1000", 0) != 0:
            eq_bands.append(f"equalizer=f=1000:t=q:w=1:g={config['eq_1000']}")
        if config.get("eq_3000", 0) != 0:
            eq_bands.append(f"equalizer=f=3000:t=q:w=1:g={config['eq_3000']}")
        if config.get("eq_6000", 0) != 0:
            eq_bands.append(f"equalizer=f=6000:t=q:w=1:g={config['eq_6000']}")
        filters.extend(eq_bands)
        
        # 4. 动态压缩（使音量更均匀）
        comp_ratio = float(config.get("compressor", "0.3"))
        if comp_ratio > 0:
            # acompressor: threshold, ratio, attack, release
            filters.append(f"acompressor=threshold=-20dB:ratio={2 + comp_ratio * 6}:attack=5:release=50")
        
        # 5. 响度标准化
        if config.get("normalize", True):
            filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        
        filter_str = ",".join(filters) if filters else "anull"
        
        cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"增强失败: {result.stderr}")
        
        output_size = os.path.getsize(final_output)
        
        return JSONResponse({
            "success": True,
            "message": "人声增强成功",
            "output_path": final_output,
            "filename": output_filename,
            "size": output_size,
            "preset": preset
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"增强失败: {str(e)}")
    finally:
        if os.path.exists(input_path):
            try:
                os.remove(input_path)
            except:
                pass


@router.post("/batch")
async def batch_enhance_vocal(
    files: List[UploadFile] = File(...),
    preset: str = Form("medium"),
    output_format: str = Form(""),
    output_path: str = Form("")
):
    """批量人声增强"""
    results = []
    config = PRESETS.get(preset, PRESETS["medium"])
    
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
            
            os.makedirs(save_dir, exist_ok=True)
            
            # 构建滤镜链
            filters = []
            if config.get("highpass", 0) > 0:
                filters.append(f"highpass=f={config['highpass']}")
            if config.get("lowpass", 0) > 0:
                filters.append(f"lowpass=f={config['lowpass']}")
            if config.get("eq_300", 0) != 0:
                filters.append(f"equalizer=f=300:t=q:w=1:g={config['eq_300']}")
            if config.get("eq_1000", 0) != 0:
                filters.append(f"equalizer=f=1000:t=q:w=1:g={config['eq_1000']}")
            if config.get("eq_3000", 0) != 0:
                filters.append(f"equalizer=f=3000:t=q:w=1:g={config['eq_3000']}")
            if config.get("eq_6000", 0) != 0:
                filters.append(f"equalizer=f=6000:t=q:w=1:g={config['eq_6000']}")
            comp_ratio = float(config.get("compressor", "0.3"))
            if comp_ratio > 0:
                filters.append(f"acompressor=threshold=-20dB:ratio={2 + comp_ratio * 6}:attack=5:release=50")
            if config.get("normalize", True):
                filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
            
            filter_str = ",".join(filters) if filters else "anull"
            
            cmd = ['ffmpeg', '-y', '-i', input_path, '-af', filter_str, final_output]
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
            
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


@router.get("/presets")
async def get_presets():
    """获取可用的增强预设"""
    return {
        "presets": [
            {"id": key, "name": val["name"], "description": val["description"]}
            for key, val in PRESETS.items()
        ]
    }
