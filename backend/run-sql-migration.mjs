import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function showMigrationSQL() {
    console.log('📋 SQL Migration for Supabase SQL Editor');
    console.log('=========================================');
    console.log('');

    // Read migration file
    const migrationFile = 'migrations/002_add_first_time_column.sql';
    const migrationPath = path.join(__dirname, migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Copy and paste this SQL into your Supabase SQL Editor:');
    console.log('');
    console.log('```sql');
    console.log(migrationSQL);
    console.log('```');
    console.log('');
    console.log('After running this SQL, your users table will have the first_time column.');
}

showMigrationSQL().catch(console.error);
