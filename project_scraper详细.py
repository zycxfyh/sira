# project_scraper.py (v7.1 - Robust Traversal Edition)
import os
import argparse
import fnmatch
from collections import defaultdict
import time
import yaml  # 需要 pip install pyyaml
from pathlib import Path

# ==============================================================================
# 核心逻辑 (V7.1)
# ==============================================================================
class ProjectScraper:
    def __init__(self, project_path, output_file, config_path):
        self.project_path = Path(project_path).resolve()
        self.output_file = output_file
        self.config = self._load_config(config_path)
        self.files_by_category = defaultdict(list)
        self.total_files_scanned = 0
        self.max_file_size = self.config.get('max_file_size_kb', 2048) * 1024

    def _log(self, message, indent=0):
        print(f"{'  ' * indent}{message}")

    def _load_config(self, config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            self._log(f"[ERROR] 配置文件未找到: {config_path}", 1)
            exit(1)
        except yaml.YAMLError as e:
            self._log(f"[ERROR] 解析YAML配置文件时出错: {e}", 1)
            exit(1)

    def _is_binary(self, file_path):
        try:
            with open(file_path, 'rb') as f:
                return b'\0' in f.read(1024)
        except IOError:
            return True

    def _is_ignored(self, path_obj: Path):
        relative_path_str = str(path_obj.relative_to(self.project_path)).replace(os.sep, '/')
        for pattern in self.config.get('ignore_patterns', []):
            if fnmatch.fnmatch(relative_path_str, pattern):
                return True
        return False

    def _classify_path(self, path_obj: Path):
        relative_path_str = str(path_obj.relative_to(self.project_path)).replace(os.sep, '/')
        patterns_map = self.config.get('core_file_patterns', {})
        for category, patterns in patterns_map.items():
            for pattern in patterns:
                if fnmatch.fnmatch(relative_path_str, pattern):
                    return category, pattern
        return None, None

    def scrape(self):
        start_time = time.time()
        self._log(f"🚀 [Architect's Insight v7.1] 开始扫描项目: {self.project_path}")
        self._log(f"[*] 使用配置文件: {args.config}", 1)

        # --- KEY CHANGE: Reverted to os.walk for robust directory pruning ---
        for root, dirs, files in os.walk(self.project_path, topdown=True):
            root_path = Path(root)

            # Prune ignored directories IN-PLACE to prevent os.walk from entering them
            original_dirs = list(dirs)
            dirs[:] = [d for d in original_dirs if not self._is_ignored(root_path / d)]

            for file in files:
                self.total_files_scanned += 1
                file_path_obj = root_path / file

                # Final check for files that might be ignored by pattern
                if self._is_ignored(file_path_obj):
                    continue

                category, pattern = self._classify_path(file_path_obj)
                
                if category:
                    try:
                        # Safety checks before processing
                        if file_path_obj.stat().st_size > self.max_file_size:
                            self._log(f"[!] Skipped (too large): {file_path_obj.relative_to(self.project_path)}", 3)
                            continue
                        if self._is_binary(file_path_obj):
                            self._log(f"[!] Skipped (binary): {file_path_obj.relative_to(self.project_path)}", 3)
                            continue

                        self.files_by_category[category].append(file_path_obj)
                    except OSError as e:
                        # Catch any residual access errors on specific files
                        self._log(f"[!] Error stating file {file_path_obj.relative_to(self.project_path)}: {e}", 3)


        self._write_output()
        self._print_summary(time.time() - start_time)

    def _write_output(self):
        self._log(f"[*] 正在聚合关键架构文件...", indent=1)
        with open(self.output_file, 'w', encoding='utf-8', errors='ignore') as out_f:
            category_order = self.config.get('category_order', [])
            
            for category in category_order:
                if category not in self.files_by_category:
                    continue

                self._log(f"Processing category: {category}", indent=2)
                
                sorted_files = sorted(self.files_by_category[category])
                
                for file_path in sorted_files:
                    relative_path_str = str(file_path.relative_to(self.project_path)).replace(os.sep, '/')
                    _, matched_pattern = self._classify_path(file_path)

                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as in_f:
                            content = in_f.read()
                        
                        out_f.write(f"--- START OF FILE {relative_path_str} ---\n")
                        out_f.write(f"# Category: {category}\n")
                        out_f.write(f"# Matched by pattern: {matched_pattern}\n")
                        out_f.write(f"# ---\n")
                        out_f.write(content.strip())
                        out_f.write(f"\n--- END OF FILE {relative_path_str} ---\n\n")
                        self._log(f"[+] Captured: {relative_path_str}", indent=3)

                    except Exception as e:
                        self._log(f"[!] Failed to read {relative_path_str}: {e}", indent=3)

    def _print_summary(self, duration):
        total_captured = sum(len(files) for files in self.files_by_category.values())
        print("\n" + "="*80)
        self._log("✅ [Architect's Insight] 扫描完成!")
        self._log(f"⏱️  耗时: {duration:.2f} 秒")
        self._log(f"📁 扫描文件总数: {self.total_files_scanned}")
        self._log(f"🎯 捕获核心文件数: {total_captured}")
        self._log(f"💾 输出文件: {self.output_file}")
        print("-"*80)
        
        self._log("捕获文件分类统计:")
        category_order = self.config.get('category_order', [])
        for category in category_order:
            if category in self.files_by_category:
                count = len(self.files_by_category[category])
                self._log(f"  - {category}: {count} 个文件", indent=1)
        print("="*80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="V7.1 - Robust Traversal: 对项目进行深度架构扫描，提取关键文件并附加上下文。"
    )
    parser.add_argument(
        "project_path", nargs='?', default='.', 
        help="要扫描的项目根目录路径 (默认为当前目录)。"
    )
    parser.add_argument(
        "--output", default="monorepo_snapshot_architect.txt", 
        help="输出文件的名称。"
    )
    parser.add_argument(
        "--config", default="scraper_config.yaml",
        help="配置文件的路径。"
    )
    
    args = parser.parse_args()
    
    scraper = ProjectScraper(args.project_path, args.output, args.config)
    scraper.scrape()