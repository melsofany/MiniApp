import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedCardData {
  name: string;
  nationalId: string;
}

interface GeminiResponse {
  nameLines: string[];
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
    const prompt = `Extract data from this Egyptian National ID card.

TASK: Read ALL text lines in the name section and return them in order.

Egyptian ID cards show the name in multiple lines under the label "الاسم" or "Name":
- Line 1: Usually 1-2 words (owner's first name)
- Line 2: Usually 2-4 words (father, grandfather, family name)
- Sometimes there are 3 lines

EXAMPLES:

Card showing:
الاسم
محمد
علي محمود حسن
رقم قومي: 29501011234567

Extract as:
nameLines: ["محمد", "علي محمود حسن"]
nationalId: "29501011234567"

Card showing:
Name
فاطمة
حسن سعيد
محمد عبدالله
National No: 29612051234567

Extract as:
nameLines: ["فاطمة", "حسن سعيد", "محمد عبدالله"]
nationalId: "29612051234567"

INSTRUCTIONS:
1. Find the name section (labeled "الاسم" or "Name")
2. Read ALL text lines under that label from top to bottom
3. Put each line as a separate string in the nameLines array
4. Do NOT merge lines, do NOT skip lines
5. Extract the 14-digit national ID number

Return EXACTLY what you read, line by line, in order.`;


    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            nameLines: { 
              type: "array",
              items: { type: "string" },
              description: "All lines of the name from the ID card in order from top to bottom. Each line is a separate string in the array. Do not merge lines. Example: ['محمد', 'علي محمود حسن'] or ['فاطمة', 'حسن سعيد', 'محمد']"
            },
            nationalId: { 
              type: "string",
              description: "The 14-digit national ID number - digits only without spaces"
            },
          },
          required: ["nameLines", "nationalId"],
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

    if (!data.nameLines || !Array.isArray(data.nameLines) || data.nameLines.length === 0 || !data.nationalId) {
      throw new Error("فشل استخراج البيانات. تأكد أن الصورة واضحة وتحتوي على البطاقة كاملة.");
    }

    // تنظيف الأسطر وإزالة الفراغات
    const cleanedLines = data.nameLines
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (cleanedLines.length === 0) {
      throw new Error("لم يتم العثور على أسطر الاسم. تأكد من وضوح الصورة.");
    }

    // ========== معالجة ذكية للأسطر ==========
    
    // تحليل كل سطر لمعرفة عدد الكلمات
    const linesWithWordCount = cleanedLines.map(line => ({
      text: line,
      wordCount: line.split(/\s+/).filter(w => w.length > 0).length
    }));

    console.log('📊 تحليل الأسطر المستخرجة:');
    linesWithWordCount.forEach((line, idx) => {
      console.log(`  السطر ${idx + 1}: "${line.text}" (${line.wordCount} كلمة)`);
    });

    let ownerName: string;
    let familyLineage: string;

    if (cleanedLines.length === 1) {
      // سطر واحد فقط - نعتبره الاسم الكامل
      console.log('⚠️ تحذير: تم استخراج سطر واحد فقط');
      ownerName = cleanedLines[0];
      familyLineage = '';
    } else if (cleanedLines.length === 2) {
      // حالة قياسية: سطرين
      // السطر الأول = اسم صاحب البطاقة (عادة 1-2 كلمة)
      // السطر الثاني = اسم الأب + الجد + العائلة (عادة 2-4 كلمات)
      ownerName = cleanedLines[0];
      familyLineage = cleanedLines[1];
      
      // التحقق من المنطقية
      if (linesWithWordCount[0].wordCount > linesWithWordCount[1].wordCount) {
        console.warn('⚠️ تحذير: السطر الأول يحتوي كلمات أكثر من الثاني - قد يكون هناك خطأ');
      }
    } else {
      // 3 أسطر أو أكثر
      // منطق ذكي: السطر الأول عادة هو الاسم الأول
      // باقي الأسطر هي اسم الأب + الجد + العائلة
      ownerName = cleanedLines[0];
      familyLineage = cleanedLines.slice(1).join(' ');
      
      console.log(`ℹ️ تم دمج ${cleanedLines.length - 1} سطر للعائلة`);
    }

    // دمج الاسم الكامل
    const fullName = familyLineage 
      ? `${ownerName} ${familyLineage}`.trim()
      : ownerName;

    // التحقق من الرقم القومي
    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
    if (cleanedNationalId.length !== 14) {
      throw new Error(`الرقم القومي غير مكتمل (${cleanedNationalId.length} رقم). التقط صورة أوضح للرقم القومي.`);
    }

    // التحقق النهائي
    const ownerWordCount = ownerName.split(/\s+/).filter(w => w.length > 0).length;
    const fullNameWordCount = fullName.split(/\s+/).filter(w => w.length > 0).length;

    if (fullNameWordCount < 2) {
      console.warn('⚠️ تحذير: الاسم الكامل يحتوي على كلمة واحدة فقط');
    }

    console.log(`\n✅ ✅ ✅ تم استخراج البيانات بنجاح:`);
    console.log(`  📝 اسم صاحب البطاقة: "${ownerName}" (${ownerWordCount} كلمة)`);
    console.log(`  👨‍👩‍👦 باقي الاسم (أب+جد+عائلة): "${familyLineage}"`);
    console.log(`  📄 الاسم الكامل: "${fullName}" (${fullNameWordCount} كلمة)`);
    console.log(`  🆔 الرقم القومي: "${cleanedNationalId}"`);
    console.log(`  📊 عدد الأسطر المستخرجة: ${cleanedLines.length}`);

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
