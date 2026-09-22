import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/api";

/**
 * What the server can actually do right now.
 *
 * Every AI surface asks this before offering a button. A missing Gemini key
 * becomes a visible "not configured yet" notice instead of a control that
 * throws when pressed — and nothing anywhere falls back to a canned reply.
 */

export interface ApiHealth {
  status: "ok" | "degraded";
  version: string;
  features: {
    database: boolean;
    tutor: boolean;
    quizzes: boolean;
    diagnostic: boolean;
    codeMentor: boolean;
    codeExecution: boolean;
    retrieval: boolean;
  };
  runnableLanguages: string[];
  models: { chat: string | null; embeddings: string | null };
  missingConfiguration: string[];
}

export const useApiHealth = () =>
  useQuery<ApiHealth>({
    queryKey: ["api-health"],
    queryFn: () => getJson<ApiHealth>("health"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

/**
 * A single feature flag with the message to show when it is off. `undefined`
 * while loading, so a caller can avoid flashing "unavailable" at a server that
 * is simply slow to answer.
 */
export const useFeature = (feature: keyof ApiHealth["features"]) => {
  const { data, isLoading, error } = useApiHealth();

  if (isLoading) return { available: undefined, message: null, isLoading: true };
  if (error || !data) {
    return {
      available: false,
      message: "The EduVerse API server is not reachable, so AI features are unavailable.",
      isLoading: false,
    };
  }

  return {
    available: data.features[feature],
    message: data.features[feature]
      ? null
      : `This needs configuration on the server: ${data.missingConfiguration.join(", ") || "an API key is missing"}.`,
    isLoading: false,
  };
};
