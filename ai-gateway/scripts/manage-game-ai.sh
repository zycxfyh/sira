#!/bin/bash

# Sira AI网关 - 游戏AI管理脚本
# 管理游戏AI功能，包括NPC对话、任务生成、故事推进等

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_PORT=${ADMIN_PORT:-9876}
ADMIN_HOST=${ADMIN_HOST:-localhost}

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_header() {
    echo -e "${PURPLE}================================================${NC}"
    echo -e "${PURPLE} $1 ${NC}"
    echo -e "${PURPLE}================================================${NC}"
}

# 检查依赖
check_dependencies() {
    local missing_deps=()

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少必要的依赖: ${missing_deps[*]}"
        log_info "请安装缺失的依赖:"
        echo "  Ubuntu/Debian: sudo apt-get install ${missing_deps[*]}"
        echo "  CentOS/RHEL: sudo yum install ${missing_deps[*]}"
        echo "  macOS: brew install ${missing_deps[*]}"
        exit 1
    fi
}

# 检查服务是否运行
check_service() {
    log_info "检查网关服务状态..."

    if ! curl -s --max-time 5 "http://$ADMIN_HOST:$ADMIN_PORT/game/sessions" > /dev/null; then
        log_error "网关服务未运行或不可访问 (http://$ADMIN_HOST:$ADMIN_HOST)"
        log_info "请确保网关服务正在运行: npm run start:dev"
        exit 1
    fi

    log_success "网关服务运行正常"
}

# 发送API请求
api_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    local url="http://$ADMIN_HOST:$ADMIN_PORT/$endpoint"

    if [ "$method" = "GET" ]; then
        curl -s -X GET "$url"
    elif [ "$method" = "POST" ]; then
        curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data"
    elif [ "$method" = "PUT" ]; then
        curl -s -X PUT "$url" \
            -H "Content-Type: application/json" \
            -d "$data"
    elif [ "$method" = "DELETE" ]; then
        curl -s -X DELETE "$url"
    fi
}

# 显示游戏统计
show_game_stats() {
    log_header "🎮 游戏AI统计信息"

    local response
    response=$(api_request "GET" "game/stats")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取游戏统计失败"
        return 1
    fi

    local stats
    stats=$(echo "$response" | jq -r '.data.stats')

    echo "📊 全局统计:"
    echo "  总会话数: $(echo "$stats" | jq -r '.totalSessions')"
    echo "  活跃会话数: $(echo "$stats" | jq -r '.activeSessions')"
    echo "  总角色数: $(echo "$stats" | jq -r '.totalCharacters')"
    echo "  总任务数: $(echo "$stats" | jq -r '.totalQuests')"
    echo ""

    echo "🎲 会话类型分布:"
    echo "$stats" | jq -r '.sessionTypes | to_entries[] | "  \(.key): \(.value)"'
    echo ""

    echo "📍 角色位置分布:"
    echo "$stats" | jq -r '.characterLocations | to_entries[] | "  \(.key): \(.value)"'
    echo ""

    echo "⭐ 任务难度分布:"
    echo "$stats" | jq -r '.questDifficulties | to_entries[] | "  \(.key): \(.value)"'
}

# 创建游戏会话
create_game_session() {
    log_header "🎮 创建游戏会话"

    echo -n "玩家名称 (默认: 冒险者): "
    read -r player_name
    player_name=${player_name:-"冒险者"}

    echo -n "游戏类型 (adventure/rpg/fantasy，默认: adventure): "
    read -r game_type
    game_type=${game_type:-"adventure"}

    echo -n "玩家职业 (warrior/mage/rogue，默认: warrior): "
    read -r player_class
    player_class=${player_class:-"warrior"}

    echo -n "玩家等级 (默认: 1): "
    read -r player_level
    player_level=${player_level:-1}

    echo -n "当前场景 (默认: village): "
    read -r current_scene
    current_scene=${current_scene:-"village"}

    local request_data="{
        \"gameType\": \"$game_type\",
        \"playerName\": \"$player_name\",
        \"playerClass\": \"$player_class\",
        \"playerLevel\": $player_level,
        \"currentScene\": \"$current_scene\"
    }"

    local response
    response=$(api_request "POST" "game/sessions" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "创建游戏会话失败"
        return 1
    fi

    local session_id
    session_id=$(echo "$response" | jq -r '.data.sessionId')

    log_success "✅ 游戏会话创建成功!"
    echo "会话ID: $session_id"
    echo "玩家: $player_name"
    echo "职业: $player_class"
    echo "等级: $player_level"
    echo "场景: $current_scene"
}

# 创建NPC角色
create_character() {
    log_header "👤 创建NPC角色"

    echo -n "角色名称: "
    read -r char_name

    echo -n "性格特点 (如: 睿智、善良、神秘): "
    read -r personality

    echo -n "背景故事: "
    read -r background

    echo -n "当前位置 (默认: village): "
    read -r location
    location=${location:-"village"}

    if [ -z "$char_name" ] || [ -z "$personality" ]; then
        log_error "角色名称和性格特点都是必需的"
        return 1
    fi

    local request_data="{
        \"name\": \"$char_name\",
        \"personality\": \"$personality\",
        \"background\": \"$background\",
        \"location\": \"$location\"
    }"

    local response
    response=$(api_request "POST" "game/characters" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "创建NPC角色失败"
        return 1
    fi

    local char_id
    char_id=$(echo "$response" | jq -r '.data.characterId')

    log_success "✅ NPC角色创建成功!"
    echo "角色ID: $char_id"
    echo "名称: $char_name"
    echo "性格: $personality"
    echo "位置: $location"
}

# NPC对话测试
test_npc_dialogue() {
    log_header "💬 NPC对话测试"

    echo -n "会话ID: "
    read -r session_id

    echo -n "角色ID: "
    read -r character_id

    echo -n "玩家输入: "
    read -r player_input

    echo -n "场景描述 (可选): "
    read -r scene_desc

    if [ -z "$session_id" ] || [ -z "$character_id" ] || [ -z "$player_input" ]; then
        log_error "会话ID、角色ID和玩家输入都是必需的"
        return 1
    fi

    local request_data="{
        \"sessionId\": \"$session_id\",
        \"characterId\": \"$character_id\",
        \"playerInput\": \"$player_input\""

    if [ -n "$scene_desc" ]; then
        request_data="$request_data, \"sceneDescription\": \"$scene_desc\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "POST" "game/npc-chat" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "NPC对话生成失败"
        return 1
    fi

    local dialogue
    dialogue=$(echo "$response" | jq -r '.data.dialogue')

    log_success "✅ NPC对话生成成功!"

    echo ""
    echo "🎭 对话结果:"
    echo "角色: $(echo "$dialogue" | jq -r '.characterName')"
    echo "关系: $(echo "$dialogue" | jq -r '.relationship')"
    echo ""
    echo "💬 NPC回应:"
    echo "$(echo "$dialogue" | jq -r '.response')"
}

# 生成游戏任务
generate_quest() {
    log_header "🎯 生成游戏任务"

    echo -n "会话ID: "
    read -r session_id

    echo -n "游戏类型 (adventure/rpg/fantasy，默认: adventure): "
    read -r genre
    genre=${genre:-"adventure"}

    echo -n "任务难度 (简单/中等/困难，默认: 中等): "
    read -r difficulty
    difficulty=${difficulty:-"中等"}

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    local request_data="{
        \"sessionId\": \"$session_id\",
        \"genre\": \"$genre\",
        \"difficulty\": \"$difficulty\"
    }"

    local response
    response=$(api_request "POST" "game/generate-quest" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "生成游戏任务失败"
        return 1
    fi

    local quest
    quest=$(echo "$response" | jq -r '.data.quest')

    log_success "✅ 游戏任务生成成功!"

    echo ""
    echo "🎯 任务详情:"
    echo "任务ID: $(echo "$quest" | jq -r '.id')"
    echo "标题: $(echo "$quest" | jq -r '.title')"
    echo "难度: $(echo "$quest" | jq -r '.difficulty')"
    echo "状态: $(echo "$quest" | jq -r '.status')"
    echo ""
    echo "📝 任务描述:"
    echo "$(echo "$quest" | jq -r '.description')"
}

# 推进故事
advance_story() {
    log_header "📖 故事推进"

    echo -n "会话ID: "
    read -r session_id

    echo -n "玩家选择: "
    read -r player_choice

    echo -n "当前故事状态 (可选): "
    read -r current_story

    echo -n "故事背景 (可选): "
    read -r background

    if [ -z "$session_id" ] || [ -z "$player_choice" ]; then
        log_error "会话ID和玩家选择都是必需的"
        return 1
    fi

    local request_data="{
        \"sessionId\": \"$session_id\",
        \"playerChoice\": \"$player_choice\""

    if [ -n "$current_story" ]; then
        request_data="$request_data, \"currentStory\": \"$current_story\""
    fi

    if [ -n "$background" ]; then
        request_data="$request_data, \"background\": \"$background\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "POST" "game/advance-story" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "故事推进失败"
        return 1
    fi

    local story_result
    story_result=$(echo "$response" | jq -r '.data.storyResult')

    log_success "✅ 故事推进成功!"

    echo ""
    echo "📖 新故事片段:"
    echo "$(echo "$story_result" | jq -r '.storySegment')"
    echo ""

    local choices
    choices=$(echo "$story_result" | jq -r '.choices[]')
    if [ -n "$choices" ]; then
        echo "🎯 新的选择:"
        echo "$choices" | sed 's/^/  • /'
    fi
}

# 更新世界状态
update_world_state() {
    log_header "🌍 更新世界状态"

    echo -n "会话ID: "
    read -r session_id

    echo -n "玩家行动: "
    read -r player_action

    echo -n "当前世界状态 (可选): "
    read -r current_state

    echo -n "影响范围 (可选): "
    read -r impact_scope

    if [ -z "$session_id" ] || [ -z "$player_action" ]; then
        log_error "会话ID和玩家行动都是必需的"
        return 1
    fi

    local request_data="{
        \"sessionId\": \"$session_id\",
        \"playerAction\": \"$player_action\""

    if [ -n "$current_state" ]; then
        request_data="$request_data, \"currentState\": \"$current_state\""
    fi

    if [ -n "$impact_scope" ]; then
        request_data="$request_data, \"impactScope\": \"$impact_scope\""
    fi

    request_data="$request_data}"

    local response
    response=$(api_request "POST" "game/world-state" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "更新世界状态失败"
        return 1
    fi

    local world_update
    world_update=$(echo "$response" | jq -r '.data.worldUpdate')

    log_success "✅ 世界状态更新成功!"

    echo ""
    echo "🌍 世界变化:"
    echo "$(echo "$world_update" | jq -r '.worldState')"
}

# 查看会话详情
view_session_details() {
    log_header "📋 游戏会话详情"

    echo -n "会话ID: "
    read -r session_id

    if [ -z "$session_id" ]; then
        log_error "会话ID是必需的"
        return 1
    fi

    local response
    response=$(api_request "GET" "game/sessions/$session_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取会话详情失败"
        return 1
    fi

    local session
    session=$(echo "$response" | jq -r '.data.session')

    echo "会话ID: $session_id"
    echo "游戏类型: $(echo "$session" | jq -r '.gameType')"
    echo "玩家: $(echo "$session" | jq -r '.playerName')"
    echo "职业: $(echo "$session" | jq -r '.playerClass')"
    echo "等级: $(echo "$session" | jq -r '.playerLevel')"
    echo "当前场景: $(echo "$session" | jq -r '.currentScene')"
    echo "活跃任务数: $(echo "$session" | jq -r '.activeQuests | length')"
    echo "创建时间: $(echo "$session" | jq -r '.createdAt')"
    echo "最后活动: $(echo "$session" | jq -r '.lastActivity')"
}

# 查看角色详情
view_character_details() {
    log_header "👤 NPC角色详情"

    echo -n "角色ID: "
    read -r character_id

    echo -n "会话ID (用于查看记忆): "
    read -r session_id

    if [ -z "$character_id" ]; then
        log_error "角色ID是必需的"
        return 1
    fi

    # 获取角色基本信息
    local response
    response=$(api_request "GET" "game/characters/$character_id")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "获取角色详情失败"
        return 1
    fi

    local character
    character=$(echo "$response" | jq -r '.data.character')

    echo "角色ID: $character_id"
    echo "名称: $(echo "$character" | jq -r '.name')"
    echo "性格: $(echo "$character" | jq -r '.personality')"
    echo "位置: $(echo "$character" | jq -r '.location')"
    echo "创建时间: $(echo "$character" | jq -r '.createdAt')"
    echo "最后互动: $(echo "$character" | jq -r '.lastInteraction // "从未互动"')"
    echo ""

    # 获取角色记忆（如果提供了会话ID）
    if [ -n "$session_id" ]; then
        local memory_response
        memory_response=$(api_request "GET" "game/character/$character_id/memory?sessionId=$session_id")

        if echo "$memory_response" | jq -e '.success' >/dev/null 2>&1; then
            local memory
            memory=$(echo "$memory_response" | jq -r '.data.memory')

            echo "💭 角色记忆:"
            echo "与玩家关系: $(echo "$memory" | jq -r '.relationship')"
            echo "对话历史: $(echo "$memory" | jq -r '.recentInteractions | length') 条"
            echo "记忆事件: $(echo "$memory" | jq -r '.memory | length') 个"
        fi
    fi
}

# 快速开始游戏
quick_start_game() {
    log_header "🚀 快速开始游戏"

    echo -n "玩家名称 (默认: 冒险者): "
    read -r player_name
    player_name=${player_name:-"冒险者"}

    echo -n "游戏类型 (adventure/rpg/fantasy，默认: adventure): "
    read -r game_type
    game_type=${game_type:-"adventure"}

    echo -n "玩家职业 (warrior/mage/rogue，默认: warrior): "
    read -r player_class
    player_class=${player_class:-"warrior"}

    local request_data="{
        \"playerName\": \"$player_name\",
        \"gameType\": \"$game_type\",
        \"playerClass\": \"$player_class\"
    }"

    local response
    response=$(api_request "POST" "game/quick-start" "$request_data")

    if ! echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        log_error "快速开始游戏失败"
        return 1
    fi

    local data
    data=$(echo "$response" | jq -r '.data')

    log_success "✅ 游戏快速启动成功!"

    echo ""
    echo "🎮 会话信息:"
    echo "会话ID: $(echo "$data" | jq -r '.session.id')"
    echo "玩家: $(echo "$data" | jq -r '.session.playerName')"
    echo "职业: $(echo "$data" | jq -r '.session.playerClass')"
    echo ""

    echo "👤 初始角色:"
    echo "角色ID: $(echo "$data" | jq -r '.character.id')"
    echo "名称: $(echo "$data" | jq -r '.character.name')"
    echo ""

    echo "💬 初始对话:"
    echo "$(echo "$data" | jq -r '.initialDialogue.response')"
}

# 显示使用示例
show_examples() {
    log_header "💡 使用示例"

    cat << 'EOF'
🔥 热门使用场景:

1. 🚀 快速开始游戏
   curl -X POST http://localhost:9876/game/quick-start \
     -H "Content-Type: application/json" \
     -d '{
       "playerName": "小明",
       "gameType": "fantasy",
       "playerClass": "mage"
     }'

2. 💬 NPC对话交互
   curl -X POST http://localhost:9876/game/npc-chat \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "game_session_xxx",
       "characterId": "character_xxx",
       "playerInput": "你好，我需要一些帮助",
       "sceneDescription": "村庄中央的旅馆中"
     }'

3. 🎯 生成游戏任务
   curl -X POST http://localhost:9876/game/generate-quest \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "game_session_xxx",
       "genre": "奇幻冒险",
       "difficulty": "中等"
     }'

4. 📖 故事剧情推进
   curl -X POST http://localhost:9876/game/advance-story \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "game_session_xxx",
       "playerChoice": "进入森林深处探索",
       "currentStory": "主角在村庄遇到神秘旅人"
     }'

5. 🌍 更新世界状态
   curl -X POST http://localhost:9876/game/world-state \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "game_session_xxx",
       "playerAction": "击败了森林里的怪物",
       "impactScope": "村庄及周边地区"
     }'

6. 👤 查看角色记忆
   curl http://localhost:9876/game/character/character_xxx/memory?sessionId=game_session_xxx

✨ 高级功能:

7. 🎮 创建自定义会话
   curl -X POST http://localhost:9876/game/sessions \
     -H "Content-Type: application/json" \
     -d '{
       "gameType": "rpg",
       "playerName": "艾丽丝",
       "playerClass": "warrior",
       "playerLevel": 5,
       "currentScene": "castle"
     }'

8. 👥 创建NPC角色
   curl -X POST http://localhost:9876/game/characters \
     -H "Content-Type: application/json" \
     -d '{
       "name": "贤者梅林",
       "personality": "睿智、神秘、乐于助人",
       "background": "一位古老的魔法师，掌握强大的法术",
       "location": "magic_tower"
     }'

9. 📊 查看游戏统计
   curl http://localhost:9876/game/stats

10. 💾 导出游戏数据
    curl -X POST http://localhost:9876/game/export \
      -H "Content-Type: application/json"

🎲 游戏场景建议:
• 奇幻冒险: 魔法森林、古老城堡、地下迷宫
• 科幻探索: 太空站、外星遗迹、未来城市
• 武侠江湖: 古代城镇、山林道观、神秘山洞
• 现代都市: 高楼大厦、地下实验室、虚拟现实空间

EOF
}

# 显示帮助信息
show_help() {
    cat << 'EOF'
Sira AI网关 - 游戏AI管理脚本

用法:
    ./manage-game-ai.sh [选项]

选项:
    -s, --stats        显示游戏AI统计信息
    -c, --create       创建新的游戏会话
    -n, --npc          创建NPC角色
    -t, --talk         测试NPC对话
    -q, --quest        生成游戏任务
    -a, --advance      推进游戏故事
    -w, --world        更新世界状态
    -v, --view         查看详情 (会话/角色)
    -q, --quick        快速开始游戏
    -m, --examples     显示使用示例
    -h, --help         显示此帮助信息

快速开始:
    # 查看统计信息
    ./manage-game-ai.sh --stats

    # 快速开始游戏
    ./manage-game-ai.sh --quick

    # 创建会话和角色
    ./manage-game-ai.sh --create
    ./manage-game-ai.sh --npc

    # 开始对话
    ./manage-game-ai.sh --talk

    # 查看使用示例
    ./manage-game-ai.sh --examples

游戏概念:
    会话(Session): 游戏的实例，包含玩家状态和游戏进度
    角色(Character): NPC角色，具有性格、记忆和对话能力
    任务(Quest): 游戏任务，具有目标、奖励和难度
    故事(Story): 游戏剧情，可以通过玩家选择推进
    世界(World): 游戏世界状态，会随玩家行动变化

支持的游戏类型:
    adventure - 冒险游戏
    rpg       - 角色扮演游戏
    fantasy   - 奇幻游戏

EOF
}

# 主函数
main() {
    log_header "🎮 Sira AI网关 - 游戏AI管理工具"

    # 检查依赖
    check_dependencies

    # 检查服务状态
    check_service

    # 参数处理
    case "${1:-}" in
        -s|--stats)
            show_game_stats
            ;;
        -c|--create)
            create_game_session
            ;;
        -n|--npc)
            create_character
            ;;
        -t|--talk)
            test_npc_dialogue
            ;;
        -q|--quest)
            generate_quest
            ;;
        -a|--advance)
            advance_story
            ;;
        -w|--world)
            update_world_state
            ;;
        -v|--view)
            echo -n "查看类型 (session/character): "
            read -r view_type
            case "$view_type" in
                session)
                    view_session_details
                    ;;
                character)
                    view_character_details
                    ;;
                *)
                    log_error "无效的查看类型"
                    ;;
            esac
            ;;
        -k|--quick)
            quick_start_game
            ;;
        -m|--examples)
            show_examples
            ;;
        -h|--help|*)
            show_help
            ;;
    esac

    log_success "🎉 游戏AI管理任务完成"
}

# 执行主函数
main "$@"
