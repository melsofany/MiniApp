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
    const prompt = `You are an expert in reading Egyptian national ID cards.

CRITICAL INSTRUCTIONS - READ CAREFULLY:

Egyptian ID cards have the full name written on TWO SEPARATE LINES:

LINE 1 (TOP LINE) - Owner's First Name ONLY:
- This is the name of the person who owns the ID card
- Usually ONE word only
- Examples: "محمد" or "فاطمة" or "أحمد" or "علي" or "سارة"

LINE 2 (BOTTOM LINE) - Father's name + Grandfather's name + Family name:
- This starts with the FATHER's name (not repeating the owner's name)
- Then grandfather's name, then family name
- Usually 3-4 words
- Examples: "علي محمود حسن" or "سعيد أحمد عبدالله" or "حسن علي محمد"

COMPLETE EXAMPLES:

Example 1:
If the card shows:
محمد
علي محمود حسن

Then you must extract:
firstNameLine: "محمد" (owner's name)
secondNameLine: "علي محمود حسن" (father + grandfather + family)
Full name will be: "محمد علي محمود حسن"

Example 2:
If the card shows:
فاطمة
حسن علي محمد

Then you must extract:
firstNameLine: "فاطمة" (owner's name)
secondNameLine: "حسن علي محمد" (father + grandfather + family)
Full name will be: "فاطمة حسن علي محمد"

Example 3:
If the card shows:
أحمد
سعيد محمود عبدالله

Then you must extract:
firstNameLine: "أحمد" (owner's name)
secondNameLine: "سعيد محمود عبدالله" (father + grandfather + family)
Full name will be: "أحمد سعيد محمود عبدالله"

❌ COMMON MISTAKES TO AVOID:
1. DO NOT merge the two lines into one
2. DO NOT skip the first line (owner's name)
3. DO NOT repeat the first line in the second line
4. The first line is ALWAYS the owner's name (usually 1 word)
5. The second line is ALWAYS father + grandfather + family (usually 3-4 words)
6. DO NOT swap the lines
7. Read EXACTLY what is written on each line

Extract the following:
1. firstNameLine: The TOP line exactly as written (owner's name)
2. secondNameLine: The BOTTOM line exactly as written (father + grandfather + family)
3. nationalId: The 14-digit national ID number`;


    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            firstNameLine: { 
              type: "string",
              description: "The TOP line of the name - the ID card OWNER'S name only (usually 1 word). Examples: محمد, فاطمة, أحمد, علي. This is NOT the father's name."
            },
            secondNameLine: { 
              type: "string",
              description: "The BOTTOM line of the name - father's name + grandfather's name + family name (usually 3-4 words). Examples: علي محمود حسن, سعيد أحمد عبدالله. This line does NOT include the owner's name."
            },
            nationalId: { 
              type: "string",
              description: "The 14-digit national ID number - digits only without spaces"
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

    const firstLine = data.firstNameLine.trim();
    const secondLine = data.secondNameLine.trim();

    // التحقق من صحة البيانات
    const firstLineWords = firstLine.split(/\s+/).filter(w => w.length > 0);
    const secondLineWords = secondLine.split(/\s+/).filter(w => w.length > 0);

    // السطر الأول يجب أن يكون كلمة واحدة أو كلمتين على الأكثر (اسم صاحب البطاقة)
    if (firstLineWords.length > 2) {
      console.warn(`⚠️ تحذير: السطر الأول يحتوي على ${firstLineWords.length} كلمات. المتوقع 1-2 كلمة فقط.`);
    }

    // السطر الثاني يجب أن يحتوي على 2-5 كلمات (اسم الأب + الجد + العائلة)
    if (secondLineWords.length < 2) {
      console.warn(`⚠️ تحذير: السطر الثاني يحتوي على ${secondLineWords.length} كلمة فقط. المتوقع 2-5 كلمات.`);
    }

    // التحقق من عدم تكرار الكلمات بين السطرين
    const firstWord = firstLineWords[0];
    if (secondLineWords.includes(firstWord)) {
      console.warn(`⚠️ تحذير محتمل: الكلمة "${firstWord}" موجودة في كلا السطرين`);
    }

    // دمج السطرين لتكوين الاسم الكامل
    const fullName = `${firstLine} ${secondLine}`;

    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
    if (cleanedNationalId.length !== 14) {
      throw new Error(`الرقم القومي غير مكتمل (${cleanedNationalId.length} رقم). التقط صورة أوضح للرقم القومي.`);
    }

    console.log(`✓ تم استخراج البيانات بنجاح:`);
    console.log(`  - السطر الأول: "${firstLine}" (${firstLineWords.length} كلمة)`);
    console.log(`  - السطر الثاني: "${secondLine}" (${secondLineWords.length} كلمة)`);
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
