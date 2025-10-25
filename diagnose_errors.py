# diagnose_errors.py (Version 4.0 - Universal Translator Edition)
import subprocess
import re
import os
from collections import defaultdict
from datetime import datetime

# ------------------- 配置 -------------------
PROJECT_ROOT = os.getcwd()
PNPM_PATH = 'C:\\nvm4w\\nodejs\\pnpm.cmd'
BUILD_COMMAND = [PNPM_PATH, 'turbo', 'run', 'build']
REPORT_FILENAME = 'typescript_error_report.md'
# ---------------------------------------------

def run_build_process():
    """执行完整的项目构建命令，并能容忍不同操作系统的编码方言。"""
    print("🤖 诊断机器人启动 (v4.0 - Universal Translator)：正在执行完整的项目编译...")
    print(f"🔩 命令: {' '.join(BUILD_COMMAND)}")
    
    try:
        # [核心修复] 添加 errors='replace'。这就是我们的“万能翻译器”。
        # 它告诉 Python 解码器：如果遇到无法识别的字节，就用一个替换字符'�'来代替，
        # 而不是让整个程序崩溃。
        process = subprocess.run(
            BUILD_COMMAND,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace' # <-- 万能翻译器
        )
        
        if process.returncode == 0:
            print("✅ 编译过程成功完成 (退出码 0)。")
            # [加固] 确保输出不是 None
            output = (process.stdout or "") + "\n" + (process.stderr or "")
            return output, True
        else:
            print(f"❌ 编译过程失败 (退出码 {process.returncode})。正在分析错误日志...")
            output = (process.stdout or "") + "\n" + (process.stderr or "")
            return output, False

    except FileNotFoundError:
        print(f"\n❌ 致命错误: pnpm 路径 '{PNPM_PATH}' 无效或不正确。")
        return None, False
    except Exception as e:
        print(f"\n❌ 执行构建时发生意外错误: {e}")
        return None, False

def parse_typescript_errors(output):
    """解析 TypeScript 编译器的输出，提取错误信息。"""
    print("🔬 正在扫描编译日志，提取所有 TypeScript 错误...")
    error_pattern = re.compile(r"(.+?)\((\d+),(\d+)\):\s*(error TS\d+):\s*(.+)")
    
    errors_by_file = defaultdict(list)
    lines = output.splitlines()

    for line in lines:
        match = error_pattern.match(line)
        if match:
            file_path = match.group(1).strip()
            relative_path = os.path.relpath(file_path, PROJECT_ROOT)
            
            error_info = {
                'line': int(match.group(2)),
                'col': int(match.group(3)),
                'code': match.group(4).strip(),
                'message': match.group(5).strip()
            }
            errors_by_file[relative_path].append(error_info)
    
    found_errors = len(errors_by_file) > 0
    if found_errors:
         print(f"📊 分析完成：在 {len(errors_by_file)} 个文件中发现了错误。")
    else:
         print("📊 分析完成：未在日志中匹配到标准格式的 TypeScript 错误。")
    return errors_by_file, found_errors

def generate_markdown_report(errors_by_file, build_succeeded, build_output):
    """生成一份清晰的 Markdown 格式的诊断报告。"""
    print(f"✍️ 正在生成详细的诊断报告: {REPORT_FILENAME}")
    total_errors = sum(len(errors) for errors in errors_by_file.values())
    
    with open(REPORT_FILENAME, 'w', encoding='utf-8') as f:
        f.write(f"# 🩺 Tuheg 项目 TypeScript 健康诊断报告\n\n")
        f.write(f"**生成时间:** `{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}`\n\n")
        
        if build_succeeded:
            f.write("## 🎉 结论：构建成功，未发现任何 TypeScript 编译错误！\n\n")
            print("🎉 恭喜！项目构建成功。")
            return

        f.write(f"## ❗ 诊断结论：项目构建失败！\n\n")
        if total_errors > 0:
            f.write(f"在 **{len(errors_by_file)}** 个文件中发现了 **{total_errors}** 个编译错误。这些错误是导致构建失败的直接原因。\n\n")
        else:
            f.write("构建命令返回了失败状态，但在输出日志中**未能解析出标准格式的 TypeScript 错误**。请检查下面的原始日志以确定根本原因。\n\n")
        
        f.write("---\n\n")

        if total_errors > 0:
            sorted_files = sorted(errors_by_file.keys())
            for file_path in sorted_files:
                errors = errors_by_file[file_path]
                sorted_errors = sorted(errors, key=lambda x: x['line'])
                f.write(f"### 📄 文件: `{file_path}` ({len(errors)} 个错误)\n\n")
                for error in sorted_errors:
                    f.write(f"- **L{error['line']} C{error['col']}** `{error['code']}`: `{error['message']}`\n")
                f.write("\n")
        
        f.write("---\n\n## 原始构建日志 (Raw Build Log)\n\n")
        f.write("```text\n")
        f.write(build_output)
        f.write("\n```\n")
            
    print(f"✅ 报告生成完毕！请打开 `{REPORT_FILENAME}` 文件查看详情。")

def main():
    """主执行函数"""
    raw_output, build_succeeded = run_build_process()
    if raw_output is not None:
        errors, found_ts_errors = parse_typescript_errors(raw_output)
        generate_markdown_report(errors, build_succeeded, raw_output)

if __name__ == "__main__":
    main()