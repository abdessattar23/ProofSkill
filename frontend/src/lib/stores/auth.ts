import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { apiClient } from '$lib/api/client';

interface User {
    id: string;
    email: string;
    name?: string;
    role?: string;
    first_time?: boolean;
}

interface AuthState {
    user: User | null;
    loading: boolean;
    token: string | null;
    initialized: boolean;
}

const initialState: AuthState = {
    user: null,
    loading: true, // Start with loading true to prevent premature redirects
    token: browser ? localStorage.getItem('token') : null,
    initialized: false
};

export const auth = writable(initialState);

export const authActions = {
    setLoading: (loading: boolean) => {
        auth.update(state => ({ ...state, loading }));
    },

    setUser: (user: User | null, token?: string) => {
        auth.update(state => ({
            ...state,
            user,
            token: token || state.token,
            loading: false,
            initialized: true
        }));
        if (browser && token) {
            localStorage.setItem('token', token);
        }
    },

    logout: () => {
        auth.set({ user: null, loading: false, token: null, initialized: true });
        if (browser) {
            localStorage.removeItem('token');
        }
    },

    async register(userData: {
        email: string;
        password: string;
        name?: string;
        role?: string;
    }): Promise<{ success: boolean; error?: string }> {
        authActions.setLoading(true);

        try {
            const response = await apiClient.register(userData);

            if (response.success && response.token) {
                // If registration returns a token (auto-login), use it
                authActions.setUser(response.user || null, response.token);
                return { success: true };
            } else if (response.success) {
                // Registration successful but need to login separately
                auth.update(state => ({ ...state, loading: false, initialized: true }));
                return { success: true };
            } else {
                auth.update(state => ({ ...state, loading: false, initialized: true }));
                return { success: false, error: response.error || 'Registration failed' };
            }
        } catch (error) {
            auth.update(state => ({ ...state, loading: false, initialized: true }));
            return { success: false, error: 'Network error' };
        }
    },

    async login(credentials: {
        email: string;
        password: string;
    }): Promise<{ success: boolean; error?: string }> {
        authActions.setLoading(true);

        try {
            const response = await apiClient.login(credentials);

            if (response.success && response.token) {
                authActions.setUser(response.user || null, response.token);
                return { success: true };
            } else {
                auth.update(state => ({ ...state, loading: false, initialized: true }));
                return { success: false, error: response.error || 'Login failed' };
            }
        } catch (error) {
            auth.update(state => ({ ...state, loading: false, initialized: true }));
            return { success: false, error: 'Network error' };
        }
    },

    async fetchMe(): Promise<void> {
        const currentState = get(auth);

        // If no token, mark as initialized and not loading
        if (!currentState.token) {
            console.log('No token found, marking as initialized');
            auth.update(state => ({ ...state, loading: false, initialized: true }));
            return;
        }

        console.log('Starting auth initialization...');
        auth.update(state => ({ ...state, loading: true }));

        try {
            console.log('Fetching user data...');
            const response = await apiClient.getMe();
            console.log('Auth response:', response);

            if (response.success && response.data && response.data.user) {
                console.log('User authenticated successfully:', response.data.user);
                authActions.setUser(response.data.user);
            } else {
                console.log('Auth failed, clearing token');
                // Token is invalid, clear auth
                authActions.logout();
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);

            // Clear auth on any error
            auth.update(state => ({
                ...state,
                loading: false,
                initialized: true,
                user: null,
                token: null
            }));
            if (browser) {
                localStorage.removeItem('token');
            }
        }
    }
};

// Helper to get current state
function get(store: any) {
    let value: any;
    store.subscribe((val: any) => value = val)();
    return value;
}
