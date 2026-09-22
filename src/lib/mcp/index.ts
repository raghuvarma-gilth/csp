import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getLearningOverview from "./tools/get-learning-overview";
import listConceptProgress from "./tools/list-concept-progress";
import logLearningProgress from "./tools/log-learning-progress";
import getChapterContent from "./tools/get-chapter-content";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "eduverse-ai-explorer",
  title: "EduVerse AI Explorer",
  version: "0.1.0",
  instructions:
    "Tools for EduVerse AI Explorer, an adaptive learning platform. Use `get_learning_overview` for the learner's streak and module progress, `list_concept_progress` for per-concept quiz scores and attempts, `get_chapter_content` to read study material, and `log_learning_progress` to record progress on a module topic. All tools act as the signed-in learner.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getLearningOverview, listConceptProgress, getChapterContent, logLearningProgress],
});
