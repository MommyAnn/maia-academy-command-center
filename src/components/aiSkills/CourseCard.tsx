import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import type { AiMasterclass } from "@/types/aiSkills";
import { formatPeso } from "@/utils/aiSkills";
import { CourseCover, CtaLink } from "@/components/aiSkills/FunnelUi";

export function CourseCard({ course }: { course: AiMasterclass }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ais-gold/20 bg-ais-panel transition-all duration-300 hover:-translate-y-1 hover:border-ais-gold/60 hover:shadow-[0_30px_60px_-30px_rgba(194,150,70,0.45)]">
      <Link to={`/ai-skills/masterclass/${course.slug}`} className="block" tabIndex={-1} aria-hidden>
        <CourseCover course={course} className="aspect-[16/10]" />
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="font-display text-lg font-extrabold uppercase leading-snug text-ais-ivory">
          <Link to={`/ai-skills/masterclass/${course.slug}`} className="hover:text-ais-gold-pale">
            {course.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ais-muted">{course.description}</p>
        {course.learnPoints.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-ais-gold">What you will learn</p>
            <ul className="mt-2 space-y-1.5">
              {course.learnPoints.slice(0, 3).map((point) => (
                <li key={point} className="flex gap-2 text-sm text-ais-ivory/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-ais-gold" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto pt-6">
          <div className="flex items-baseline gap-2 border-t border-ais-gold/15 pt-4">
            <span className="font-display text-3xl font-extrabold text-ais-gold-pale">{formatPeso(course.price)}</span>
            <span className="text-xs uppercase tracking-[0.16em] text-ais-muted">per masterclass</span>
          </div>
          <div className="mt-4 grid gap-2">
            <CtaLink to={`/ai-skills/checkout/${course.slug}`} className="text-xs">
              Get This Masterclass
            </CtaLink>
            <CtaLink to={`/ai-skills/masterclass/${course.slug}`} variant="outline" className="min-h-10 py-2 text-xs">
              View Masterclass
            </CtaLink>
          </div>
        </div>
      </div>
    </article>
  );
}
