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
    bot = new TelegramBot(BOT_TOKEN, { 
      polling: {
        interval: 300,
        autoStart: true,
        params: {
          timeout: 10
        }
      }
    });

    bot.on('message', async (msg) => {
      console.log('📨 Received message:', msg.text, 'from user:', msg.from?.id);
      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString();
      const username = msg.from?.username || msg.from?.first_name || 'مستخدم';

      if (!userId) {
        console.log('⚠️ No userId found in message');
        return;
      }

      if (msg.text?.toLowerCase() === '/start') {
        console.log('✓ Processing /start command for user:', userId);
        
        try {
          const rep = await getRepresentativeByUserId(userId);
          console.log('Representative found:', rep ? `${rep.username} (${rep.center})` : 'none');

          if (!rep || rep.status !== 'نشط') {
            console.log('❌ User not authorized or inactive');
            await bot!.sendMessage(
              chatId,
              `❌ عذراً، أنت غير مصرح لك باستخدام هذا البوت.\n\n` +
              `معرف المستخدم: ${userId}\n` +
              `الاسم: ${username}\n\n` +
              `يرجى التواصل مع المسؤول وإرساله هذه المعلومات للحصول على صلاحية الوصول.`
            );
            return;
          }

          const miniAppUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}/mini-app`
            : 'https://yourdomain.replit.app/mini-app';
          
          console.log('✓ Sending welcome message with mini app URL');
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
          console.log('✓ Welcome message sent successfully');
        } catch (error) {
          console.error('Error processing /start command:', error);
          await bot!.sendMessage(
            chatId,
            '❌ حدث خطأ أثناء معالجة الطلب. يرجى المحاولة مرة أخرى.'
          );
        }
      }
    });

    bot.on('polling_error', (error: any) => {
      if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 409) {
        console.warn('⚠ Bot conflict detected (409): Another bot instance is running.');
        console.warn('  Please stop other instances or this bot will not receive messages.');
      } else {
        console.error('Telegram Bot polling error:', error.message || error);
      }
    });

    console.log('✓ Telegram Bot started successfully');
  } catch (error) {
    console.error('Failed to start Telegram Bot:', error);
  }
}

export function getTelegramBot(): TelegramBot | null {
  return bot;
}
