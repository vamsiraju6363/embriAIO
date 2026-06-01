import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { courseId } = params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Verify subscription exists
  const { data: subscription } = await supabase
    .from("course_subscriptions")
    .select("id")
    .eq("course_id", courseId)
    .eq("subscriber_id", profile.id)
    .single();

  if (!subscription) {
    return NextResponse.json(
      { error: "Not subscribed to this course" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { videoId, percentWatched, chapterId } = body;

  if (!videoId || percentWatched === undefined || !chapterId) {
    return NextResponse.json(
      { error: "videoId, percentWatched, and chapterId are required" },
      { status: 400 }
    );
  }

  if (typeof percentWatched !== "number" || percentWatched < 0 || percentWatched > 100) {
    return NextResponse.json(
      { error: "percentWatched must be a number between 0 and 100" },
      { status: 400 }
    );
  }

  // Verify chapter belongs to this course
  const { data: chapter } = await supabase
    .from("course_chapters")
    .select("id")
    .eq("id", chapterId)
    .eq("course_id", courseId)
    .single();

  if (!chapter) {
    return NextResponse.json(
      { error: "Chapter not found in this course" },
      { status: 404 }
    );
  }

  // Get all videos in this chapter
  const { data: videos, error: videosError } = await supabase
    .from("chapter_videos")
    .select("id")
    .eq("chapter_id", chapterId);

  if (videosError) {
    return NextResponse.json(
      { error: "Failed to fetch chapter videos" },
      { status: 500 }
    );
  }

  const videoIds = (videos ?? []).map((v) => v.id);
  if (!videoIds.includes(videoId)) {
    return NextResponse.json(
      { error: "Video not found in this chapter" },
      { status: 404 }
    );
  }

  const now = new Date().toISOString();

  // Get current progress for this chapter
  const { data: currentProgress } = await supabase
    .from("subscriber_progress")
    .select("status")
    .eq("subscription_id", subscription.id)
    .eq("chapter_id", chapterId)
    .single();

  let newStatus = currentProgress?.status ?? "not_started";

  if (percentWatched > 0 && newStatus === "not_started") {
    newStatus = "in_progress";
  }

  // Auto-complete: if this video is ≥90% and it's the only video, mark chapter as completed
  if (percentWatched >= 90) {
    if (videoIds.length === 1) {
      newStatus = "completed";
    } else if (newStatus === "not_started") {
      newStatus = "in_progress";
    }
  }

  const updates: Record<string, unknown> = {
    subscription_id: subscription.id,
    chapter_id: chapterId,
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === "in_progress" && !currentProgress?.status) {
    updates.started_at = now;
  }

  if (newStatus === "completed") {
    updates.completed_at = now;
    if (!currentProgress?.status) {
      updates.started_at = now;
    }
  }

  const { error: upsertError } = await supabase
    .from("subscriber_progress")
    .upsert(updates, { onConflict: "subscription_id,chapter_id" })
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
