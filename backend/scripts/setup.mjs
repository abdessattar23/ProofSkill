#!/usr/bin/env node

/**
 * ProofSkill Database Setup Helper
 * 
 * This script helps you set up your Supabase database and environment variables.
 * Run this after creating your Supabase project.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_TEMPLATE = `# ProofSkill Backend Environment Variables
# Copy this file to .env and fill in your actual values

# Server Configuration
PORT=4000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production

# API Key for development (change in production)
API_KEY=abdeldroid@456789

# Supabase Configuration
# Get these from your Supabase project settings
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Google AI (Gemini) Configuration
# Get from Google AI Studio: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your-gemini-api-key-here

# ElevenLabs Configuration (for TTS)
# Get from: https://elevenlabs.io/app/settings/api-keys
ELEVENLABS_API_KEY=your-elevenlabs-api-key-here

# Redis Configuration (optional, for caching)
REDIS_URL=redis://localhost:6379
`;

function createEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    
    // Create .env.example if it doesn't exist
    if (!fs.existsSync(envExamplePath)) {
        fs.writeFileSync(envExamplePath, ENV_TEMPLATE);
        console.log('✅ Created .env.example file');
    }
    
    // Create .env if it doesn't exist
    if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, ENV_TEMPLATE);
        console.log('✅ Created .env file');
        console.log('🔧 Please edit .env file with your actual values');
    } else {
        console.log('ℹ️  .env file already exists');
    }
}

function showInstructions() {
    console.log('\n🎯 ProofSkill Database Setup Instructions\n');
    
    console.log('1. Create a Supabase Project:');
    console.log('   - Go to https://supabase.com');
    console.log('   - Create a new project');
    console.log('   - Note your project URL and service role key\n');
    
    console.log('2. Configure Environment Variables:');
    console.log('   - Edit the .env file with your Supabase credentials');
    console.log('   - Add your Google AI (Gemini) API key');
    console.log('   - Add your ElevenLabs API key (optional, for TTS)\n');
    
    console.log('3. Run Database Migration:');
    console.log('   - Go to your Supabase project dashboard');
    console.log('   - Navigate to SQL Editor');
    console.log('   - Copy and run the SQL from: migrations/001_create_users_table.sql\n');
    
    console.log('4. Test the Setup:');
    console.log('   - Run: npm run dev');
    console.log('   - Run: node final-workflow-test.mjs');
    console.log('   - Check that all endpoints work\n');
    
    console.log('📋 Required Environment Variables:');
    console.log('   ✅ JWT_SECRET - For user authentication');
    console.log('   ✅ SUPABASE_URL - Your Supabase project URL');
    console.log('   ✅ SUPABASE_SERVICE_KEY - Your Supabase service role key');
    console.log('   ⚠️  GEMINI_API_KEY - For AI features (CV parsing, interviews)');
    console.log('   ⚠️  ELEVENLABS_API_KEY - For text-to-speech features\n');
    
    console.log('🔍 How to get API keys:');
    console.log('   - Supabase: Project Settings > API > service_role key');
    console.log('   - Gemini: https://makersuite.google.com/app/apikey');
    console.log('   - ElevenLabs: https://elevenlabs.io/app/settings/api-keys\n');
}

function checkCurrentSetup() {
    const envPath = path.join(__dirname, '..', '.env');
    
    if (!fs.existsSync(envPath)) {
        console.log('❌ No .env file found');
        return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
    const optionalVars = ['GEMINI_API_KEY', 'ELEVENLABS_API_KEY'];
    
    console.log('🔍 Checking current setup:\n');
    
    let allRequired = true;
    
    for (const varName of requiredVars) {
        const hasVar = envContent.includes(`${varName}=`) && 
                      !envContent.includes(`${varName}=your-`) && 
                      !envContent.includes(`${varName}=https://your-`);
        console.log(`   ${hasVar ? '✅' : '❌'} ${varName} ${hasVar ? '(configured)' : '(missing or template)'}`);
        if (!hasVar) allRequired = false;
    }
    
    console.log('\n⚠️  Optional variables:');
    for (const varName of optionalVars) {
        const hasVar = envContent.includes(`${varName}=`) && 
                      !envContent.includes(`${varName}=your-`);
        console.log(`   ${hasVar ? '✅' : '⚠️ '} ${varName} ${hasVar ? '(configured)' : '(not configured)'}`);
    }
    
    console.log('');
    
    if (allRequired) {
        console.log('✅ All required environment variables are configured!');
        console.log('🚀 You can now run: npm run dev');
    } else {
        console.log('❌ Some required environment variables are missing');
        console.log('🔧 Please edit your .env file');
    }
    
    return allRequired;
}

function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    console.log('🎯 ProofSkill Database Setup Helper\n');
    
    switch (command) {
        case 'init':
            createEnvFile();
            showInstructions();
            break;
        case 'check':
            checkCurrentSetup();
            break;
        case 'help':
        default:
            console.log('Available commands:');
            console.log('  npm run setup init   - Create .env files and show setup instructions');
            console.log('  npm run setup check  - Check current environment configuration');
            console.log('  npm run setup help   - Show this help message\n');
            
            if (command !== 'help') {
                console.log('Running initial setup...\n');
                createEnvFile();
                showInstructions();
            }
            break;
    }
}

main();
