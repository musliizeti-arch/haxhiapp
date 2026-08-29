import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageDataUrl: z.string().min(20),
});

const FIELDS = [
  ["name_en", "nameEn"],
  ["name_sq", "nameSq"],
  ["name_mk", "nameMk"],
  ["passport_number", "passportNumber"],
  ["issue_date", "issueDate"],
  ["expiry_date", "expiryDate"],
  ["nationality", "nationality"],
  ["birth_date", "birthDate"],
] as const;

function fieldSchema(description: string) {
  return {
    type: "object",
    description,
    properties: {
      value: { type: "string", description: "Normalized value (dates as YYYY-MM-DD)" },
      raw_text: { type: "string", description: "Exact text as printed on the passport image" },
      confidence: { type: "number", description: "Confidence 0-1 for this field" },
    },
    required: ["value", "raw_text", "confidence"],
    additionalProperties: false,
  };
}

export const extractPassport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI nuk eshte i konfiguruar.");

    const properties: Record<string, unknown> = {};
    for (const [snake] of FIELDS) properties[snake] = fieldSchema(snake);
    properties["photo_box"] = {
      type: "object",
      description:
        "Bounding box of the holder's portrait photo on the passport image, normalized 0-1 relative to image width/height. Use zeros if no photo is visible.",
      properties: {
        x: { type: "number", description: "Left edge 0-1" },
        y: { type: "number", description: "Top edge 0-1" },
        w: { type: "number", description: "Width 0-1" },
        h: { type: "number", description: "Height 0-1" },
      },
      required: ["x", "y", "w", "h"],
      additionalProperties: false,
    };

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
              "For every field return: value (dates ISO YYYY-MM-DD), raw_text (the literal characters you read on the image, " +
              "or the MRZ segment used), and confidence between 0 and 1 reflecting how clearly you could read it. " +
              "Use empty string and confidence 0 when unreadable. Never invent data.",
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
              description: "Save extracted passport data with per-field confidence",
              parameters: {
                type: "object",
                properties,
                required: [...FIELDS.map(([snake]) => snake), "photo_box"],
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

    const values: Record<string, string> = {};
    const confidence: Record<string, number> = {};
    const rawText: Record<string, string> = {};

    for (const [snake, camel] of FIELDS) {
      const entry = parsed?.[snake];
      if (entry && typeof entry === "object") {
        values[camel] = String(entry.value ?? "");
        rawText[camel] = String(entry.raw_text ?? "");
        const c = Number(entry.confidence);
        confidence[camel] = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : 0;
      } else {
        values[camel] = String(entry ?? "");
        rawText[camel] = "";
        confidence[camel] = 0;
      }
    }

    return {
      nameEn: values["nameEn"] ?? "",
      nameSq: values["nameSq"] ?? "",
      nameMk: values["nameMk"] ?? "",
      passportNumber: values["passportNumber"] ?? "",
      issueDate: values["issueDate"] ?? "",
      expiryDate: values["expiryDate"] ?? "",
      nationality: values["nationality"] ?? "",
      birthDate: values["birthDate"] ?? "",
      confidence,
      rawText,
      photoBox: (() => {
        const b = parsed?.["photo_box"];
        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
        if (!b || typeof b !== "object") return null;
        const box = { x: num(b.x), y: num(b.y), w: num(b.w), h: num(b.h) };
        return box.w > 0.02 && box.h > 0.02 ? box : null;
      })(),
    };
  });
