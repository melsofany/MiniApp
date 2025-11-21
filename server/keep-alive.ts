import cron from 'node-cron';

const SELF_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : 'http://localhost:5000';

export function initKeepAlive() {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const response = await fetch(`${SELF_URL}/api/ping`);
      if (response.ok) {
        console.log('✓ Keep-alive ping successful:', new Date().toISOString());
      } else {
        console.warn('⚠ Keep-alive ping failed:', response.status);
      }
    } catch (error) {
      console.error('Keep-alive error:', error);
    }
  });

  console.log('✓ Keep-alive system initialized (pings every 5 minutes)');
}
