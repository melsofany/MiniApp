import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Error messages in Arabic
const ERROR_MESSAGES = {
  PARSE_FAILED: "فشل قراءة استجابة الذكاء الاصطناعي. حاول مرة أخرى.",
  EXTRACTION_FAILED: "فشل استخراج البيانات. تأكد أن الصورة واضحة وتحتوي على البطاقة كاملة.",
  NAME_NOT_FOUND: "لم يتم العثور على الاسم كاملاً. تأكد من وضوح الصورة.",
  NATIONAL_ID_NOT_FOUND: "لم يتم العثور على الرقم القومي. تأكد من ظهور الرقم القومي بوضوح في الصورة.",
  NATIONAL_ID_INCOMPLETE: (len: number) => `الرقم القومي غير مكتمل (${len} رقم فقط من 14). التقط صورة أوضح للرقم القومي الكامل.`,
  READ_CARD_FAILED: "فشل قراءة البطاقة. التقط صورة أوضح وحاول مرة أخرى.",
  TIMEOUT: "انتهى الوقت المحدد. حاول مرة أخرى.",
  TIMEOUT_LONG: "العملية استغرقت وقتاً طويلاً. حاول مرة أخرى بصورة أوضح.",
  PROCESSING_FAILED: "فشل معالجة الصورة. تأكد من وضوح الصورة وحاول مرة أخرى.",
  API_KEY_ERROR: "مفتاح API غير صحيح. تأكد من إعداد GEMINI_API_KEY."
};

export interface ExtractedCardData {
  name: string;
  nationalId: string;
}

interface GeminiResponse {
  firstLine: string;
  secondLine: string;
  additionalLines: string[];
  nationalId: string;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * معالجة الصورة قبل إرسالها للذكاء الاصطناعي
 * - تصحيح اتجاه الصورة تلقائياً
 * - تحسين الجودة والوضوح
 * - ضبط السطوع والتباين
 * - تقليل الحجم للسرعة
 */
async function preprocessImage(imageBase64: string): Promise<string> {
  try {
    console.log('🖼️  بدء معالجة الصورة لتحسين قراءة الرقم القومي...');
    
    // تحويل من base64 إلى buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // معالجة الصورة باستخدام Sharp - تحسين خاص لقراءة الأرقام
    const processedBuffer = await sharp(imageBuffer)
      // 1. تصحيح الاتجاه تلقائياً باستخدام بيانات EXIF
      .rotate()
      
      // 2. تحويل لـ grayscale لتحسين قراءة الأرقام بشكل أفضل
      .grayscale()
      
      // 3. ضبط حجم الصورة - الحد الأقصى 1600px للسرعة مع الحفاظ على الجودة
      .resize(1600, 1600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      
      // 4. زيادة الحدة بشكل متوازن لتحسين وضوح الأرقام
      .sharpen({
        sigma: 1.5,  // حدة معتدلة للأرقام
        m1: 1.2,     // مستوى تفاصيل متوازن
        m2: 2.5      // حواف واضحة للأرقام
      })
      
      // 5. تحسين التباين بشكل أقوى لإبراز الأرقام
      .normalize({
        lower: 2,
        upper: 98
      })
      
      // 6. زيادة السطوع والتباين لجعل الأرقام أكثر وضوحاً
      .modulate({
        brightness: 1.1,   // سطوع متوازن
        saturation: 0.8    // تقليل التشبع لجعل الأرقام أوضح
      })
      
      // 7. تحويل إلى JPEG بجودة محسنة للسرعة
      .jpeg({
        quality: 85,       // جودة متوازنة بين الوضوح والسرعة
        progressive: false,
        optimizeScans: false
      })
      
      // تحويل إلى Buffer
      .toBuffer();
    
    // تحويل النتيجة إلى base64
    const processedBase64 = processedBuffer.toString('base64');
    
    const originalSize = (imageBuffer.length / 1024).toFixed(2);
    const processedSize = (processedBuffer.length / 1024).toFixed(2);
    
    console.log('✅ اكتملت معالجة الصورة:');
    console.log('   📏 الحجم الأصلي:', originalSize, 'KB');
    console.log('   📏 الحجم بعد المعالجة:', processedSize, 'KB');
    console.log('   🔄 تصحيح الاتجاه: تلقائي');
    console.log('   ✨ تحسين الجودة: نعم');
    console.log('   🔍 زيادة الحدة: نعم');
    console.log('   ☀️  تحسين السطوع والتباين: نعم');
    
    return processedBase64;
  } catch (error: any) {
    console.error('❌ Image preprocessing error:', error);
    console.warn('⚠️  Will use original image without preprocessing');
    // في حالة الخطأ، نرجع الصورة الأصلية
    return imageBase64;
  }
}

export async function processIdCardImage(imageBase64: string): Promise<ExtractedCardData> {
  try {
    // معالجة الصورة قبل إرسالها للذكاء الاصطناعي
    const processedImageBase64 = await preprocessImage(imageBase64);
    
    const prompt = `استخرج البيانات من البطاقة الشخصية المصرية.

🚨 الرقم القومي (الأهم!):
• 14 رقم بالضبط بدون مسافات
• ابحث عن "الرقم القومي" أو "National ID"
• استخدم أرقام إنجليزية (0-9) فقط - ليس (٠-٩)
• مثال: 29501011234567

الاسم:
• firstLine: السطر الأول تحت كلمة "الاسم"
• secondLine: السطر الثاني
• additionalLines: أسطر إضافية إن وجدت ([] إن لم توجد)

مثال:
{
  "firstLine": "أحمد محمد",
  "secondLine": "حسن علي السيد",
  "additionalLines": [],
  "nationalId": "29501011234567"
}`;

    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            firstLine: { 
              type: "string",
              description: "السطر الأول من الاسم"
            },
            secondLine: { 
              type: "string",
              description: "السطر الثاني من الاسم"
            },
            additionalLines: {
              type: "array",
              items: { type: "string" },
              description: "أسطر إضافية ([] إن لم توجد)"
            },
            nationalId: { 
              type: "string",
              description: "الرقم القومي - 14 رقم إنجليزي بالضبط (0-9)"
            },
          },
          required: ["firstLine", "secondLine", "additionalLines", "nationalId"],
        },
      },
      contents: [
        {
          inlineData: {
            data: processedImageBase64,
            mimeType: "image/jpeg",
          },
        },
        prompt,
      ],
    });

    const response = await withTimeout(
      processPromise, 
      12000,
      ERROR_MESSAGES.TIMEOUT
    );

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error(ERROR_MESSAGES.READ_CARD_FAILED);
    }

    console.log('🔍 استجابة Gemini AI الكاملة:', rawJson);

    let data: GeminiResponse;
    try {
      data = JSON.parse(rawJson);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON from Gemini:', parseError);
      throw new Error(ERROR_MESSAGES.PARSE_FAILED);
    }

    console.log('📋 Extracted data:');
    console.log('  - First line:', data.firstLine || '❌ missing');
    console.log('  - Second line:', data.secondLine || '❌ missing');
    console.log('  - Additional lines:', data.additionalLines || []);
    console.log('  - National ID:', data.nationalId || '❌ missing');

    // التحقق من وجود البيانات المطلوبة
    if (!data.firstLine || !data.secondLine || !data.nationalId) {
      throw new Error(ERROR_MESSAGES.EXTRACTION_FAILED);
    }

    // تنظيف الأسطر
    const firstLine = data.firstLine.trim();
    const secondLine = data.secondLine.trim();
    const additionalLines = (data.additionalLines || [])
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (!firstLine || !secondLine) {
      throw new Error(ERROR_MESSAGES.NAME_NOT_FOUND);
    }

    console.log('\n\n📊 تحليل الأسطر المستخرجة');
    console.log('==============================================');
    console.log('First line (owner name):', firstLine);
    console.log('Word count:', firstLine.split(/\s+/).filter(w => w.length > 0).length);
    console.log('----------------------------------------------');
    console.log('Second line (father + grandfather + family):', secondLine);
    console.log('Word count:', secondLine.split(/\s+/).filter(w => w.length > 0).length);
    
    if (additionalLines.length > 0) {
      console.log('----------------------------------------------');
      console.log('Additional lines:');
      additionalLines.forEach((line, idx) => {
        console.log('  Line', idx + 3, ':', line);
      });
    }
    console.log('==============================================');

    // بناء الاسم الكامل بالترتيب الصحيح
    // الاسم الكامل = السطر الأول + السطر الثاني + أي أسطر إضافية
    const nameParts = [firstLine, secondLine, ...additionalLines];
    const fullName = nameParts.join(' ').trim();

    // تحويل الأرقام العربية الهندية إلى أرقام إنجليزية
    const convertArabicNumeralsToEnglish = (text: string): string => {
      const arabicToEnglishMap: { [key: string]: string } = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
      };
      
      return text.split('').map(char => arabicToEnglishMap[char] || char).join('');
    };

    // تحويل الأرقام العربية إلى إنجليزية ثم تنظيف الرقم القومي
    const convertedNationalId = convertArabicNumeralsToEnglish(data.nationalId);
    const cleanedNationalId = convertedNationalId.replace(/\D/g, '');
    
    console.log('🔢 National ID cleanup:', data.nationalId, '->', cleanedNationalId, '(', cleanedNationalId.length, 'digits)');
    
    if (!cleanedNationalId || cleanedNationalId.length === 0) {
      console.error('❌ National ID is completely empty');
      throw new Error(ERROR_MESSAGES.NATIONAL_ID_NOT_FOUND);
    }
    
    if (cleanedNationalId.length !== 14) {
      console.error('National ID incomplete:', cleanedNationalId.length, 'digits instead of 14');
      throw new Error(ERROR_MESSAGES.NATIONAL_ID_INCOMPLETE(cleanedNationalId.length));
    }

    // التحقق النهائي من عدد الكلمات
    const totalWords = fullName.split(/\s+/).filter(w => w.length > 0).length;
    
    if (totalWords < 2) {
      console.warn('⚠️ Warning: Full name contains only one word - there may be a reading error');
    }

    if (totalWords > 6) {
      console.warn('⚠️ Warning: Full name contains more than 6 words - verify extraction accuracy');
    }

    console.log('\n✅ ✅ ✅ Data extraction successful');
    console.log('==============================================');
    console.log('📝 Full name:', fullName);
    console.log('');
    console.log('👤 Line breakdown:');
    console.log('  • First line:', firstLine);
    console.log('  • Second line:', secondLine);
    if (additionalLines.length > 0) {
      additionalLines.forEach((line, idx) => {
        console.log('  • Line', idx + 3, ':', line);
      });
    }
    console.log('');
    console.log('🆔 National ID:', cleanedNationalId);
    console.log('📊 Total words:', totalWords);
    console.log('==============================================');

    return {
      name: fullName,
      nationalId: cleanedNationalId
    };
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    
    if (error.message && (error.message.includes("timeout") || error.message.includes(ERROR_MESSAGES.TIMEOUT))) {
      throw new Error(ERROR_MESSAGES.TIMEOUT_LONG);
    }
    
    if (error.message && error.message.includes("API key")) {
      throw new Error(ERROR_MESSAGES.API_KEY_ERROR);
    }
    
    throw new Error(error.message || ERROR_MESSAGES.PROCESSING_FAILED);
  }
}
