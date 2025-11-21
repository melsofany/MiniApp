import cron from 'node-cron';

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const REPLIT_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

const SELF_URL = WEBHOOK_URL 
  || (REPLIT_DOMAIN ? `https://${REPLIT_DOMAIN}` : 'http://localhost:5000');

export function initKeepAlive() {
  if (!WEBHOOK_URL && !REPLIT_DOMAIN) {
    console.log('⚠ No WEBHOOK_URL or REPLIT_DEV_DOMAIN set - keep-alive disabled for localhost');
    return;
  }

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

  const urlType = WEBHOOK_URL ? 'WEBHOOK_URL' : 'REPLIT_DEV_DOMAIN';
  console.log(`✓ Keep-alive system initialized using ${urlType} (pings every 5 minutes)`);
  console.log(`  Target URL: ${SELF_URL}`);
}
