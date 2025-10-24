# project_scraper.py (v7.0 - Blueprint Edition)
import os
import argparse
import fnmatch
from collections import defaultdict
import time

# ==============================================================================
# 核心配置文件：定义了架构的“蓝图”
# ==============================================================================

class ScraperConfig:
    """
    配置经过精简，只关注定义项目结构、关系和契约的核心文件。
    """
    # 输出顺序优化，优先展示高层设计
    CATEGORY_ORDER = [
        "1_ARCHITECTURE_META",
        "2_ORCHESTRATION_AND_CONFIG",
        "3_DATABASE_SCHEMA",
        "4_AI_PROMPTS",
        "5_BACKEND_WIRING",
        "6_FRONTEND_WIRING",
    ]

    # 精简后的核心文件模式定义
    CORE_FILE_PATTERNS = {
        # 1. 顶层设计文档
        "1_ARCHITECTURE_META": [
            '框架.txt',
            'README.md', # 只捕获根目录的README
        ],
        # 2. 顶层编排与核心配置
        "2_ORCHESTRATION_AND_CONFIG": [
            'docker-compose.yml',
            'apps/frontend/Dockerfile',
            'apps/backend/apps/*/Dockerfile',
            'package.json',
            'pnpm-workspace.yaml',
            'tsconfig.json',
            'nest-cli.json',
            'turbo.json',
        ],
        # 3. 数据库骨架
        "3_DATABASE_SCHEMA": [
            'apps/backend/prisma/schema.prisma',
        ],
        # 4. AI 的“源代码” - 核心智能所在
        "4_AI_PROMPTS": [
            'libs/common/src/prompts/**/*.md',
        ],
        # 5. 后端“接线图” (模块、控制器、网关)
        # [核心简化] 故意排除了 '/**/*.service.ts'，因为我们更关注模块如何连接，而非其内部实现
        "5_BACKEND_WIRING": [
            'apps/backend/apps/*/src/main.ts',
            'apps/backend/apps/**/src/**/*.module.ts',
            'apps/backend/apps/**/src/**/*.controller.ts',
            'apps/backend/apps/**/src/**/*.gateway.ts',
        ],
        # 6. 前端核心结构
        "6_FRONTEND_WIRING": [
            'apps/frontend/src/main.js',
            'apps/frontend/src/router/index.js',
            'apps/frontend/src/stores/*.store.js',
            'apps/frontend/src/services/api.service.js'
        ],
    }

    # 忽略列表保持健壮
    IGNORE_PATTERNS = [
        'node_modules/*', '.git/*', 'dist/*', 'build/*', 'coverage/*',
        '.vscode/*', '.idea/*', '__pycache__/*', 'dist-ssr/*', '.turbo/*',
        'playwright-report/*', 'test-results/*', 'nexus-data/*',
        '*.lock', '*.log', '.DS_Store', 'Thumbs.db',
        'monorepo_snapshot*.txt', 'project_snapshot*.txt',
        '想法/*',
        '**/node_modules/**/*.md' # 进一步确保不捕获依赖中的文档
    ]

# ==============================================================================
# 爬虫主逻辑 (与 v6.0 保持一致, 无需修改)
# ==============================================================================

class ProjectScraper:
    def __init__(self, project_path, output_file, config):
        self.project_path = os.path.abspath(project_path)
        self.output_file = output_file
        self.config = config
        self.files_by_category = defaultdict(list)
        self.total_files_scanned = 0

    def _log(self, message, indent=0):
        print(f"{'  ' * indent}{message}")

    def _is_ignored(self, path):
        path = path.replace(os.sep, '/')
        return any(fnmatch.fnmatch(path, pattern) for pattern in self.config.IGNORE_PATTERNS)

    def _classify_path(self, relative_path):
        path = relative_path.replace(os.sep, '/')
        for category, patterns in self.config.CORE_FILE_PATTERNS.items():
            if any(fnmatch.fnmatch(path, pattern) for pattern in patterns):
                return category
        return None

    def scrape(self):
        start_time = time.time()
        self._log(f"🚀 [Blueprint Scraper] 开始扫描项目架构蓝图: {self.project_path}")

        for root, dirs, files in os.walk(self.project_path, topdown=True):
            # 过滤掉整个被忽略的目录树
            rel_root = os.path.relpath(root, self.project_path)
            if rel_root == '.': rel_root = ''
            
            dirs[:] = [d for d in dirs if not self._is_ignored(os.path.join(rel_root, d, ''))]
            
            for file in files:
                self.total_files_scanned += 1
                relative_path = os.path.join(rel_root, file)
                
                if self._is_ignored(relative_path):
                    continue
                
                category = self._classify_path(relative_path)
                if category:
                    self.files_by_category[category].append(relative_path)
        
        self._write_output()
        self._print_summary(time.time() - start_time)

    def _write_output(self):
        self._log(f"[*] 正在聚合架构蓝图文件...", indent=1)
        with open(self.output_file, 'w', encoding='utf-8', errors='ignore') as out_f:
            out_f.write(f"--- START OF FILE monorepo_snapshot_blueprint.txt ---\n\n")
            for category in self.config.CATEGORY_ORDER:
                if category not in self.files_by_category:
                    continue

                self._log(f"Processing category: {category}", indent=2)
                
                for relative_path in sorted(self.files_by_category[category]):
                    file_path = os.path.join(self.project_path, relative_path)
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as in_f:
                            content = in_f.read()
                        
                        out_f.write(f"--- START OF FILE {relative_path} ---\n")
                        out_f.write(content)
                        out_f.write(f"\n--- END OF FILE {relative_path} ---\n\n")
                        self._log(f"[+] Captured: {relative_path}", indent=3)
                    except Exception as e:
                        self._log(f"[!] Failed to read {relative_path}: {e}", indent=3)
            
            out_f.write(f"--- END OF FILE monorepo_snapshot_blueprint.txt ---\n")


    def _print_summary(self, duration):
        total_captured = sum(len(files) for files in self.files_by_category.values())
        
        print("\n" + "="*80)
        self._log("✅ [Blueprint Scraper] 扫描完成!")
        self._log(f"⏱️  耗时: {duration:.2f} 秒")
        self._log(f"📁 扫描文件总数: {self.total_files_scanned}")
        self._log(f"🎯 捕获蓝图文件数: {total_captured}")
        self._log(f"💾 输出文件: {self.output_file}")
        print("-"*80)
        
        self._log("捕获文件分类统计:")
        for category in self.config.CATEGORY_ORDER:
            if category in self.files_by_category:
                count = len(self.files_by_category[category])
                self._log(f"  - {category}: {count} 个文件", indent=1)
        print("="*80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="V7.0 - Blueprint Edition: 对项目进行高层级架构扫描，只提取蓝图文件。"
    )
    parser.add_argument(
        "project_path", nargs='?', default='.', 
        help="要扫描的项目根目录路径 (默认为当前目录)。"
    )
    parser.add_argument(
        "--output", default="monorepo_snapshot_blueprint.txt", 
        help="输出文件的名称。"
    )
    
    args = parser.parse_args()
    
    scraper = ProjectScraper(args.project_path, args.output, ScraperConfig)
    scraper.scrape()