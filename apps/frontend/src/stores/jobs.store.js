// 文件路径: src/stores/jobs.store.js

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useJobsStore = defineStore('jobs', () => {
  /**
   * @type {import('vue').Ref<Array<import('./jobs.store').Job>>}
   */
  const jobs = ref([]);

  /**
   * @typedef {object} Job
   * @property {string} id - 任务的唯一ID
   * @property {string} name - 任务的可读名称，例如 "创建新世界"
   * @property {'pending' | 'success' | 'failed'} status - 任务的当前状态
   * @property {string | null} [error] - 如果任务失败，存储错误信息
   * @property {number} createdAt - 任务创建时的时间戳
   */

  /**
   * 计算属性，返回所有仍在进行中的任务
   */
  const pendingJobs = computed(() =>
    jobs.value.filter((job) => job.status === 'pending'),
  );

  /**
   * 添加一个新任务到列表中
   * @param {Omit<Job, 'createdAt' | 'status'>} jobData
   */
  function addJob(jobData) {
    const newJob = {
      ...jobData,
      status: 'pending',
      createdAt: Date.now(),
    };
    jobs.value.unshift(newJob); // 将新任务添加到列表顶部
  }

  /**
   * 更新一个已存在任务的状态或其他信息
   * @param {string} jobId
   * @param {Partial<Job>} updates
   */
  function updateJob(jobId, updates) {
    const job = jobs.value.find((j) => j.id === jobId);
    if (job) {
      Object.assign(job, updates);
    }
  }

  /**
   * 从列表中移除一个任务（通常在用户关闭通知时调用）
   * @param {string} jobId
   */
  function removeJob(jobId) {
    jobs.value = jobs.value.filter((j) => j.id !== jobId);
  }

  /**
   * 清除所有已完成或失败的任务
   */
  function clearCompletedJobs() {
    jobs.value = jobs.value.filter((j) => j.status === 'pending');
  }

  return {
    jobs,
    pendingJobs,
    addJob,
    updateJob,
    removeJob,
    clearCompletedJobs,
  };
});