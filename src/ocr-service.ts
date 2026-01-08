import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export interface SlipData {
    amount: string | null;
    date: string | null;
    bankType: string | null;
    rawText: string;
}

export async function processSlipOCR(imageBuffer: Buffer): Promise<SlipData> {
    try {
        // Preprocess image for better OCR accuracy
        const processedImage = await sharp(imageBuffer)
            .resize(1200, null, { withoutEnlargement: true })
            .grayscale()
            .normalize()
            .sharpen()
            .toBuffer();

        // Perform OCR with Lao language support
        const { data: { text } } = await Tesseract.recognize(
            processedImage,
            'lao+eng',
            {
                logger: m => console.log(m)
            }
        );

        // Extract data from OCR text
        const bankType = detectBankType(text);
        const amount = extractAmount(text, bankType);
        const date = extractDate(text, bankType);

        return {
            amount,
            date,
            bankType,
            rawText: text
        };
    } catch (error) {
        throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function detectBankType(text: string): string | null {
    const bankPatterns = [
        // MoneyGram patterns (check first)
        { pattern: /MoneyGram|ລຸນບູຮວມປຮະ/i, type: 'MONEYGRAM' },
        { pattern: /Transfer Completed/i, type: 'MONEYGRAM' },
        { pattern: /From account.*To account/i, type: 'MONEYGRAM' },
        { pattern: /Bill number.*Ticket number/i, type: 'MONEYGRAM' },
        { pattern: /Service fee/i, type: 'MONEYGRAM' },

        // LDB patterns
        { pattern: /FT\d{5}[A-Z0-9]+/i, type: 'LDB' },
        { pattern: /FQR\d{6}[A-Z0-9]+/i, type: 'LDB' },
        { pattern: /ຈ້ານວນເງິນ/i, type: 'LDB' },
        { pattern: /ຄາທໍານຽມ/i, type: 'LDB' },
        { pattern: /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/i, type: 'LDB' },

        // BCEL patterns
        { pattern: /BCEL One|OnePay|TMN Online/i, type: 'BCEL' },
        { pattern: /133-12-xxxxx829/i, type: 'BCEL' },
        { pattern: /ສໍາເລັດ.*\d{2}:\d{2}:\d{2}/i, type: 'BCEL' },
        { pattern: /ເລກອ້າງອີງ.*[A-Z0-9]{12}/i, type: 'BCEL' },
    ];

    for (const { pattern, type } of bankPatterns) {
        if (pattern.test(text)) {
            return type;
        }
    }

    return null;
}

function extractAmount(text: string, bankType?: string | null): string | null {
    const amountPatterns = [
        // MoneyGram format (check first)
        /Amount\s*([0-9,]+(?:\.[0-9]{2})?)\s*LAK/i,
        /^([0-9,]{3,})\s*LAK$/m, // Large numbers followed by LAK on their own line

        // LDB format
        /ຈ້ານວນເງິນ:\s*K?\s*-?([0-9,]+(?:\.[0-9]{2})?)/i,

        // BCEL formats
        /-([0-9,]+(?:\.[0-9]{2})?)\s*LAK/i,
        /ຈໍານວນຊໍາລະ[:\s]*([0-9,]+(?:\.[0-9]{2})?)/i,
        /([0-9,]+(?:\.[0-9]{2})?)\s*(?:ກີບ|LAK|Lak)/i,

        // General patterns - look for large numbers
        /(?:^|\s)([0-9,]{6,}(?:\.[0-9]{2})?)\s*(?:$|\s)/m, // 6+ digits for large amounts like 869,000
        /(?:^|\s)([0-9,]{4,}(?:\.[0-9]{2})?)\s*(?:$|\s)/m,
    ];

    for (const pattern of amountPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const cleanAmount = match[1].replace(/,/g, '');
            const numericAmount = parseFloat(cleanAmount);
            if (numericAmount > 0) {
                return cleanAmount;
            }
        }
    }

    return null;
}

function extractDate(text: string, bankType?: string | null): string | null {
    const datePatterns = [
        // MoneyGram format (check first)
        /(\d{2}\/\d{2}\/\d{2})\s+\d{2}:\d{2}:\d{2}/i, // 25/09/24 22:43:06 format
        /Transfer Completed.*?(\d{2}\/\d{2}\/\d{2})/i,

        // LDB datetime format
        /(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}/i,

        // BCEL formats
        /ຊໍາລະ[\/\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-](?:\d{4}|\d{2}))/,

        // General date patterns
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})(?!\d)/,
        /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
        /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    ];

    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const dateStr = match[1];
            if (isValidDateFormat(dateStr)) {
                return formatDate(dateStr);
            }
        }
    }

    return null;
}

function isValidDateFormat(dateStr: string): boolean {
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length !== 3) return false;

    const [first, second, third] = parts.map(p => parseInt(p, 10));

    // Handle YYYY-MM-DD format
    if (first > 1900) {
        return second >= 1 && second <= 12 && third >= 1 && third <= 31;
    }

    // Handle DD/MM/YYYY format
    if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
        const fullYear = third < 100 ? (third > 50 ? 1900 + third : 2000 + third) : third;
        return fullYear >= 1900 && fullYear <= 2100;
    }

    return false;
}

function formatDate(dateStr: string): string {
    const parts = dateStr.split(/[\/\-\.]/);

    if (parts.length === 3) {
        let [first, second, third] = parts;

        // Handle YYYY-MM-DD format (LDB)
        if (first.length === 4 && parseInt(first) > 1900) {
            return `${second.padStart(2, '0')}/${third.padStart(2, '0')}/${first}`;
        }

        // Handle 2-digit years
        if (third.length === 2) {
            const yearNum = parseInt(third, 10);
            third = yearNum <= 50 ? `20${third}` : `19${third}`;
        }

        // DD/MM/YYYY format
        return `${first.padStart(2, '0')}/${second.padStart(2, '0')}/${third}`;
    }

    return dateStr;
}