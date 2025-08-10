import { writable } from 'svelte/store';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,

        push: (message: string, options: { type?: Toast['type']; duration?: number } = {}) => {
            const id = Math.random().toString(36).substr(2, 9);
            const toast: Toast = {
                id,
                message,
                type: options.type || 'info',
                duration: options.duration || 4000
            };

            update(toasts => [...toasts, toast]);

            // Auto remove toast
            if (toast.duration && toast.duration > 0) {
                setTimeout(() => {
                    toastStore.dismiss(id);
                }, toast.duration);
            }

            return id;
        },

        dismiss: (id: string) => {
            update(toasts => toasts.filter(t => t.id !== id));
        },

        clear: () => {
            update(() => []);
        }
    };
}

export const toastStore = createToastStore();
