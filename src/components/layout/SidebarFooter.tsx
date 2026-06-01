"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useOverallProgress } from "@/hooks/useProgress";
import { useProgressContext } from "@/context/ProgressContext";
import { RotateCcw, ExternalLink } from "lucide-react";

interface CourseProgress {
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  percentComplete: number;
  courseCount: number;
}

export function SidebarFooter() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const showCurriculum = /^\/(chapter|appendix|search)(\/|$)/.test(pathname);
  const isCourseRoute = /^\/course\//.test(pathname);

  // Old curriculum-based progress (for chapter/appendix pages)
  const { completedNotebooks, percentComplete: curriculumPercent, isHydrated } = useOverallProgress();
  const { dispatch } = useProgressContext();

  // Supabase course-based progress (for course pages)
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [courseProgressLoaded, setCourseProgressLoaded] = useState(false);

  useEffect(() => {
    if (!isCourseRoute || !session?.user?.email) return;
    setCourseProgressLoaded(false);
    fetch("/api/courses/my-progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CourseProgress | null) => {
        setCourseProgress(data);
        setCourseProgressLoaded(true);
      })
      .catch(() => setCourseProgressLoaded(true));
  }, [showCurriculum, session?.user?.email]);

  const loaded = showCurriculum ? isHydrated : (isCourseRoute ? courseProgressLoaded : true);
  const percent = showCurriculum ? curriculumPercent : (isCourseRoute ? (courseProgress?.percentComplete ?? 0) : 0);
  const completedLabel = showCurriculum
    ? (completedNotebooks > 0 ? `${completedNotebooks} notebook${completedNotebooks !== 1 ? "s" : ""} completed` : null)
    : (isCourseRoute && courseProgress && courseProgress.totalChapters > 0
        ? (() => {
            const parts: string[] = [];
            if (courseProgress.completedChapters > 0) {
              parts.push(`${courseProgress.completedChapters}/${courseProgress.totalChapters} chapter${courseProgress.totalChapters !== 1 ? "s" : ""} completed`);
            }
            if (courseProgress.inProgressChapters > 0) {
              parts.push(`${courseProgress.inProgressChapters} in progress`);
            }
            return parts.length > 0 ? parts.join(" · ") : "No chapters started yet";
          })()
        : null);

  return (
    <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid #C8B882' }}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-jetbrains text-[9px] uppercase tracking-[0.1em]" style={{ color: '#8B7355' }}>
            Overall Progress
          </span>
          <span className="font-jetbrains text-[9px]" style={{ color: '#1C1610' }}>
            {loaded ? `${percent}%` : '—'}
          </span>
        </div>
        <div className="h-[3px] overflow-hidden" style={{ background: 'rgba(200,184,130,0.3)' }}>
          <div
            className="h-full transition-all duration-500"
            style={{ width: loaded ? `${percent}%` : '0%', background: '#C0392B' }}
          />
        </div>
        {loaded && completedLabel && (
          <p className="font-jetbrains text-[9px]" style={{ color: '#8B7355' }}>
            {completedLabel}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!isCourseRoute && (
          <a
            href="https://github.com/rasbt/LLMs-from-scratch"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-jetbrains text-[9px] transition-colors"
            style={{ color: '#8B7355' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#C0392B'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B7355'; }}
          >
            <ExternalLink className="h-3 w-3" />
            GitHub Repo
          </a>
        )}
        {showCurriculum && (
          <>
            <span style={{ color: '#C8B882' }}>·</span>
            <button
              onClick={() => {
                if (confirm('Reset all progress? This cannot be undone.')) {
                  dispatch({ type: 'RESET_ALL' });
                }
              }}
              className="flex items-center gap-1.5 font-jetbrains text-[9px] transition-colors"
              style={{ color: '#8B7355' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#C0392B'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8B7355'; }}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </>
        )}
      </div>
    </div>
  );
}
