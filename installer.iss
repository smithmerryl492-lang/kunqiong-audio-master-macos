; Inno Setup Script for 音频处理大师
; 使用 Inno Setup 6 编译

#define MyAppName "音频处理大师"
#define MyAppVersion "1.0.3"
#define MyAppPublisher "鲲穹AI"
#define MyAppExeName "音频处理大师.exe"

; 源文件路径 - 便携版目录（使用相对路径）
#define SourcePath "release-final\win-unpacked"
; 图标路径（使用相对路径）
#define IconPath "音频处理大师.ico"

[Setup]
; 应用程序信息
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; 输出设置（使用相对路径）
OutputDir=release-final
OutputBaseFilename=音频处理大师_Setup_v{#MyAppVersion}

; 图标设置 - 安装程序图标
SetupIconFile={#IconPath}

; 压缩设置
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; 权限设置
PrivilegesRequired=admin

; 界面设置
WizardStyle=modern

; 静默安装支持
; 支持 /SILENT 和 /VERYSILENT 参数
; /SILENT - 静默安装但显示进度条
; /VERYSILENT - 完全静默安装
; /SUPPRESSMSGBOXES - 抑制消息框
; /NORESTART - 不重启系统
; /FORCECLOSEAPPLICATIONS - 强制关闭正在运行的应用程序
; /RESTARTAPPLICATIONS - 安装后重启应用程序
; /TASKS="desktopicon" - 静默安装时创建桌面快捷方式

; 卸载设置 - 在"设置-应用"中显示的图标
UninstallDisplayIcon={app}\音频处理大师.ico
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加图标:"; Flags: checkedonce

[Files]
; 复制所有文件到安装目录
Source: "{#SourcePath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; 复制图标文件
Source: "{#IconPath}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; 开始菜单快捷方式 - 使用自定义图标
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\音频处理大师.ico"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"

; 桌面快捷方式 - 使用自定义图标
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\音频处理大师.ico"; Tasks: desktopicon

[Run]
; 安装完成后运行程序
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行 {#MyAppName}"; Flags: nowait postinstall skipifsilent
