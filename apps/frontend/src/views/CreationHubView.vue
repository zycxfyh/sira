<!-- 文件路径: src/views/CreationHubView.vue (事件驱动版) -->
<template>
  <div v-if="!activePath" class="page active">
    <div class="center-content" style="justify-content: flex-start; padding-top: 2rem">
      <h2>创世协议：三叉路口</h2>
      <p>请选择您希望如何开始您的旅程。</p>
      <div class="nexus-main-layout" style="align-items: stretch">
        <div class="nexus-panel">
          <h3>体验一个故事</h3>
          <p style="flex-grow: 1">从一个简单的想法开始，让AI为您构建整个世界和角色。</p>
          <div class="button primary" @click="activePath = 'narrative'">选择此路径</div>
        </div>
        <!-- [注释] 其他创世路径，例如角色驱动，可以在这里添加 -->
        <!-- <div class="nexus-panel"> ... </div> -->
      </div>
      <div class="button-group" style="justify-content: center">
        <router-link to="/nexus" class="button">返回中枢</router-link>
      </div>
    </div>
  </div>

  <NarrativeDrivenPath
    v-else-if="activePath === 'narrative'"
    @back="resetToPathSelection"
    @start-creation="handleStartCreation"
  />
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
// import { useUIStore } from '@/stores/ui.store'; // 暂时未使用
import { useJobsStore } from '@/stores/jobs.store'; // [核心] 导入任务控制中心
import { useToast } from '@/composables/useToast';
import { apiService } from '@/services/api.service'; // [核心] 直接使用apiService
import NarrativeDrivenPath from '@/components/creation/NarrativeDrivenPath.vue';

const activePath = ref(null);
const router = useRouter();
// const uiStore = useUIStore(); // 暂时未使用，未来可能用于UI状态管理
const jobsStore = useJobsStore(); // [核心] 获取任务控制中心实例
const { show: showToast } = useToast();

/**
 * [核心重构] handleStartCreation 不再等待，而是派发任务
 */
async function handleStartCreation(creationData) {
  // [注释] 我们不再需要全局的 isProcessing 遮罩，因为创世现在是后台任务
  // uiStore.isProcessing = true;

  // 1. 创建一个唯一的任务ID
  const jobId = `creation_${Date.now()}`;

  try {
    if (activePath.value === 'narrative') {
      // 2. 在任务控制中心注册这个新任务
      jobsStore.addJob({
        id: jobId,
        name: `创建新世界: "${creationData.concept.substring(0, 20)}..."`,
      });
      showToast('创世请求已发送，AI正在后台为您构建新世界...', 'info');

      // 3. 异步派发API请求，我们不关心它的直接返回值
      await apiService.games.createNarrative({
        concept: creationData.concept,
        // [核心] 我们将任务ID也传递给后端，以便后端可以在事件中返回它
        _jobId: jobId,
      });

      // 4. 请求发送后，立即返回主菜单，用户无需等待
      router.push('/nexus');
    }
  } catch (error) {
    // 只有在API请求发送本身失败时，才会进入这里
    const friendlyMessage = error.message || '发送创世请求失败';
    showToast(`创世失败: ${friendlyMessage}`, 'error');
    // 如果失败，从任务列表中移除
    jobsStore.removeJob(jobId);
  }
  // [注释] finally 块不再需要了
}

function resetToPathSelection() {
  activePath.value = null;
}
</script>
