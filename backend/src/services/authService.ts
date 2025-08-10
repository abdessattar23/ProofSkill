import { getSupabase } from '../lib/supabase';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

export interface User {
    id: string;
    email: string;
    name?: string;
    password_hash: string;
    role: string;
    first_time: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateUserData {
    email: string;
    name?: string;
    password: string;
    role?: string;
}

export interface LoginData {
    email: string;
    password: string;
}

class AuthService {
    private supabase = getSupabase();

    // Hash password using bcrypt
    private async hashPassword(password: string): Promise<string> {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    // Verify password
    private async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }

    // Create new user
    async createUser(userData: CreateUserData): Promise<{ success: boolean; user?: Omit<User, 'password_hash'>; error?: string }> {
        try {
            const { email, password, role = 'user', name } = userData;

            // Check if user already exists
            const { data: existingUser } = await this.supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            if (existingUser) {
                return { success: false, error: 'User already exists' };
            }

            // Hash password
            const password_hash = await this.hashPassword(password);
            const id = crypto.randomUUID();

            // Insert user
            const { data, error } = await this.supabase
                .from('users')
                .insert({
                    id,
                    email,
                    name,
                    password_hash,
                    role,
                    first_time: role === 'candidate', // Set first_time true for candidates, false for others
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select('id, email, name, role, first_time, created_at, updated_at')
                .single();

            if (error) {
                console.error('Database error creating user:', error);
                return { success: false, error: 'Failed to create user' };
            }

            return { success: true, user: data };
        } catch (error) {
            console.error('Error creating user:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    // Authenticate user
    async authenticateUser(loginData: LoginData): Promise<{ success: boolean; user?: Omit<User, 'password_hash'>; error?: string }> {
        try {
            const { email, password } = loginData;

            // Get user with password hash
            const { data: user, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !user) {
                return { success: false, error: 'Invalid credentials' };
            }

            // Verify password
            const isValid = await this.verifyPassword(password, user.password_hash);
            if (!isValid) {
                return { success: false, error: 'Invalid credentials' };
            }

            // Return user without password hash
            const { password_hash, ...userWithoutPassword } = user;
            return { success: true, user: userWithoutPassword };
        } catch (error) {
            console.error('Error authenticating user:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    // Get user by ID with candidate profile if applicable
    async getUserById(id: string): Promise<{ success: boolean; user?: Omit<User, 'password_hash'> & { profile?: any }; error?: string }> {
        try {
            const { data: user, error } = await this.supabase
                .from('users')
                .select('id, email, name, role, first_time, created_at, updated_at')
                .eq('id', id)
                .single();

            if (error || !user) {
                return { success: false, error: 'User not found' };
            }

            // If user is a candidate, fetch their profile data
            let profile = null;
            if (user.role === 'candidate') {
                const { data: candidateProfile } = await this.supabase
                    .from('candidates')
                    .select('id, name, email, phone, raw_cv_text, skills, experience, parsed_data, created_at, updated_at')
                    .eq('email', user.email)
                    .maybeSingle();

                if (candidateProfile) {
                    // Fetch validated skills
                    const { data: validatedSkills } = await this.supabase
                        .from('candidate_skills')
                        .select('skill, score')
                        .eq('candidate_id', candidateProfile.id);

                    profile = {
                        ...candidateProfile,
                        validated_skills: validatedSkills || []
                    };
                }
            }

            return { success: true, user: { ...user, profile } };
        } catch (error) {
            console.error('Error getting user:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    // Get user by email
    async getUserByEmail(email: string): Promise<{ success: boolean; user?: Omit<User, 'password_hash'>; error?: string }> {
        try {
            const { data: user, error } = await this.supabase
                .from('users')
                .select('id, email, name, role, first_time, created_at, updated_at')
                .eq('email', email)
                .single();

            if (error || !user) {
                return { success: false, error: 'User not found' };
            }

            return { success: true, user };
        } catch (error) {
            console.error('Error getting user:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    // Update user role
    async updateUserRole(id: string, role: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({
                    role,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) {
                console.error('Error updating user role:', error);
                return { success: false, error: 'Failed to update user role' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating user role:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    // Mark profile as complete (set first_time to false)
    async markProfileComplete(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await this.supabase
                .from('users')
                .update({
                    first_time: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) {
                console.error('Error marking profile complete:', error);
                return { success: false, error: 'Failed to mark profile complete' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error marking profile complete:', error);
            return { success: false, error: 'Internal server error' };
        }
    }

    // Delete user
    async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await this.supabase
                .from('users')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting user:', error);
                return { success: false, error: 'Failed to delete user' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, error: 'Internal server error' };
        }
    }
}

export const authService = new AuthService();
