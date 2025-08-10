#!/usr/bin/env node

import { Command } from 'commander';
import { migrationManager } from '../lib/migrations';
import { seedSkillTaxonomy } from '../services/skillTaxonomy';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
    .name('proofskill-db')
    .description('ProofSkill Database Management CLI')
    .version('1.0.0');

// Migration commands
program
    .command('migrate')
    .description('Run pending migrations')
    .action(async () => {
        try {
            await migrationManager.migrate();
            process.exit(0);
        } catch (error: any) {
            console.error('Migration failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('rollback')
    .description('Rollback the last migration')
    .action(async () => {
        try {
            await migrationManager.rollback();
            process.exit(0);
        } catch (error: any) {
            console.error('Rollback failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('status')
    .description('Show migration status')
    .action(async () => {
        try {
            await migrationManager.status();
            process.exit(0);
        } catch (error: any) {
            console.error('Status check failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('create <name>')
    .description('Create a new migration')
    .action(async (name: string) => {
        try {
            const filepath = await migrationManager.createMigration(name);
            console.log(`Migration created at: ${filepath}`);
            process.exit(0);
        } catch (error: any) {
            console.error('Migration creation failed:', error.message);
            process.exit(1);
        }
    });

// Seed commands
program
    .command('seed:skills')
    .description('Seed skill taxonomy data')
    .action(async () => {
        try {
            console.log('Seeding skill taxonomy...');
            const result = await seedSkillTaxonomy();
            console.log(`✓ Seeded ${result.skills} skills and ${result.aliases} aliases`);
            process.exit(0);
        } catch (error: any) {
            console.error('Seeding failed:', error.message);
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse();
