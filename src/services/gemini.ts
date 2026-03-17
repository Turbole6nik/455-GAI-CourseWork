import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  notes: string;
}

export async function extractTransactions(fileBase64: string, mimeType: string): Promise<Transaction[]> {
  const model = "gemini-3-flash-preview"; // Using the recommended flash model
  
  const prompt = `Extract all transactions from this bank statement. 
  Follow these rules strictly:
  1. Date format: YYYY-MM-DD.
  2. Amount: Positive for deposits/income, negative for expenses/withdrawals.
  3. Category: Auto-detect (e.g., groceries, dining, transport, salary, bills, entertainment, health, etc.).
  4. Skip headers, totals, and non-transaction rows.
  5. Extract ALL transactions across all pages.
  6. If a transaction spans multiple lines, combine the description.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER, description: "Negative for expenses, positive for deposits" },
            category: { type: Type.STRING },
            notes: { type: Type.STRING },
          },
          required: ["date", "description", "amount", "category"],
        },
      },
    },
  });

  try {
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as Transaction[];
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return [];
  }
}
