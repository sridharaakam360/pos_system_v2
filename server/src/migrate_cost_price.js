import db from './config/database.js';

async function migrate() {
    try {
        console.log('Checking products table...');
        const text = 'ALTER TABLE products ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0';
        await db.query(text);
        console.log('Added cost_price column successfully.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('cost_price column already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    }
    process.exit();
}

migrate();
