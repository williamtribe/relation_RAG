import { dimensionMeta, founderQuestions } from "../data/founderQuestions";
import type {
  DimensionScore,
  FounderArchetype,
  FounderProfileSummary,
  SwipeLog
} from "../types/founder";

type FounderDimensionKey = keyof typeof dimensionMeta;

const questionMap = new Map(founderQuestions.map((q) => [q.id, q]));

const archetypes: FounderArchetype[] = [
  {
    id: "moonshot-sprinter",
    name: "Moonshot Sprinter",
    tagline: "실험 속도와 비전으로 눌러붙는 타입",
    description:
      "새로운 아이디어를 빠르게 던져보고, 반응이 오면 팀을 다이브시키는 유형입니다. 불확실성에서 에너지를 얻고, 문제보다 기회를 먼저 보는 편이에요.",
    focus: ["실험 속도", "대담한 목표", "강한 리더십"]
  },
  {
    id: "systems-conductor",
    name: "Systems Conductor",
    tagline: "루틴과 공정으로 팀을 안정화하는 전략가",
    description:
      "데이터와 지표로 리스크를 줄이며, 모두가 같은 리듬으로 움직이도록 설계합니다. 시장이 흔들려도 구조화된 실행으로 버티는 타입입니다.",
    focus: ["프로세스 설계", "정밀 실행", "데이터 기반"]
  },
  {
    id: "collective-weaver",
    name: "Collective Weaver",
    tagline: "사람과 네트워크를 엮어 문제를 푸는 연결자",
    description:
      "팀 문화, 커뮤니티, 협업에서 답을 찾습니다. 혼자 달리는 대신 사람을 통해 레버리지를 만들고, 정보 흐름을 세심하게 관리합니다.",
    focus: ["커뮤니티", "팀 케어", "정보 공유"]
  },
  {
    id: "solo-studio",
    name: "Solo Studio",
    tagline: "작은 팀에서 깊이 파고드는 장인형",
    description:
      "핵심 인원과 함께 깊게 몰입하며, 불필요한 소음을 줄입니다. 빠른 피벗보다는 집중도를 유지하며 완성도를 높이는 편입니다.",
    focus: ["정예 팀", "집중도", "디테일"]
  },
  {
    id: "adaptive-pilot",
    name: "Adaptive Pilot",
    tagline: "상황에 맞춰 곡예하듯 전략을 수정하는 조정사",
    description:
      "기회가 보이면 계획을 틀어 잡아내고, 고객 신호에 맞춰 스프린트를 재배치합니다. 감각적인 밸런스로 버텨내는 타입이에요.",
    focus: ["시장 감각", "전략적 전환", "유연함"]
  }
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const confidenceFromDuration = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 1;
  }
  const normalized = 1 - durationMs / 4000;
  return clamp(normalized, 0.35, 1);
};

const pickArchetype = (scores: Record<FounderDimensionKey, number>): FounderArchetype => {
  if (scores.vision > 0.4 && scores.drive > 0.3) {
    return archetypes[0];
  }
  if (scores.execution < -0.25 && scores.drive < -0.2) {
    return archetypes[1];
  }
  if (scores.team > 0.35) {
    return archetypes[2];
  }
  if (scores.team < -0.3 && scores.vision < 0) {
    return archetypes[3];
  }
  if (scores.execution > 0.35) {
    return archetypes[4];
  }
  return archetypes[1];
};

export const computeFounderProfile = (logs: SwipeLog[]): FounderProfileSummary => {
  const totals: Record<FounderDimensionKey, number> = {
    vision: 0,
    drive: 0,
    team: 0,
    execution: 0
  };
  const weightTotals: Record<FounderDimensionKey, number> = {
    vision: 0,
    drive: 0,
    team: 0,
    execution: 0
  };

  logs.forEach((log) => {
    const meta = questionMap.get(log.questionId);
    if (!meta) return;
    const polarity = log.answer === "yes" ? 1 : -1;
    const weighted = polarity * meta.polarity * meta.weight;
    const confidence = confidenceFromDuration(log.durationMs);
    totals[meta.dimension] += weighted * confidence;
    weightTotals[meta.dimension] += meta.weight;
  });

  const axes: DimensionScore[] = (Object.keys(dimensionMeta) as FounderDimensionKey[]).map(
    (dimension) => {
      const meta = dimensionMeta[dimension];
      const weight = weightTotals[dimension] || 1;
      const score = clamp(totals[dimension] / weight, -1, 1);
      const positive = score >= 0;
      const letter = positive ? meta.positive.letter : meta.negative.letter;
      const label = positive ? meta.positive.label : meta.negative.label;
      const blurb = positive ? meta.positive.blurb : meta.negative.blurb;

      return {
        dimension,
        axis: meta.axis,
        score,
        confidence: clamp(weight / 4, 0, 1),
        letter,
        label,
        blurb
      };
    }
  );

  const code = axes.map((axis) => axis.letter).join("");
  const archetype = pickArchetype(
    axes.reduce(
      (acc, axis) => {
        acc[axis.dimension] = axis.score;
        return acc;
      },
      {} as Record<FounderDimensionKey, number>
    )
  );

  return {
    code,
    axes,
    archetype
  };
};
