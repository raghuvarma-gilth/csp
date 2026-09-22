import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_learning_overview",
  title: "Get learning overview",
  description:
    "Get the signed-in learner's profile, streak, and overall module progress in EduVerse.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [profile, streak, progress] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      supabase
        .from("learning_streaks")
        .select("current_streak, longest_streak, total_active_days, last_active_date")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("learning_progress")
        .select("module, topic, progress, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    const error = profile.error || streak.error || progress.error;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const overview = {
      displayName: profile.data?.display_name ?? null,
      streak: streak.data ?? null,
      modules: progress.data ?? [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(overview, null, 2) }],
      structuredContent: overview,
    };
  },
});
