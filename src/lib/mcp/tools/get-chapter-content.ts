import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_chapter_content",
  title: "Get chapter content",
  description:
    "Look up EduVerse chapter content (concepts and study material) available to the signed-in learner.",
  inputSchema: {
    search: z.string().optional().describe("Optional text to match against chapter titles."),
    limit: z.number().int().optional().describe("Maximum chapters to return (default 5, max 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const rowLimit = Math.min(Math.max(limit ?? 5, 1), 20);

    let query = supabase.from("chapter_content").select("*").limit(rowLimit);
    if (search) query = query.ilike("title", `%${search}%`);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { chapters: data ?? [] },
    };
  },
});
