import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    // Load environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file');
        process.exit(1);
    }

    console.log('🔧 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_users_table.sql');
    
    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📦 Running database migration...');
    
    try {
        // Split SQL into individual statements and execute them
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        let successCount = 0;
        let skipCount = 0;

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    const { error } = await supabase.rpc('exec_sql', { sql: statement });
                    
                    if (error) {
                        // Check if it's a "already exists" error which is fine
                        if (error.message?.includes('already exists') || 
                            error.message?.includes('duplicate key')) {
                            skipCount++;
                            console.log(`⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
                        } else {
                            console.error(`❌ Error executing statement: ${statement.substring(0, 50)}...`);
                            console.error('Error:', error.message);
                        }
                    } else {
                        successCount++;
                        console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
                    }
                } catch (err) {
                    console.error(`❌ Exception executing statement: ${statement.substring(0, 50)}...`);
                    console.error('Exception:', err.message);
                }
            }
        }

        console.log(`\n🎉 Migration completed!`);
        console.log(`   ✅ ${successCount} statements executed successfully`);
        console.log(`   ⚠️  ${skipCount} statements skipped (already exists)`);
        
        // Test the migration by checking if users table exists
        console.log('\n🔍 Verifying migration...');
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error('❌ Verification failed:', error.message);
        } else {
            console.log('✅ Users table exists and is accessible');
            console.log(`   Found ${data?.length || 0} users in the database`);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

// Run migration if this file is executed directly
if (process.argv[1] === __filename) {
    runMigration().catch(console.error);
}

export { runMigration };
