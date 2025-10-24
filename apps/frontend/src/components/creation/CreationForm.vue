<!-- 文件路径: src/components/creation/CreationForm.vue -->
<script setup>
import { ref } from 'vue';

// --- 组件状态定义 ---
// 1. 用于双向绑定的核心概念 ref
const coreConceptInput = ref('');

// 2. 用于控制当前显示哪个 Tab 的 ref
const activeTab = ref('concept'); // 'concept' or 'params'

// 3. 用于绑定参数滑块值的 ref
const worldParams = ref({
  chaos: 50,    // 混乱度 (0-100)
  magic: 50,    // 魔法浓度 (0-100)
  tech: 50,     // 科技水平 (0-100)
});

// 4. 定义组件可以向父组件发出的事件
const emit = defineEmits(['back', 'start-creation']);

// --- 事件处理函数 ---
// 5. 点击“生成世界”按钮时触发
function onStartClick() {
  if (coreConceptInput.value.trim()) {
    // 将核心概念和世界参数一起打包，通过事件传递给父组件
    const creationData = {
      concept: coreConceptInput.value.trim(),
      params: worldParams.value
    };
    emit('start-creation', creationData);
  } else {
    // 在未来的步骤中，我们会用 uiService.showToast 替换 alert
    alert('核心概念不能为空！');
  }
}
</script>

<template>
  <div class="page active">
    <div class="center-content" style="justify-content: flex-start; padding-top: 2rem; text-align: left; align-items: stretch;">
      <h2>叙事驱动路径：构建你的世界</h2>
      <p>输入一个核心概念，并微调世界的初始参数。AI 将基于您的设定构建一个独特的初始世界。</p>
      
      <!-- Tab 切换按钮 -->
      <div class="tabs">
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'concept' }"
          @click="activeTab = 'concept'"
        >
          核心概念
        </button>
        <button 
          class="tab-button" 
          :class="{ active: activeTab === 'params' }"
          @click="activeTab = 'params'"
        >
          世界参数
        </button>
      </div>

      <!-- Tab 内容区域 -->
      <div class="step-content" style="margin-top: 2rem; flex-grow: 1;">
        <!-- 核心概念 Tab -->
        <div v-show="activeTab === 'concept'" class="tab-content active">
          <label for="core-concept-input">请输入你的想法、一个场景或一段描述：</label>
          <textarea 
            id="core-concept-input" 
            v-model="coreConceptInput" 
            rows="10" 
            placeholder="例如：在一个由巨大真菌构成的森林里，地精部落正与神秘的孢子生物争夺生存空间..."
          ></textarea>
        </div>

        <!-- 世界参数 Tab -->
        <div v-show="activeTab === 'params'" class="tab-content active">
          <p>调整这些参数会影响世界的基调和可能性。</p>
          <div class="param-slider-group">
            <label for="chaos-slider">混乱度 (秩序 vs 混乱): {{ worldParams.chaos }}</label>
            <input type="range" id="chaos-slider" min="0" max="100" v-model="worldParams.chaos">
          </div>
          <div class="param-slider-group">
            <label for="magic-slider">魔法浓度 (低魔 vs 高魔): {{ worldParams.magic }}</label>
            <input type="range" id="magic-slider" min="0" max="100" v-model="worldParams.magic">
          </div>
          <div class="param-slider-group">
            <label for="tech-slider">科技水平 (原始 vs 未来): {{ worldParams.tech }}</label>
            <input type="range" id="tech-slider" min="0" max="100" v-model="worldParams.tech">
          </div>
        </div>
      </div>

      <!-- 底部按钮组 -->
      <div class="button-group">
        <div class="button" @click="emit('back')">返回选择路径</div>
        <div class="button primary" @click="onStartClick">生成世界并降临</div>
      </div>
    </div>
  </div>
</template>