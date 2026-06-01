import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase";
import { auth } from "@/auth";
import Link from "next/link";
import Image from "next/image";
import { Video, FileCode, BookOpen, ChevronRight, Users, BarChart3, Globe, Shield, Lock, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { SubscribeButton } from "@/components/course/SubscribeButton";
import { AccessRequestButton } from "@/components/course/AccessRequestButton";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient();
  const { data: course } = await supabase
    .from("courses")
    .select("title, description")
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  return {
    title: course ? `${course.title} — emrAIo` : "Course Not Found",
    description: course?.description ?? "",
  };
}

export default async function CourseOverviewPage({ params }: { params: { slug: string } }) {
  const supabase = createServiceClient();
  const session = await auth();

  const { data: course } = await supabase
    .from("courses")
    .select(`
      *,
      profiles!courses_author_id_fkey( id, name, image, email ),
      course_chapters(
        id, title, description, "order",
        chapter_videos(id, title, embed_url, platform),
        chapter_notebooks(id, title, colab_url),
        chapter_papers(id, title, url)
      )
    `)
    .eq("slug", params.slug)
    .eq("status", "published")
    .single();

  if (!course) notFound();

  const visibility = (course.visibility as string) ?? "public";

  const author = course.profiles as unknown as {
    id: string;
    name: string | null;
    image: string | null;
    email: string;
  };

  // Check if current user is owner
  let isOwner = false;
  let userId: string | null = null;
  if (session?.user?.email) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", session.user.email)
      .single();
    if (profile) {
      userId = profile.id;
      isOwner = author?.id === profile.id;
    }
  }

  // Private courses: only owner can see
  if (visibility === "private" && !isOwner) notFound();

  // Determine content access for restricted courses
  let hasAccess = isOwner || visibility === "public";
  let accessStatus: string | null = null;

  if (visibility === "restricted" && !isOwner && userId) {
    const { data: accessReq } = await supabase
      .from("course_access_requests")
      .select("status")
      .eq("course_id", course.id)
      .eq("requester_id", userId)
      .single();

    if (accessReq?.status === "approved") {
      hasAccess = true;
    }
    accessStatus = accessReq?.status ?? null;
  }

  const chapters = (course.course_chapters ?? []).sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order
  );

  const totalVideos = chapters.reduce((s: number, ch: { chapter_videos: unknown[] }) => s + (ch.chapter_videos?.length ?? 0), 0);
  const totalNotebooks = chapters.reduce((s: number, ch: { chapter_notebooks: unknown[] }) => s + (ch.chapter_notebooks?.length ?? 0), 0);
  const totalPapers = chapters.reduce((s: number, ch: { chapter_papers: unknown[] }) => s + (ch.chapter_papers?.length ?? 0), 0);

  // Get subscriber's chapter progress
  let chapterProgressMap: Record<string, string> = {};
  if (userId) {
    const { data: subscription } = await supabase
      .from("course_subscriptions")
      .select("id")
      .eq("course_id", course.id)
      .eq("subscriber_id", userId)
      .single();
    if (subscription) {
      const { data: progress } = await supabase
        .from("subscriber_progress")
        .select("chapter_id, status")
        .eq("subscription_id", subscription.id);
      for (const p of progress ?? []) {
        chapterProgressMap[p.chapter_id] = p.status;
      }
    }
  }

  // Subscriber count
  const { count: subscriberCount } = await supabase
    .from("course_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("course_id", course.id);

  const accentColors: Record<string, string> = {
    violet: "#7C3AED", blue: "#2563EB", orange: "#EA580C", emerald: "#059669",
    cyan: "#0891B2", pink: "#DB2777", yellow: "#CA8A04", red: "#DC2626",
    indigo: "#4F46E5", teal: "#0D9488",
  };
  const accent = accentColors[course.accent_color] ?? "#C0392B";

  return (
    <div>
      {/* Hero */}
      <div
        style={{ borderLeft: `3px solid ${accent}`, background: "#FFFDF5" }}
        className="p-6 mb-8"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <p className="font-jetbrains text-[9px] tracking-[0.2em] uppercase mb-2" style={{ color: accent }}>
              § Community Course
            </p>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="font-playfair font-bold text-[32px] leading-tight" style={{ color: "#1C1610" }}>
                {course.title}
              </h1>
              {visibility === "restricted" && (
                <span className="flex items-center gap-1 px-2 py-0.5 font-jetbrains text-[9px] uppercase tracking-wider" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #F59E0B" }}>
                  <Shield className="h-3 w-3" /> Restricted
                </span>
              )}
              {visibility === "private" && (
                <span className="flex items-center gap-1 px-2 py-0.5 font-jetbrains text-[9px] uppercase tracking-wider" style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #EF4444" }}>
                  <Lock className="h-3 w-3" /> Private
                </span>
              )}
            </div>
            {course.description && (
              <p className="font-source-serif text-[15px] leading-relaxed max-w-2xl" style={{ color: "#5C4E35" }}>
                {course.description}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-2">
            <SubscribeButton courseId={course.id} isOwner={isOwner} />
            {isOwner && (
              <Link
                href={`/my-courses/${course.id}/stats`}
                className="flex items-center gap-2 px-4 py-2 font-jetbrains text-[11px] uppercase tracking-wider transition-colors hover:bg-[#EDE8D5]"
                style={{ border: "1px solid #C8B882", color: "#5C4E35" }}
              >
                <BarChart3 className="h-4 w-4" />
                Stats
              </Link>
            )}
          </div>
        </div>

        {/* Author + stats */}
        <div className="flex flex-wrap items-center gap-6 pt-4" style={{ borderTop: "1px solid #E6DCC8" }}>
          <div className="flex items-center gap-2">
            <Link href={`/profile/${author?.id}`} className="flex items-center gap-2 hover:underline">
              {author?.image ? (
                <Image
                  src={author.image}
                  alt={author.name ?? "Author"}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center font-jetbrains text-[10px]"
                  style={{ background: accent, color: "#FFFDF5" }}
                >
                  {(author?.name ?? "?")[0].toUpperCase()}
                </div>
              )}
              <span className="font-source-serif text-[13px]" style={{ color: "#5C4E35" }}>
                {author?.name ?? "Unknown author"}
              </span>
            </Link>
            {(course.created_via as string) === "claude" && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 font-jetbrains text-[8px] uppercase tracking-wider"
                style={{ background: "#F0E6FF", color: "#7C3AED", border: "1px solid #D4BFFF", borderRadius: "2px" }}
              >
                <Sparkles className="h-3 w-3" />
                Claude
              </span>
            )}
          </div>

          <div className="flex gap-4 font-jetbrains text-[9px] uppercase tracking-wider" style={{ color: "#8B7355" }}>
            <span>{chapters.length} chapters</span>
            <span>{totalVideos} videos</span>
            <span>{totalNotebooks} notebooks</span>
            {totalPapers > 0 && <span>{totalPapers} papers</span>}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {subscriberCount ?? 0} subscribers
            </span>
          </div>
        </div>
      </div>

      {/* Chapter list — only if user has access */}
      {hasAccess ? (
      <div className="space-y-3">
        <div className="flex items-center gap-4 mb-3">
          <p className="font-jetbrains text-[10px] tracking-[0.18em] uppercase whitespace-nowrap" style={{ color: "#A08E6B" }}>
            § Chapters
          </p>
          <div className="flex-1 h-px" style={{ background: "#C8B882", opacity: 0.5 }} />
        </div>

        {/* Course progress bar */}
        {Object.keys(chapterProgressMap).length > 0 && (() => {
          const total = chapters.length;
          const completed = Object.values(chapterProgressMap).filter(s => s === "completed").length;
          const inProg = Object.values(chapterProgressMap).filter(s => s === "in_progress").length;
          const weightedProgress = completed + inProg * 0.5;
          const pct = total > 0 ? Math.round((weightedProgress / total) * 100) : 0;
          return (
            <div className="mb-4 p-3" style={{ background: "#FFFDF5", border: "1px solid #C8B882" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-jetbrains text-[10px] uppercase tracking-wider" style={{ color: "#5C4E35" }}>
                  {completed}/{total} chapters completed{inProg > 0 ? ` · ${inProg} in progress` : ""}
                </span>
                <span className="font-jetbrains text-[11px] font-bold" style={{ color: pct === 100 ? "#059669" : "#C0392B" }}>
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#E5DCC8" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct === 100 ? "#059669" : "#C0392B" }}
                />
              </div>
            </div>
          );
        })()}

        {chapters.map((ch: { id: string; title: string; description?: string; order: number; chapter_videos: unknown[]; chapter_notebooks: unknown[]; chapter_papers: unknown[] }, idx: number) => {
          const chProgress = chapterProgressMap[ch.id];
          return (
          <Link
            key={ch.id}
            href={`/course/${params.slug}/${ch.id}`}
            className="flex items-start gap-4 p-4 group transition-colors hover:bg-[#F0EAD8]"
            style={{ background: "#FFFDF5", border: "1px solid #C8B882" }}
          >
            <span
              className="font-jetbrains text-[11px] uppercase tracking-wider shrink-0 pt-0.5"
              style={{ color: accent }}
            >
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="font-playfair font-bold text-[16px] mb-1 group-hover:underline" style={{ color: "#1C1610" }}>
                {ch.title}
              </h3>
              {ch.description && (
                <p className="font-source-serif text-[13px] line-clamp-2 mb-2" style={{ color: "#5C4E35" }}>
                  {ch.description}
                </p>
              )}
              <div className="flex gap-4 font-jetbrains text-[9px] uppercase tracking-wider" style={{ color: "#8B7355" }}>
                {(ch.chapter_videos as unknown[])?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Video className="h-3 w-3" /> {(ch.chapter_videos as unknown[]).length} video{(ch.chapter_videos as unknown[]).length !== 1 ? "s" : ""}
                  </span>
                )}
                {(ch.chapter_notebooks as unknown[])?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <FileCode className="h-3 w-3" /> {(ch.chapter_notebooks as unknown[]).length} notebook{(ch.chapter_notebooks as unknown[]).length !== 1 ? "s" : ""}
                  </span>
                )}
                {(ch.chapter_papers as unknown[])?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {(ch.chapter_papers as unknown[]).length} paper{(ch.chapter_papers as unknown[]).length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {chProgress === "completed" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-1" style={{ color: "#059669" }} />
            ) : chProgress === "in_progress" ? (
              <Clock className="h-5 w-5 shrink-0 mt-1" style={{ color: "#CA8A04" }} />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" style={{ color: "#C8B882" }} />
            )}
          </Link>
          );
        })}
      </div>
      ) : (
      <div className="p-8 text-center" style={{ background: "#FFFDF5", border: "1px solid #C8B882" }}>
        <Shield className="h-10 w-10 mx-auto mb-3" style={{ color: "#F59E0B" }} />
        <h2 className="font-playfair font-bold text-[20px] mb-2" style={{ color: "#1C1610" }}>
          This course is restricted
        </h2>
        <p className="font-source-serif text-[14px] mb-6 max-w-md mx-auto" style={{ color: "#5C4E35" }}>
          {accessStatus === "pending"
            ? "Your access request is pending approval from the course owner."
            : accessStatus === "denied"
            ? "Your access request was denied. You can request again."
            : "Request access from the course owner to view chapters and content."}
        </p>
        {accessStatus !== "pending" && accessStatus !== "approved" && (
          <AccessRequestButton courseId={course.id} />
        )}
        {accessStatus === "pending" && (
          <span className="inline-flex items-center gap-2 px-4 py-2 font-jetbrains text-[11px] uppercase tracking-wider" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #F59E0B" }}>
            ⏳ Request Pending
          </span>
        )}
      </div>
      )}

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/home"
          className="font-jetbrains text-[11px] uppercase tracking-wider hover:underline"
          style={{ color: "#C0392B" }}
        >
          ← Back to courses
        </Link>
      </div>
    </div>
  );
}
