import type { FounderProfileSummary, ParticipantProfile, SwipeLog } from "../types/founder";
import { supabase, hasSupabaseCredentials } from "./supabaseClient";

export const bootstrapSwipeSession = async (
  participant: ParticipantProfile,
  options: { deckVersion?: string; questionCount: number }
): Promise<string | null> => {
  if (!supabase || !hasSupabaseCredentials) return null;

  const fallbackName = participant.name?.trim() || participant.kakaoId || "익명 창업가";

  const payload = {
    deck_version: options.deckVersion ?? "founder-deck-v1",
    question_count: options.questionCount,
    participant_name: fallbackName,
    kakao_id: participant.kakaoId
  };

  const { data, error } = await supabase
    .from("founder_swipe_sessions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.warn("[supabase] failed to create swipe session", error);
    return null;
  }

  return data?.id ?? null;
};

export const logSwipeAnswer = async (
  sessionId: string,
  log: SwipeLog
): Promise<void> => {
  if (!supabase || !hasSupabaseCredentials) return;

  const { error } = await supabase.from("founder_swipe_answers").insert({
    session_id: sessionId,
    question_id: log.questionId,
    answer_value: log.answer === "yes",
    duration_ms: Math.round(log.durationMs),
    dimension: log.dimension,
    polarity: log.polarity,
    weight: log.weight,
    recorded_at: log.timestamp
  });

  if (error) {
    console.warn("[supabase] failed to log swipe answer", error);
  }
};

export const finalizeSwipeSession = async (
  sessionId: string,
  summary: FounderProfileSummary,
  answerVector: number[]
): Promise<void> => {
  if (!supabase || !hasSupabaseCredentials) return;

  const dimensionScores = summary.axes.reduce<Record<string, number>>((acc, axis) => {
    acc[axis.dimension] = Number(axis.score.toFixed(3));
    return acc;
  }, {});

  const { error } = await supabase
    .from("founder_swipe_sessions")
    .update({
      status: "completed",
      profile_code: summary.code,
      archetype_id: summary.archetype.id,
      dimension_scores: dimensionScores,
      answer_vector: answerVector,
      completed_at: new Date().toISOString()
    })
    .eq("id", sessionId);

  if (error) {
    console.warn("[supabase] failed to finalize swipe session", error);
  }
};

export const syncSessionParticipant = async (
  sessionId: string,
  participant: ParticipantProfile
): Promise<void> => {
  if (!supabase || !hasSupabaseCredentials) return;

  const updates = {
    kakao_id: participant.kakaoId,
    participant_name: participant.name,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from("founder_swipe_sessions")
    .update(updates)
    .eq("id", sessionId);

  if (error) {
    console.warn("[supabase] failed to sync participant info", error);
  }
};
