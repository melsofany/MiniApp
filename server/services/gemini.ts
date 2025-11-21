import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedCardData {
  name: string;
  nationalId: string;
}

interface GeminiResponse {
  firstNameLine: string;
  secondNameLine: string;
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

export async function processIdCardImage(imageBase64: string): Promise<ExtractedCardData> {
  try {
    const prompt = `أنت خبير في قراءة البطاقات الشخصية المصرية.

⚠️ تعليمات مهمة جداً:

في البطاقة الشخصية المصرية، الاسم الكامل مكتوب على سطرين:

✅ السطر الأول (في الأعلى): اسم صاحب البطاقة فقط
   - مثال: "محمد" أو "فاطمة" أو "أحمد" أو "علي"
   - هذا هو اسم الشخص صاحب البطاقة

✅ السطر الثاني (تحت السطر الأول مباشرة): باقي الاسم الكامل
   - يبدأ باسم الأب، ثم الجد، ثم العائلة
   - مثال: "علي محمود حسن" أو "سعيد أحمد عبدالله"

📋 مثال كامل:
إذا كان مكتوب في البطاقة:
محمد
علي محمود حسن

فهذا يعني:
- السطر الأول: "محمد" (اسم صاحب البطاقة)
- السطر الثاني: "علي محمود حسن" (اسم الأب والجد والعائلة)
- الاسم الكامل: "محمد علي محمود حسن"

🎯 المطلوب منك:
1. اقرأ السطر الأول بالضبط كما هو مكتوب (firstNameLine) - لا تحذف منه شيء
2. اقرأ السطر الثاني بالضبط كما هو مكتوب (secondNameLine) - لا تحذف منه شيء
3. استخرج الرقم القومي (14 رقم)

❌ أخطاء شائعة يجب تجنبها:
- لا تدمج السطرين في سطر واحد
- لا تأخذ جزء من السطر وتترك جزء
- لا تبدل السطرين
- السطر الأول هو دائماً في الأعلى (اسم صاحب البطاقة)
- السطر الثاني هو دائماً في الأسفل (اسم الأب والجد والعائلة)`;

    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            firstNameLine: { 
              type: "string",
              description: "السطر الأول من الاسم - اسم صاحب البطاقة فقط بالضبط كما هو مكتوب - مثال: محمد، فاطمة، أحمد، علي"
            },
            secondNameLine: { 
              type: "string",
              description: "السطر الثاني من الاسم - اسم الأب والجد والعائلة بالضبط كما مكتوب - مثال: علي محمود حسن، سعيد أحمد عبدالله"
            },
            nationalId: { 
              type: "string",
              description: "الرقم القومي المكون من 14 رقم فقط - أرقام فقط بدون مسافات"
            },
          },
          required: ["firstNameLine", "secondNameLine", "nationalId"],
        },
      },
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        },
        prompt,
      ],
    });

    const response = await withTimeout(
      processPromise, 
      30000,
      "انتهى الوقت المحدد. حاول مرة أخرى."
    );

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("فشل قراءة البطاقة. التقط صورة أوضح وحاول مرة أخرى.");
    }

    const data: GeminiResponse = JSON.parse(rawJson);

    if (!data.firstNameLine || !data.secondNameLine || !data.nationalId) {
      throw new Error("فشل استخراج البيانات. تأكد أن الصورة واضحة وتحتوي على البطاقة كاملة.");
    }

    // دمج السطرين لتكوين الاسم الكامل
    const fullName = `${data.firstNameLine.trim()} ${data.secondNameLine.trim()}`;

    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
    if (cleanedNationalId.length !== 14) {
      throw new Error(`الرقم القومي غير مكتمل (${cleanedNationalId.length} رقم). التقط صورة أوضح للرقم القومي.`);
    }

    console.log(`✓ تم استخراج البيانات بنجاح:`);
    console.log(`  - السطر الأول: "${data.firstNameLine}"`);
    console.log(`  - السطر الثاني: "${data.secondNameLine}"`);
    console.log(`  - الاسم الكامل: "${fullName}"`);
    console.log(`  - الرقم القومي: "${cleanedNationalId}"`);

    return {
      name: fullName,
      nationalId: cleanedNationalId
    };
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    
    if (error.message.includes("timeout") || error.message.includes("انتهى الوقت")) {
      throw new Error("العملية استغرقت وقتاً طويلاً. حاول مرة أخرى بصورة أوضح.");
    }
    
    throw new Error(error.message || "فشل معالجة الصورة. تأكد من وضوح الصورة وحاول مرة أخرى.");
  }
}
