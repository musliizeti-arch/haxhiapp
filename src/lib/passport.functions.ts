import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageDataUrl: z.string().min(20),
});

export const extractPassport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI nuk eshte i konfiguruar.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a passport OCR engine. Read the passport image (including the MRZ) and extract data. " +
              "Return the full name (given names + surname) in three scripts/languages: " +
              "name_en = exactly as latin letters on the passport (English/international), " +
              "name_sq = Albanian spelling in latin letters (use Albanian orthography, e.g. Ç, Ë), " +
              "name_mk = Macedonian spelling in Cyrillic script (transliterate the same name). " +
              "Dates must be ISO format YYYY-MM-DD. Use empty string when unreadable. Never invent data.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the passport data from this image." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_passport",
              description: "Save extracted passport data",
              parameters: {
                type: "object",
                properties: {
                  name_en: { type: "string" },
                  name_sq: { type: "string" },
                  name_mk: { type: "string" },
                  passport_number: { type: "string" },
                  issue_date: { type: "string" },
                  expiry_date: { type: "string" },
                  nationality: { type: "string" },
                  birth_date: { type: "string" },
                },
                required: [
                  "name_en",
                  "name_sq",
                  "name_mk",
                  "passport_number",
                  "issue_date",
                  "expiry_date",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_passport" } },
      }),
    });

    if (res.status === 429) throw new Error("Shume kerkesa. Provoni perseri pas pak.");
    if (res.status === 402) throw new Error("Kredite AI te pamjaftueshme.");
    if (!res.ok) throw new Error(`Gabim gjate leximit: ${res.status}`);

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Nuk u lexuan te dhena nga pasaporta.");
    const parsed = JSON.parse(call.function.arguments ?? "{}");

    return {
      nameEn: String(parsed.name_en ?? ""),
      nameSq: String(parsed.name_sq ?? ""),
      nameMk: String(parsed.name_mk ?? ""),
      passportNumber: String(parsed.passport_number ?? ""),
      issueDate: String(parsed.issue_date ?? ""),
      expiryDate: String(parsed.expiry_date ?? ""),
      nationality: String(parsed.nationality ?? ""),
      birthDate: String(parsed.birth_date ?? ""),
    };
  });
