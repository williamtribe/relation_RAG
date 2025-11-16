import { founderQuestions } from "../data/founderQuestions";
import type { SwipeLog } from "../types/founder";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const questionIndex = new Map(founderQuestions.map((q, index) => [q.id, index]));

export function buildAnswerVector(logs: SwipeLog[], totalQuestions: number) {
  const vector = Array(totalQuestions).fill(0);
  if (logs.length === 0) {
    return vector;
  }

  const normalizedDurations = logs.map((log) => Math.max(log.durationMs || 0, 120));
  const avgDuration =
    normalizedDurations.reduce((sum, value) => sum + value, 0) / normalizedDurations.length || 1;

  logs.forEach((log, idx) => {
    const targetIndex = questionIndex.get(log.questionId);
    if (targetIndex == null || targetIndex >= totalQuestions) return;

    const duration = normalizedDurations[idx];
    const confidence = clamp(avgDuration / duration, 0.25, 2.5);
    const direction = log.answer === "yes" ? 1 : -1;

    vector[targetIndex] = Number((direction * confidence).toFixed(4));
  });

  return vector;
}
