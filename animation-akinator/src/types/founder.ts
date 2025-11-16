import type { FounderDimension } from "../data/founderQuestions";

export type SwipeAnswerValue = "yes" | "no";

export interface SwipeLog {
  questionId: string;
  answer: SwipeAnswerValue;
  durationMs: number;
  dimension: FounderDimension;
  polarity: 1 | -1;
  weight: number;
  timestamp: string;
}

export interface ParticipantProfile {
  name?: string;
  kakaoId?: string;
}

export interface DimensionScore {
  dimension: FounderDimension;
  score: number;
  confidence: number;
  letter: string;
  label: string;
  blurb: string;
  axis: string;
}

export interface FounderArchetype {
  id: string;
  name: string;
  tagline: string;
  description: string;
  focus: string[];
}

export interface FounderProfileSummary {
  code: string;
  axes: DimensionScore[];
  archetype: FounderArchetype;
}
