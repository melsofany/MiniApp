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
    const prompt = `IMPORTANT: You are reading an EGYPTIAN NATIONAL ID CARD.

The card has a SPECIFIC FORMAT for the name section. Look at the card image carefully.

THE NAME IS WRITTEN IN TWO LINES - YOU MUST READ BOTH LINES:

┌─────────────────────────────────┐
│  [PHOTO]    الاسم / Name        │
│             ───────────          │
│             محمد    ← LINE 1    │  ← This is the OWNER'S name (1 word)
│             علي محمود حسن        │  ← This is father+grandfather+family (3-4 words)
│                     ↑ LINE 2    │
│                                 │
│  الرقم القومى / National No.    │
│  29501011234567                 │
└─────────────────────────────────┘

STRUCTURE EXPLANATION:
- LINE 1 (FIRST/TOP): The person's OWN name - usually ONE word
- LINE 2 (SECOND/BOTTOM): Father's + Grandfather's + Family name - usually 3-4 words

REAL EXAMPLES FROM EGYPTIAN IDS:

Example A:
What you see on card:
الاسم: محمد           ← firstNameLine = "محمد"
      علي محمود حسن    ← secondNameLine = "علي محمود حسن"
Rقم قومي: 29501011234567
Result: Full name = "محمد علي محمود حسن"

Example B:
What you see on card:
الاسم: فاطمة          ← firstNameLine = "فاطمة"
      حسن سعيد محمد   ← secondNameLine = "حسن سعيد محمد"
رقم قومي: 29612051234567
Result: Full name = "فاطمة حسن سعيد محمد"

Example C:
What you see on card:
الاسم: أحمد           ← firstNameLine = "أحمد"
      سعيد محمود عبدالله ← secondNameLine = "سعيد محمود عبدالله"
رقم قومي: 29403151234567
Result: Full name = "أحمد سعيد محمود عبدالله"

YOUR TASK:
1. Find the name section (usually has label "الاسم" or "Name")
2. Read the FIRST line of the name → this is firstNameLine (owner's name)
3. Read the SECOND line of the name → this is secondNameLine (father+grandfather+family)
4. Find the national ID number (14 digits, usually labeled "الرقم القومى" or "National No.")

CRITICAL RULES:
✓ ALWAYS extract BOTH lines of the name
✓ The first line is usually 1 word (owner's name)
✓ The second line is usually 3-4 words (family lineage)
✓ DO NOT skip the first line
✓ DO NOT merge the two lines before extraction
✓ Extract each line EXACTLY as written`;


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
