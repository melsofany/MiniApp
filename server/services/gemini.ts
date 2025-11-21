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
    console.log('🖼️  بدء معالجة الصورة...');
    
    // تحويل من base64 إلى buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // معالجة الصورة باستخدام Sharp
    const processedBuffer = await sharp(imageBuffer)
      // 1. تصحيح الاتجاه تلقائياً باستخدام بيانات EXIF
      .rotate()
      
      // 2. تحويل لـ grayscale لتحسين قراءة النص (اختياري)
      // .grayscale()
      
      // 3. ضبط حجم الصورة - الحد الأقصى 2000px للعرض (يحافظ على نسبة العرض للارتفاع)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true
      })
      
      // 4. زيادة الحدة (sharpness) لتحسين قراءة النص
      .sharpen({
        sigma: 1.5,  // مقدار الحدة
        m1: 1.0,     // مستوى التفاصيل
        m2: 2.0      // الحواف
      })
      
      // 5. تحسين التباين (contrast)
      .normalize({
        lower: 1,
        upper: 99
      })
      
      // 6. ضبط السطوع والتباين بشكل يدوي
      .modulate({
        brightness: 1.1,  // زيادة السطوع بنسبة 10%
        saturation: 0.9   // تقليل التشبع قليلاً
      })
      
      // 7. تحويل إلى JPEG بجودة عالية
      .jpeg({
        quality: 95,
        progressive: true,
        optimizeScans: true
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

الهيكل المطلوب لاستخراج الاسم:
📌 البطاقة المصرية تعرض الاسم في منطقة "الاسم" أو "Name" على النحو التالي:

┌─────────────────────────────┐
│ الاسم / Name                │
│ ┌─────────────────────────┐ │
│ │ السطر الأول (في الأعلى) │ │  ← اسم الشخص فقط (1-2 كلمة)
│ │ السطر الثاني            │ │  ← اسم الأب + الجد + العائلة (2-4 كلمات)
│ │ (قد يوجد سطر ثالث)      │ │  ← تكملة الأسماء (نادراً)
│ └─────────────────────────┘ │
└─────────────────────────────┘

أمثلة توضيحية:

═══════════════════════════════════════════════════════════
مثال 1: بطاقة تحتوي على سطرين
═══════════════════════════════════════════════════════════
البطاقة تعرض:
┌──────────────────┐
│ الاسم            │
│ أحمد محمد        │  ← السطر الأول (اسم الشخص فقط)
│ حسن علي السيد    │  ← السطر الثاني (اسم الأب + الجد + العائلة)
└──────────────────┘
الرقم القومي: 29501011234567

يجب استخراج:
{
  "firstLine": "أحمد محمد",
  "secondLine": "حسن علي السيد",
  "additionalLines": [],
  "nationalId": "29501011234567"
}

الاسم الكامل النهائي = "أحمد محمد حسن علي السيد"
(السطر الأول + السطر الثاني)

═══════════════════════════════════════════════════════════
مثال 2: بطاقة تحتوي على ثلاثة أسطر
═══════════════════════════════════════════════════════════
البطاقة تعرض:
┌──────────────────┐
│ Name             │
│ فاطمة            │  ← السطر الأول (اسم الشخص فقط)
│ حسن سعيد         │  ← السطر الثاني (اسم الأب + الجد)
│ محمد عبدالله     │  ← السطر الثالث (تكملة الاسم - العائلة)
└──────────────────┘
National No: 29612051234567

يجب استخراج:
{
  "firstLine": "فاطمة",
  "secondLine": "حسن سعيد",
  "additionalLines": ["محمد عبدالله"],
  "nationalId": "29612051234567"
}

الاسم الكامل النهائي = "فاطمة حسن سعيد محمد عبدالله"
(السطر الأول + السطر الثاني + السطر الثالث)

═══════════════════════════════════════════════════════════
مثال 3: اسم مركب في السطر الأول
═══════════════════════════════════════════════════════════
البطاقة تعرض:
┌──────────────────┐
│ الاسم            │
│ محمد علي         │  ← السطر الأول
│ أحمد حسن صالح    │  ← السطر الثاني
└──────────────────┘
رقم قومي: 30105251234567  ← 14 رقم

يجب استخراج:
{
  "firstLine": "محمد علي",
  "secondLine": "أحمد حسن صالح",
  "additionalLines": [],
  "nationalId": "30105251234567"
}

═══════════════════════════════════════════════════════════
مثال 4: أمثلة لأرقام قومية صحيحة
═══════════════════════════════════════════════════════════
✅ أمثلة لأرقام قومية صحيحة (14 رقم):
• 29501011234567
• 30105251234567
• 29612051234567
• 28803141234567

❌ أمثلة خاطئة (لا تفعل هذا):
• 2950101123456 (13 رقم فقط - ناقص)
• 295 010 112 345 67 (يحتوي على مسافات)
• ID: 29501011234567 (يحتوي على نص)

🎯 المطلوب: 14 رقم فقط بدون مسافات أو نصوص
═══════════════════════════════════════════════════════════

تعليمات الاستخراج:

🔴 خطوة 1: استخراج الاسم
1️⃣ ابحث عن منطقة الاسم المكتوب عليها "الاسم" أو "Name"
2️⃣ اقرأ السطر الأول تحت هذه المنطقة (اسم الشخص فقط) وضعه في firstLine
3️⃣ اقرأ السطر الثاني مباشرةً تحت السطر الأول (اسم الأب + الجد + العائلة) وضعه في secondLine
4️⃣ إذا كان هناك سطر ثالث أو أكثر، ضعهم في additionalLines

🔴 خطوة 2: استخراج الرقم القومي (مهم جداً!)
5️⃣ ابحث عن الرقم القومي - قد يكون بجانب أحد هذه الكلمات:
   - "الرقم القومي" أو "رقم قومي"
   - "National ID" أو "National No"
   - "ID Number" أو "رقم"
6️⃣ الرقم القومي دائماً مكون من 14 رقم متتالية
7️⃣ اقرأ كل الأرقام ال 14 بدقة وبدون أخطاء
8️⃣ ضع فقط الأرقام في nationalId (بدون مسافات أو رموز)

⚠️ ملاحظات مهمة جداً:
- السطر الأول = اسم الشخص فقط (1-2 كلمة) - مثل: "أحمد" أو "فاطمة" أو "محمد علي"
- السطر الثاني = اسم الأب أولاً، ثم الجد، ثم العائلة (2-4 كلمات) - مثل: "حسن علي السيد"
- السطر الأول لا يحتوي على اسم الأب - فقط اسم الشخص نفسه
- الرقم القومي يتكون من 14 رقم فقط (مثل: 29501011234567)
- تأكد من قراءة كل الأرقام ال 14 بدقة تامة


    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            firstLine: { 
              type: "string",
              description: "السطر الأول من اسم البطاقة - اسم الشخص فقط الموجود في الأعلى (1-2 كلمة عادةً) - لا يحتوي على اسم الأب"
            },
            secondLine: { 
              type: "string",
              description: "السطر الثاني من اسم البطاقة مباشرةً تحت السطر الأول - يبدأ باسم الأب ثم الجد ثم العائلة (2-4 كلمات عادةً)"
            },
            additionalLines: {
              type: "array",
              items: { type: "string" },
              description: "أسطر إضافية إن وجدت (السطر الثالث والرابع إلخ). إذا لم يكن هناك أسطر إضافية، أرجع مصفوفة فارغة []"
            },
            nationalId: { 
              type: "string",
              description: "الرقم القومي المكون من 14 رقم بالضبط - استخرج كل الأرقام بدقة. مثال: 29501011234567 أو 30105251234567. أرقام فقط بدون مسافات أو رموز. يجب أن يكون 14 رقم بالضبط"
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
      30000,
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

    // تنظيف الرقم القومي
    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
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
