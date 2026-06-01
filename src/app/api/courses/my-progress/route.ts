import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", session.user.email)
    .single();

  if (!profile) {
    return NextResponse.json({
      totalChapters: 0,
      completedChapters: 0,
      inProgressChapters: 0,
      percentComplete: 0,
      courseCount: 0,
    });
  }

  // Get all subscriptions for this user
  const { data: subscriptions } = await supabase
    .from("course_subscriptions")
    .select("id, course_id")
    .eq("subscriber_id", profile.id);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({
      totalChapters: 0,
      completedChapters: 0,
      inProgressChapters: 0,
      percentComplete: 0,
      courseCount: 0,
    });
  }

  const subIds = subscriptions.map((s) => s.id);
  const courseIds = subscriptions.map((s) => s.course_id);

  // Get total chapter count across all subscribed courses
  const { count: totalChapters } = await supabase
    .from("course_chapters")
    .select("id", { count: "exact", head: true })
    .in("course_id", courseIds);

  // Get progress records for all subscriptions
  const { data: progress } = await supabase
    .from("subscriber_progress")
    .select("status")
    .in("subscription_id", subIds);

  let completedChapters = 0;
  let inProgressChapters = 0;

  for (const p of progress ?? []) {
    if (p.status === "completed") completedChapters++;
    else if (p.status === "in_progress") inProgressChapters++;
  }

  const total = totalChapters ?? 0;
  const weightedProgress = completedChapters + inProgressChapters * 0.5;
  const percentComplete = total > 0 ? Math.round((weightedProgress / total) * 100) : 0;

  return NextResponse.json({
    totalChapters: total,
    completedChapters,
    inProgressChapters,
    percentComplete,
    courseCount: subscriptions.length,
  });
}
