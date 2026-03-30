# -*- mode: python ; coding: utf-8 -*-
import os
import site
import sys
from pathlib import Path

block_cipher = None

current_dir = Path(os.path.dirname(os.path.abspath(SPEC)))
root_dir = current_dir.resolve().parent

if sys.platform == 'darwin':
    icon_candidates = [
        root_dir / 'build' / 'icon.icns',
    ]
else:
    icon_candidates = [
        root_dir / '音频处理大师.ico',
        root_dir / 'build' / '音频处理大师.ico',
    ]

icon_path = next((candidate for candidate in icon_candidates if candidate.exists()), None)

rapidocr_path = None
for sp in site.getsitepackages():
    candidate = Path(sp) / 'rapidocr_onnxruntime'
    if candidate.exists():
        rapidocr_path = candidate
        break

datas_list = [
    ('effects', 'effects'),
    ('bgm', 'bgm'),
    ('models', 'models'),
    ('config', 'config'),
]

if rapidocr_path:
    datas_list.append((str(rapidocr_path), 'rapidocr_onnxruntime'))

try:
    import torch
    torch_path = Path(torch.__file__).resolve().parent
    datas_list.append((str(torch_path / 'lib'), 'torch/lib'))
except ImportError:
    pass

a = Analysis(
    ['main_exe.py'],
    pathex=[str(current_dir)],
    binaries=[],
    datas=datas_list,
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'fastapi',
        'starlette',
        'pydantic',
        'multipart',
        'tkinter',
        'tkinter.filedialog',
        'faster_whisper',
        'librosa',
        'soundfile',
        'audioread',
        'opencc',
        'jieba',
        'edge_tts',
        'pyttsx3',
        'translators',
        'docx',
        'python_docx',
        'openpyxl',
        'PIL',
        'PIL.Image',
        'PIL.ImageTk',
        'requests',
        'aiohttp',
        'websockets',
        'asyncio',
        'concurrent.futures',
        'multiprocessing',
        'threading',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'test',
        'unittest',
        'pdb',
        'doctest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)


def filter_binaries(binaries):
    if sys.platform != 'win32':
        return binaries

    exclude_patterns = [
        'api-ms-win-',
        'ucrtbase.dll',
        'msvcp140.dll',
        'vcruntime140.dll',
    ]

    filtered = []
    for binary in binaries:
        name = binary[0].lower()
        if not any(pattern in name for pattern in exclude_patterns):
            filtered.append(binary)
    return filtered


a.binaries = filter_binaries(a.binaries)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[
        'vcruntime140.dll',
        'msvcp140.dll',
        'python3.dll',
        'python311.dll',
    ],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(icon_path) if icon_path else None,
)
