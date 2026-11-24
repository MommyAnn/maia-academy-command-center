import { type DB, get, run, tx } from "./db.ts";

/**
 * First-run content. Everything here comes from the confirmed offer details
 * (five workshops, official prices, intended outcomes, tools that may be
 * discussed). Lesson structures, schedules, testimonials, store products and
 * contact links are intentionally NOT invented — the admin fills them in.
 */

type SeedCourse = {
  slug: string;
  title: string;
  icon: string;
  tagline: string;
  description: string;
  topics: string[];
  outcome: string;
  tools: string[];
};

export const SEED_COURSES: SeedCourse[] = [
  {
    slug: "ai-creatives",
    title: "AI Creatives Workshop",
    icon: "image",
    tagline: "Gumawa ng product photos, videos at ads gamit ang AI — with the right process.",
    description:
      "Learn how to use AI as a practical creative tool for your business: product photography, promotional videos, product advertisements and everyday marketing content. Hindi lang kung anong tool ang pipindutin — kung paano ito gamitin nang tama para sa produkto mo.",
    topics: [
      "AI product photography",
      "AI video creation",
      "Product advertisements",
      "AI creatives for your brand",
      "Marketing content",
    ],
    outcome: "Practice creating AI-generated marketing creatives or promotional videos for your products.",
    tools: ["Canva", "Google AI tools"],
  },
  {
    slug: "facebook-ads",
    title: "Facebook Ads Workshop",
    icon: "megaphone",
    tagline: "Meta Ads fundamentals — from campaign setup to reading your results.",
    description:
      "Understand how Meta Ads work before you spend. Covers campaign setup, audience targeting, ad creatives, performance monitoring and optimization — para hindi ka na manghula kung saan napupunta ang ad budget mo.",
    topics: [
      "Meta Ads fundamentals",
      "Campaign setup",
      "Audience targeting",
      "Ad creatives",
      "Performance monitoring",
      "Optimization",
    ],
    outcome: "Prepare a campaign plan or a practice campaign setup for your business.",
    tools: ["Meta Ads Manager", "Canva"],
  },
  {
    slug: "automation",
    title: "Automation Workshop",
    icon: "workflow",
    tagline: "Chatbots, auto-replies at follow-ups — para hindi ka na puyat kaka-reply.",
    description:
      "Set up the basic systems that keep your business responsive: chatbots, automated responses, workflows and customer follow-up. Learn which tasks to automate first and how to keep the customer experience personal.",
    topics: [
      "Business automation basics",
      "Chatbots",
      "Automated responses",
      "Workflows",
      "Customer follow-up systems",
    ],
    outcome: "Build a basic chatbot or automation workflow you can adapt to your business.",
    tools: ["Business automation platforms"],
  },
  {
    slug: "claude",
    title: "Claude Workshop",
    icon: "bot",
    tagline: "Gamitin ang Claude AI bilang katuwang sa negosyo — strategically and practically.",
    description:
      "Use Claude AI for real business work: productivity, content creation, AI-supported workflows and business projects. The focus is on clear instructions, checking outputs, and applying AI to tasks you actually do every week.",
    topics: [
      "Claude for business productivity",
      "Content creation with Claude",
      "AI-supported workflows",
      "Business projects with Claude",
    ],
    outcome: "Create a practical AI-supported business workflow or project.",
    tools: ["Claude"],
  },
  {
    slug: "website-creation",
    title: "Website Creation Workshop",
    icon: "globe",
    tagline: "Plan, design, build and launch your business website — step by step.",
    description:
      "Go from idea to a working business website: planning your pages, designing with your brand, building, and launching. Ideal for business owners who want a professional online presence they understand and can update.",
    topics: ["Website planning", "Designing with your brand", "Building your website", "Launching your website"],
    outcome: "Build a website prototype or a business website.",
    tools: ["Website builders", "Claude"],
  },
];

export const DEFAULT_SETTINGS: Record<string, string> = {
  // Contact & social — provided later by the founder. Empty = hidden on the site.
  "contact.email": "",
  "contact.messengerUrl": "",
  "contact.phone": "",
  "social.facebook": "",
  "social.instagram": "",
  "social.tiktok": "",
  "social.youtube": "",
  // Tracking — Meta Pixel is only injected when an ID is set.
  "tracking.metaPixelId": "",
  // Complete program
  "program.title": "Complete 5-Workshop Business Solutions Program",
  "program.price": "15000",
  "program.checkoutUrl": "",
  "program.status": "coming_soon",
  "program.journey":
    "Designed around a proposed 30-day guided learning journey. The final live session calendar and recording access period will be announced per batch.",
  // Brand
  "brand.logoUrl": "/brand/maia-monogram.png",
  "home.announcement": "",
  // Policies — placeholders for administrator / legal review.
  "policy.terms":
    "[PLACEHOLDER — for administrator review]\n\nThese Terms of Enrollment will describe what each purchase includes, access periods, workshop attendance rules, and account use. Please replace this text with your reviewed terms before accepting payments.",
  "policy.refund":
    "[PLACEHOLDER — for administrator review]\n\nThe refund and rescheduling policy has not been published yet. It will be reviewed against applicable consumer requirements before enrollment opens. For questions, please use the Contact Us form.",
  "policy.privacy":
    "[PLACEHOLDER — for administrator review]\n\nWe collect the details you submit (name, email, mobile number and messages) to respond to inquiries and to manage your student account. Please replace this text with your reviewed privacy notice (Data Privacy Act of 2012).",
};

export function seed(db: DB) {
  tx(db, () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      run(db, "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, value);
    }

    const hasCourses = get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM courses")!.n > 0;
    if (hasCourses) return;

    SEED_COURSES.forEach((c, i) => {
      const res = run(
        db,
        `INSERT INTO courses (slug, title, icon, tagline, description, topics, outcome, tools, access_note, schedule_note, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.slug,
        c.title,
        c.icon,
        c.tagline,
        c.description,
        JSON.stringify(c.topics),
        c.outcome,
        JSON.stringify(c.tools),
        "Recording access period to be announced.",
        "Zoom batches first. Face-to-face sessions will open once our physical training center is operational.",
        i + 1,
      );
      const courseId = Number(res.lastInsertRowid);
      const mod = run(
        db,
        "INSERT INTO modules (course_id, title, description, sort) VALUES (?, ?, ?, 1)",
        courseId,
        "Module 1 — Curriculum to be announced",
        "Placeholder module. Replace with the final module title in the Admin Dashboard.",
      );
      run(
        db,
        "INSERT INTO lessons (module_id, title, summary, sort) VALUES (?, ?, ?, 1)",
        Number(mod.lastInsertRowid),
        "Lesson recording coming soon",
        "Placeholder lesson. Add the lesson title, description and video link in the Admin Dashboard.",
      );
    });
  });
}
