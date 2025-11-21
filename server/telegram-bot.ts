import TelegramBot from 'node-telegram-bot-api';
import { getRepresentativeByUserId } from './services/google-sheets';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

let bot: TelegramBot | null = null;

export function initTelegramBot() {
  if (!BOT_TOKEN) {
    console.warn('⚠ TELEGRAM_BOT_TOKEN not found. Bot will not start.');
    return;
  }

  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString();
      const username = msg.from?.username || msg.from?.first_name || 'مستخدم';

      if (!userId) {
        return;
      }

      if (msg.text === '/start') {
        const rep = await getRepresentativeByUserId(userId);

        if (!rep || rep.status !== 'نشط') {
          await bot!.sendMessage(
            chatId,
            '❌ عذراً، أنت غير مصرح لك باستخدام هذا البوت.\n\nيرجى التواصل مع المسؤول للحصول على صلاحية الوصول.'
          );
          return;
        }

        const miniAppUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}/mini-app`
          : 'https://yourdomain.replit.app/mini-app';
        
        await bot!.sendMessage(
          chatId,
          `مرحباً ${username}! 👋\n\n` +
          `أنت مصرح لك باستخدام نظام معالجة البطاقات.\n` +
          `المركز: ${rep.center}\n\n` +
          `اضغط على الزر أدناه لفتح التطبيق وبدء التقاط البطاقات.`,
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '📸 فتح التطبيق',
                  web_app: { url: miniAppUrl }
                }
              ]]
            }
          }
        );
      }
    });

    bot.on('polling_error', (error) => {
      console.error('Telegram Bot polling error:', error);
    });

    console.log('✓ Telegram Bot started successfully');
  } catch (error) {
    console.error('Failed to start Telegram Bot:', error);
  }
}

export function getTelegramBot(): TelegramBot | null {
  return bot;
}
