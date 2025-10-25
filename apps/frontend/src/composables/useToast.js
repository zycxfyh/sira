// 文件路径: src/composables/useToast.js

/**
 * 一个显示 Toast 通知的组合式函数。
 * 返回一个包含 show 方法的对象。
 */
export function useToast() {
    
    /**
     * 具体的显示逻辑。
     * @param {string} message - 显示的消息
     * @param {'info' | 'success' | 'error'} [type='info'] - 通知的类型
     * @param {number} [duration=3000] - 显示时长 (毫秒)
     */
    function show(message, type = 'info', duration = 3000) {
        // 我们假设 toast-container 元素存在于 index.html 中
        const container = document.getElementById('toast-container');
        if (!container) {
            console.error('Toast container with id "toast-container" not found in the DOM.');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        const animationDuration = 500; // 动画时长 0.5s
        toast.style.animation = `toast-fade-in ${animationDuration}ms forwards, toast-fade-out ${animationDuration}ms ${duration}ms forwards`;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, duration + animationDuration);
    }

    // 返回一个包含 show 方法的对象，这是组合式函数的标准模式
    return { show };
}