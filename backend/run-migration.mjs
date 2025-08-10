import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSpecificMigration() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
        process.exit(1);
    }

    console.log('🔧 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get migration file from command line argument or use default
    const migrationFile = process.argv[2] || 'migrations/002_add_first_time_column.sql';
    const migrationPath = path.join(__dirname, migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(`📦 Running migration: ${migrationFile}`);
    console.log('SQL:', migrationSQL.substring(0, 200) + '...');
    
    try {
        // Since we can't use exec_sql RPC, let's try to add the column by attempting to insert 
        // and catching the error to see if the column exists
        console.log('🔧 Attempting to add first_time column...');
        
        // First, let's check if the column already exists by trying to select it
        const { data: existingData, error: selectError } = await supabase
            .from('users')
            .select('first_time')
            .limit(1);
            
        if (selectError && selectError.message.includes('column "first_time" does not exist')) {
            console.log('❌ Column does not exist, need to add it manually');
            console.log('Please run this SQL in your Supabase SQL Editor:');
            console.log('');
            console.log(migrationSQL);
            console.log('');
            console.log('After running the SQL, restart this script.');
            process.exit(1);
        } else if (selectError) {
            console.error('❌ Error checking column:', selectError.message);
            process.exit(1);
        } else {
            console.log('✅ Column first_time already exists!');
        }

        // Verify we can access the column
        console.log('\n🔍 Verifying migration...');
        const { data: tableInfo, error: infoError } = await supabase
            .from('users')
            .select('id, email, role, first_time')
            .limit(1);
        
        if (infoError) {
            console.error('❌ Verification failed:', infoError.message);
        } else {
            console.log('✅ Users table is accessible with first_time column');
            if (tableInfo && tableInfo.length > 0) {
                console.log('Sample user:', tableInfo[0]);
            }
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runSpecificMigration().catch(console.error);
