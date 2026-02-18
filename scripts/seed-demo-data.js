const pool = require('../src/database/db');
const crypto = require('crypto');

/**
 * Seed demo data for testing
 * Creates a demo user with an active subscription
 */
async function seedDemoData() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding demo data...');

    // Create demo user
    const passwordHash = crypto
      .createHash('sha256')
      .update('demo123')
      .digest('hex');

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      ['demo@noryx.com', passwordHash]
    );

    const userId = userResult.rows[0].id;
    console.log(`✅ Demo user created (ID: ${userId})`);
    console.log('   Email: demo@noryx.com');
    console.log('   Password: demo123');

    // Create active subscription (expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const subscriptionResult = await client.query(
      `INSERT INTO subscriptions (user_id, plan_type, status, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, 'monthly', 'active', expiresAt]
    );

    const subscriptionId = subscriptionResult.rows[0].id;
    console.log(`✅ Active subscription created (ID: ${subscriptionId})`);
    console.log(`   Plan: monthly`);
    console.log(`   Expires: ${expiresAt.toISOString()}`);

    console.log('\n🎉 Demo data seeded successfully!');
    console.log('\n📝 You can now test with:');
    console.log('   User ID: ' + userId);
    console.log('   curl -X POST http://localhost:3000/api/vpn/connect \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log(`     -d '{"userId":${userId},"countryCode":"auto"}'`);

  } catch (error) {
    console.error('❌ Error seeding demo data:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoData().catch(console.error);
}

module.exports = { seedDemoData };
