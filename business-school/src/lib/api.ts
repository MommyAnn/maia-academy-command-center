export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: {
      ...(method !== "GET" ? { "x-maia-request": "1" } : {}),
      ...(body !== undefined && !isForm ? { "content-type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Something went wrong. Please try again.");
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ url: string }>("POST", "/api/admin/uploads", fd);
  },
};

export type User = { id: number; email: string; name: string; mobile: string; role: "student" | "admin" };

export type Course = {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  topics: string[];
  outcome: string;
  tools: string[];
  coverImage: string;
  icon: string;
  priceSelfPaced: number;
  priceGuided: number;
  checkoutSelfPaced: string;
  checkoutGuided: string;
  selfPacedStatus: "coming_soon" | "open" | "closed";
  guidedStatus: "coming_soon" | "open" | "closed";
  guidedIncludesRecordings: boolean;
  accessNote: string;
  scheduleNote: string;
  published: boolean;
  sort: number;
  lessonCount?: number;
  upcomingBatches?: number;
};

export type PublicBatch = {
  id: number;
  title: string;
  mode: "zoom" | "face_to_face";
  startsAt: string;
  endsAt: string;
  scheduleText: string;
  capacity: number | null;
  status: string;
  location: string;
};

export type CourseDetail = Course & {
  outline: {
    id: number;
    title: string;
    description: string;
    lessons: { id: number; title: string; durationLabel: string; isPreview: boolean; previewVideoUrl: string }[];
  }[];
  batches: PublicBatch[];
};

export type SiteInfo = {
  settings: Record<string, string>;
  program: {
    title: string;
    price: number;
    checkoutUrl: string;
    status: "coming_soon" | "open" | "closed";
    journey: string;
    courseCount: number;
    guidedTotal: number;
    savings: number;
    courses: { slug: string; title: string }[];
  };
};

export type Product = {
  id: number;
  title: string;
  category: string;
  description: string;
  price: number | null;
  checkoutUrl: string;
  imageUrl: string;
};

export type Testimonial = {
  id: number;
  name: string;
  role: string;
  quote: string;
  videoUrl: string;
  photoUrl: string;
  courseTitle: string | null;
};

export type ScheduleItem = {
  id: number;
  courseId: number;
  courseTitle: string;
  title: string;
  mode: "zoom" | "face_to_face";
  startsAt: string;
  endsAt: string;
  scheduleText: string;
  status: string;
  location: string;
  notes: string;
  assigned: boolean;
  joinUrl: string;
};
