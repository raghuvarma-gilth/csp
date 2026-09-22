import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "log_learning_progress",
  title: "Log learning progress",
  description:
    "Record or update the signed-in learner's progress on a module topic in EduVerse.",
  inputSchema: {
    module: z.string().trim().describe("Module name, e.g. 'AI Tutor' or 'AR Learning'."),
    topic: z.string().trim().describe("Topic within the module."),
    progress: z.number().describe("Progress percentage from 0 to 100."),
    status: z
      .string()
      .optional()
      .describe("Optional status, e.g. 'in_progress' or 'completed'. Defaults from progress."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ module, topic, progress, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (!module || !topic) {
      return { content: [{ type: "text", text: "module and topic are required" }], isError: true };
    }
    const clamped = Math.min(Math.max(Math.round(progress), 0), 100);
    const resolvedStatus = status ?? (clamped >= 100 ? "completed" : "in_progress");
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: existing, error: findError } = await supabase
      .from("learning_progress")
      .select("id")
      .eq("user_id", userId)
      .eq("module", module)
      .eq("topic", topic)
      .maybeSingle();

    if (findError) {
      return { content: [{ type: "text", text: findError.message }], isError: true };
    }

    const payload = {
      progress: clamped,
      status: resolvedStatus,
      updated_at: new Date().toISOString(),
      completed_at: clamped >= 100 ? new Date().toISOString() : null,
    };

    const { data, error } = existing
      ? await supabase.from("learning_progress").update(payload).eq("id", existing.id).select()
      : await supabase
          .from("learning_progress")
          .insert({ user_id: userId, module, topic, ...payload })
          .select();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? {}, null, 2) }],
      structuredContent: { row: data?.[0] ?? null },
    };
  },
});
