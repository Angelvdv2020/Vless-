const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function initDatabase() {
  const client = await pool.connect();

  try {
    console.log('🔄 Initializing Noryx Premium VPN database...');

    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );

    await client.query(schemaSQL);

    console.log('✅ Database initialized successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - subscriptions');
    console.log('   - vpn_keys');
    console.log('   - vpn_configs');
    console.log('   - connection_logs');
    console.log('   - available_countries');
    console.log('   - site_content');
    console.log('   - site_content_versions');
    console.log('   - ai_generation_logs');

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase().catch(console.error);
}

module.exports = { initDatabase };
