// M.A.I.A. Prompt Engine — turns a beginner's product photo + a few optional
// fields into a detailed Veo direction. Deterministic (no LLM call), so the
// same inputs always produce the same prompt and nothing is ever invented:
//  * Spoken / on-screen claims come ONLY from what the customer typed.
//  * The product photo is used as the first frame, and the prompt repeatedly
//    instructs the model to keep the product's real shape, colours, label and
//    packaging. Exact text (name, price, CTA) is NOT left to the model — it is
//    burned in afterwards as a deterministic overlay (see media.ts).

import type { AspectRatio, VideoLanguage, VideoStyle } from "./settings.js";

export interface ProductDetails {
  productName?: string;
  description?: string;
  benefits?: string;
  price?: string;
  targetAudience?: string;
  callToAction?: string;
}

export interface PromptInput {
  style: VideoStyle;
  language: VideoLanguage;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  product: ProductDetails;
  voiceover: boolean;
  customInstructions?: string;
}

export interface BuiltPrompt {
  prompt: string;
  negativePrompt: string;
  spokenLine: string | null;
}

export const DEFAULT_CTA: Record<VideoLanguage, string> = {
  ENGLISH: "Order now!",
  FILIPINO: "Mag-order na ngayon!",
  TAGLISH: "Order na kayo now!",
};

const LANGUAGE_VOICE: Record<VideoLanguage, string> = {
  ENGLISH: "in clear, natural English",
  FILIPINO: "in natural, conversational Filipino (Tagalog)",
  TAGLISH: "in natural Taglish (a casual mix of Tagalog and English, as Filipinos speak day to day)",
};

/** Strips characters that could break out of the quoted spoken line or the prompt structure. */
function clean(text: string | undefined, max: number): string {
  if (!text) return "";
  return text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/["“”]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function benefitList(benefits: string | undefined): string[] {
  if (!benefits) return [];
  return benefits
    .split(/\n|;|•/)
    .map((b) => clean(b.replace(/^[-*\d.)\s]+/, ""), 80))
    .filter(Boolean)
    .slice(0, 3);
}

function productReference(p: ProductDetails): string {
  const name = clean(p.productName, 60);
  return name ? `the product "${name}" shown in the reference image` : "the product shown in the reference image";
}

const FIDELITY =
  "The product must look exactly like the reference image: keep its real shape, proportions, colours, materials, label, logo and packaging unchanged. Do not add, remove or rewrite any text or branding on the product. Do not add any on-screen text, subtitles or captions.";

function spokenLineFor(input: PromptInput): string | null {
  if (!input.voiceover) return null;
  const p = input.product;
  const name = clean(p.productName, 60);
  const benefits = benefitList(p.benefits);
  const cta = clean(p.callToAction, 60) || DEFAULT_CTA[input.language];
  // Short enough to be spoken comfortably within the clip.
  const maxBenefits = input.durationSeconds <= 4 ? 0 : input.durationSeconds <= 6 ? 1 : 2;
  const parts = [name, ...benefits.slice(0, maxBenefits), cta].filter(Boolean);
  const line = parts.join(". ").replace(/\.\./g, ".");
  return line ? clean(line, 220) : null;
}

export function buildVideoPrompt(input: PromptInput): BuiltPrompt {
  const p = input.product;
  const ref = productReference(p);
  const description = clean(p.description, 300);
  const audience = clean(p.targetAudience, 120);
  const benefits = benefitList(p.benefits);
  const vertical = input.aspectRatio === "9:16";
  const frame = vertical ? "vertical 9:16 frame composed for phone screens (TikTok, Reels, Shorts)" : "horizontal 16:9 widescreen frame";
  const spokenLine = spokenLineFor(input);

  const lines: string[] = [];

  if (input.style === "PRODUCT_COMMERCIAL") {
    lines.push(
      `A premium, cinematic ${input.durationSeconds}-second product commercial for ${ref}, in a ${frame}.`,
      "Start on the product exactly as in the reference image, then a slow, smooth dolly-in and gentle orbit around it, ending on an elegant hero shot with the product centred and in sharp focus.",
      "Professional studio lighting: soft key light, subtle rim light that traces the product's edges, soft natural reflections and a shallow depth of field. Clean, uncluttered, upscale background that complements the product's colours.",
      "Polished high-end advertising look, realistic materials, 4K commercial quality, steady camera, no people unless they are already in the reference image.",
    );
  } else if (input.style === "UGC_PROMO") {
    lines.push(
      `An authentic, user-generated-content style ${input.durationSeconds}-second promo video featuring ${ref}, in a ${frame}.`,
      "Looks like it was filmed on a smartphone by a real customer: natural handheld movement, natural daylight in a real home or everyday setting.",
      "A friendly adult presenter enters the frame, picks up or presents the product, shows it clearly to the camera and demonstrates how it is used in a natural, relatable way, with a genuine smile.",
      "Casual, trustworthy, relatable mood. The product stays clearly visible and recognisable throughout.",
    );
  } else {
    lines.push(
      `A dynamic, energetic ${input.durationSeconds}-second sales promotion video for ${ref}, in a ${frame}.`,
      "Fast-paced but smooth: a quick push-in on the product, a punchy reveal with a bold light sweep, a few dynamic angle changes, and a final confident hero shot of the product centred with clean empty space at the top and bottom of the frame.",
      "Bright, vibrant, high-contrast lighting with a colourful backdrop that matches the product's colours; exciting, upbeat, festive shopping mood.",
    );
  }

  if (description) lines.push(`About the product (use only for visual context, do not show as text): ${description}.`);
  if (benefits.length) lines.push(`Visually suggest these customer-stated benefits where natural: ${benefits.join("; ")}.`);
  if (audience) lines.push(`Target audience: ${audience}; choose a setting and mood that appeals to them.`);

  lines.push(FIDELITY);

  if (spokenLine) {
    const who = input.style === "UGC_PROMO" ? "The presenter says to the camera" : "A warm, confident voiceover says";
    lines.push(`Audio: ${who} ${LANGUAGE_VOICE[input.language]}: "${spokenLine}" Light, fitting background music under the voice.`);
  } else {
    lines.push("Audio: no dialogue and no voiceover; only fitting, upbeat background music and subtle sound effects.");
  }

  const custom = clean(input.customInstructions, 400);
  if (custom) lines.push(`Additional creative direction from the customer: ${custom}`);

  return {
    prompt: lines.join(" "),
    negativePrompt:
      "distorted or warped product, changed logo, altered or misspelled label text, extra products, wrong product colours, on-screen text, subtitles, captions, watermark, low quality, blurry, cartoon, deformed hands, deformed faces",
    spokenLine,
  };
}
