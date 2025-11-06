import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ProcessingOverlay from './ProcessingOverlay.vue';

// Mock the UI store
vi.mock('@/stores/ui.store', () => ({
  useUIStore: vi.fn(),
}));

import { useUIStore } from '@/stores/ui.store';
import { reactive } from 'vue';

describe('ProcessingOverlay', () => {
  let mockUIStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockUIStore = reactive({
      isProcessing: false,
    });
    useUIStore.mockReturnValue(mockUIStore);
  });

  it('should not render when not processing', () => {
    mockUIStore.isProcessing = false;

    const wrapper = mount(ProcessingOverlay);

    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('should render when processing', () => {
    mockUIStore.isProcessing = true;

    const wrapper = mount(ProcessingOverlay);

    expect(wrapper.text()).toBe('处理中...');
    expect(wrapper.attributes('id')).toBe('processing-overlay');
    expect(wrapper.attributes('style')).toBe('display: flex;');
  });

  it('should be reactive to store changes', async () => {
    mockUIStore.isProcessing = false;

    const wrapper = mount(ProcessingOverlay);

    expect(wrapper.html()).toBe('<!--v-if-->');

    mockUIStore.isProcessing = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toBe('处理中...');
  });
});
