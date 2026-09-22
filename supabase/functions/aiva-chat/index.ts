import { preflight, handleError, json, PublicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { generateJson, geminiConfigured } from "../_shared/gemini.ts";
import { embedOne, embeddingsConfigured } from "../_shared/embeddings.ts";

/**
 * AIVA — the tutor. One conversation surface, six teaching modes.
 *
 * Grounding rule (spec §21): retrieved course material is the only source the
 * model may treat as authoritative about THIS course. When retrieval finds
 * nothing relevant, the reply is marked ungrounded and says so, rather than
 * confidently inventing a syllabus detail.
 */

type Mode = "explain" | "socratic" | "hint" | "practice" | "revision" | "exam";

const MODES: Record<Mode, string> = {
  explain:
    "Explain the idea clearly, building from what the student already knows. Use one concrete worked example and name the key intuition. Keep it under 250 words.",
  socratic:
    "Do NOT give the answer. Ask exactly one focused question that moves the student one step forward, and briefly say why that step matters. If their last message contained a misconception, target it.",
  hint: "Give the smallest hint that unblocks them. Never write the full solution or the final code. One or two sentences.",
  practice:
    "Pose one practice problem at the student's current level, then stop and wait. Do not reveal the answer in the same message.",
  revision:
    "Produce a compact revision summary: the core idea, the two things most often got wrong, and one self-check question.",
  exam:
    "Answer as an examiner would: precise, structured, with the marking points made explicit. State complexity and edge cases where relevant.",
};

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    used_sources: { type: "boolean" },
    detected_misconception: {
      type: "object",
      nullable: true,
      properties: {
        statement: { type: "string" },
        correction: { type: "string" },
      },
      required: ["statement", "correction"],
    },
  },
  required: ["reply", "used_sources"],
};

interface ModelReply {
  reply: string;
  used_sources: boolean;
  detected_misconception?: { statement: string; correction: string } | null;
}

interface Source {
  document_id: string;
  document_title: string;
  concept_title: string | null;
  heading: string | null;
  snippet: string;
  similarity: number;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    if (!geminiConfigured()) {
      throw new PublicError(
        "The AI tutor is not configured yet. An administrator needs to add a Gemini API key to this project.",
        503,
        "ai_not_configured",
      );
    }

    const user = await requireUser(req);
    const db = adminClient();

    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mode: Mode = MODES[body.mode as Mode] ? (body.mode as Mode) : "explain";
    const conceptId = typeof body.conceptId === "string" ? body.conceptId : null;
    let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;

    if (!message) throw new PublicError("Type a question first.", 400, "empty_message");
    if (message.length > 4000) {
      throw new PublicError("That message is too long. Keep it under 4000 characters.", 400, "message_too_long");
    }

    // --- Concept context (only published material is visible to a learner) ---
    let concept: { id: string; title: string; summary: string | null; chapter: string } | null = null;
    if (conceptId) {
      const { data } = await db
        .from("concepts")
        .select("id, title, summary, status, chapters(title)")
        .eq("id", conceptId)
        .maybeSingle();
      if (data && data.status === "published") {
        concept = {
          id: data.id,
          title: data.title,
          summary: data.summary,
          chapter: (data.chapters as { title: string } | null)?.title ?? "",
        };
      }
    }

    // --- Retrieval ---------------------------------------------------------
    let sources: Source[] = [];
    let retrievalUnavailable = false;

    if (embeddingsConfigured()) {
      try {
        const queryEmbedding = await embedOne(message);
        const { data: matches, error } = await db.rpc("match_content_chunks", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_count: 6,
          min_similarity: 0.35,
          filter_concept: conceptId,
        });
        if (error) throw error;
        sources = (matches ?? []).map((m: Record<string, unknown>) => ({
          document_id: m.document_id as string,
          document_title: m.document_title as string,
          concept_title: (m.concept_title as string) ?? null,
          heading: (m.heading as string) ?? null,
          snippet: (m.content as string).slice(0, 600),
          similarity: Number(m.similarity),
        }));
      } catch (cause) {
        // Retrieval being down must not silently become "no course material".
        console.error("Retrieval failed:", cause);
        retrievalUnavailable = true;
      }
    } else {
      retrievalUnavailable = true;
    }

    // --- Conversation history ---------------------------------------------
    if (conversationId) {
      const { data: owned } = await db
        .from("ai_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!owned) conversationId = null;
    }

    if (!conversationId) {
      const { data: created, error } = await db
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          concept_id: concept?.id ?? null,
          mode,
          title: message.slice(0, 60),
        })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = created.id;
    }

    const { data: history } = await db
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // --- Prompt ------------------------------------------------------------
    const contextBlock = sources.length
      ? sources
          .map(
            (s, i) =>
              `[${i + 1}] ${s.document_title}${s.heading ? ` — ${s.heading}` : ""}\n${s.snippet}`,
          )
          .join("\n\n")
      : "(no matching course material was retrieved)";

    const system = [
      "You are AIVA, the tutor inside EduVerse. You teach computer science, especially data structures and algorithms.",
      "",
      `TEACHING MODE: ${mode}. ${MODES[mode]}`,
      "",
      concept
        ? `The student is currently studying "${concept.title}" in the chapter "${concept.chapter}". ${concept.summary ?? ""}`
        : "The student has not opened a specific concept.",
      "",
      "COURSE MATERIAL RETRIEVED FOR THIS QUESTION:",
      contextBlock,
      "",
      "RULES — these are not negotiable:",
      "1. Anything specific to THIS course — its syllabus, deadlines, grading, which chapters exist, what a particular lecture said — may only come from the retrieved material above. If it is not there, say you could not verify it against their course material and suggest they ask their instructor. Never guess it.",
      "2. General computer-science knowledge (how a stack works, what O(n) means) you may explain freely from your own knowledge. That is not course-specific.",
      "3. Set used_sources to true only if you actually relied on the retrieved material.",
      "4. Write in markdown. Use fenced code blocks with a language tag for code.",
      "5. If the student's message reveals a specific incorrect belief, put it in detected_misconception as the belief in their own terms plus the correction. Otherwise set it to null. Do not invent one to fill the field.",
      "6. Never claim to have seen their grades, attendance, or personal records.",
    ].join("\n");

    const turns = [
      ...(history ?? []).map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const result = await generateJson<ModelReply>({
      system,
      turns,
      temperature: mode === "exam" ? 0.2 : 0.5,
      responseSchema: SCHEMA,
    });

    const grounded = Boolean(result.used_sources) && sources.length > 0;

    // --- Persist -----------------------------------------------------------
    await db.from("ai_messages").insert([
      { conversation_id: conversationId, user_id: user.id, role: "user", content: message, grounded: false },
      {
        conversation_id: conversationId,
        user_id: user.id,
        role: "assistant",
        content: result.reply,
        grounded,
        sources: grounded
          ? sources.map((s) => ({
              document_id: s.document_id,
              title: s.document_title,
              heading: s.heading,
              concept: s.concept_title,
              similarity: Number(s.similarity.toFixed(3)),
            }))
          : [],
      },
    ]);

    await db.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    // Misconceptions are only recorded against a real, published concept —
    // otherwise there is nothing for the student to practise against.
    let misconception: { statement: string; correction: string } | null = null;
    if (result.detected_misconception?.statement && concept) {
      misconception = result.detected_misconception;
      const { data: existing } = await db
        .from("student_misconceptions")
        .select("id, detected_count")
        .eq("user_id", user.id)
        .eq("concept_id", concept.id)
        .eq("statement", misconception.statement)
        .maybeSingle();

      if (existing) {
        await db
          .from("student_misconceptions")
          .update({
            detected_count: existing.detected_count + 1,
            last_detected_at: new Date().toISOString(),
            resolved: false,
            resolved_at: null,
          })
          .eq("id", existing.id);
      } else {
        await db.from("student_misconceptions").insert({
          user_id: user.id,
          concept_id: concept.id,
          statement: misconception.statement,
          correction: misconception.correction,
          source: "tutor",
        });
      }
    }

    return json({
      conversationId,
      reply: result.reply,
      grounded,
      retrievalUnavailable,
      sources: grounded
        ? sources.map((s) => ({
            title: s.document_title,
            heading: s.heading,
            concept: s.concept_title,
            similarity: Number(s.similarity.toFixed(3)),
          }))
        : [],
      misconception,
    });
  } catch (error) {
    return handleError(error);
  }
});
