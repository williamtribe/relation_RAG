export type FounderDimension = "vision" | "drive" | "team" | "execution";

export interface DimensionMeta {
  id: FounderDimension;
  axis: string;
  positive: {
    letter: string;
    label: string;
    blurb: string;
  };
  negative: {
    letter: string;
    label: string;
    blurb: string;
  };
}

export interface FounderQuestion {
  id: string;
  prompt: string;
  dimension: FounderDimension;
  polarity: 1 | -1;
  weight: number;
  tags?: string[];
}

export const dimensionMeta: Record<FounderDimension, DimensionMeta> = {
  vision: {
    id: "vision",
    axis: "Moonshot vs. Grounded",
    positive: {
      letter: "V",
      label: "Moonshot",
      blurb: "거대한 파장을 만들기 위해 불확실성도 즐깁니다."
    },
    negative: {
      letter: "G",
      label: "Grounded",
      blurb: "정확한 시장 타이밍과 실행력을 우선합니다."
    }
  },
  drive: {
    id: "drive",
    axis: "Sprint vs. Compose",
    positive: {
      letter: "S",
      label: "Sprinter",
      blurb: "속도를 통해 학습하며, 미세 조정은 나중 문제입니다."
    },
    negative: {
      letter: "C",
      label: "Composer",
      blurb: "리듬과 루틴으로 버티는 체력을 중요하게 여깁니다."
    }
  },
  team: {
    id: "team",
    axis: "Collective vs. Solo",
    positive: {
      letter: "C",
      label: "Collective",
      blurb: "팀의 에너지를 끌어올리고 넓게 협업합니다."
    },
    negative: {
      letter: "I",
      label: "Independent",
      blurb: "작은 정예 팀에서 깊은 몰입으로 성과를 냅니다."
    }
  },
  execution: {
    id: "execution",
    axis: "Adaptive vs. Systematic",
    positive: {
      letter: "A",
      label: "Adaptive",
      blurb: "상황이 흔들리면 곧바로 전략을 틀 수 있습니다."
    },
    negative: {
      letter: "M",
      label: "Methodical",
      blurb: "지표와 공정성을 맞추며 반복 가능한 구조를 만듭니다."
    }
  }
};

export const founderQuestions: FounderQuestion[] = [
  {
    id: "q1",
    prompt: "3년 안에 글로벌 시장을 가정하고 제품을 설계한다.",
    dimension: "vision",
    polarity: 1,
    weight: 1.2,
    tags: ["moonshot", "strategy"]
  },
  {
    id: "q2",
    prompt: "시장 반응이 확실해질 때까지 출시를 미룬 적이 있다.",
    dimension: "vision",
    polarity: -1,
    weight: 1,
    tags: ["risk", "validation"]
  },
  {
    id: "q3",
    prompt: "투자를 받을 때, 성장 스토리보다 단위 경제성을 먼저 보여준다.",
    dimension: "vision",
    polarity: -1,
    weight: 0.9,
    tags: ["finance"]
  },
  {
    id: "q4",
    prompt: "제품 로드맵에 '세상을 뒤집을 실험'이 항상 들어있다.",
    dimension: "vision",
    polarity: 1,
    weight: 1.1,
    tags: ["product"]
  },
  {
    id: "q5",
    prompt: "규모보다 생존 확률이 더 중요한 시기가 있었다.",
    dimension: "vision",
    polarity: -1,
    weight: 0.8,
    tags: ["resilience"]
  },
  {
    id: "q6",
    prompt: "새 기능을 생각하면 일단 '언제까지 만들지'부터 정한다.",
    dimension: "drive",
    polarity: 1,
    weight: 1.1,
    tags: ["cadence"]
  },
  {
    id: "q7",
    prompt: "팀 속도를 위해 품질 기준을 과감히 낮춘 경험이 많다.",
    dimension: "drive",
    polarity: 1,
    weight: 1,
    tags: ["tradeoff"]
  },
  {
    id: "q8",
    prompt: "하루를 캘린더/업무 툴 없이 보내면 불안하다.",
    dimension: "drive",
    polarity: -1,
    weight: 1,
    tags: ["ritual"]
  },
  {
    id: "q9",
    prompt: "빠르게 달리는 대신 갈아엎는 리스크를 줄이는 편이다.",
    dimension: "drive",
    polarity: -1,
    weight: 0.9,
    tags: ["risk"]
  },
  {
    id: "q10",
    prompt: "첫 시제품을 일주일 안에 보여준 경험이 있다.",
    dimension: "drive",
    polarity: 1,
    weight: 1.2,
    tags: ["prototype"]
  },
  {
    id: "q11",
    prompt: "팀 문화나 케어에 쓰는 시간이 매주 캘린더에 묶여 있다.",
    dimension: "team",
    polarity: 1,
    weight: 1,
    tags: ["culture"]
  },
  {
    id: "q12",
    prompt: "중요한 의사결정은 결국 내가 혼자 내리는 편이다.",
    dimension: "team",
    polarity: -1,
    weight: 1,
    tags: ["ownership"]
  },
  {
    id: "q13",
    prompt: "정보를 모두 공유하면 속도가 느려지므로 필터링한다.",
    dimension: "team",
    polarity: -1,
    weight: 0.9,
    tags: ["communication"]
  },
  {
    id: "q14",
    prompt: "외부 멘토나 커뮤니티에서 자주 인사이트를 얻는다.",
    dimension: "team",
    polarity: 1,
    weight: 0.9,
    tags: ["community"]
  },
  {
    id: "q15",
    prompt: "팀의 감정 온도를 수치화하거나 기록해 본 적이 있다.",
    dimension: "team",
    polarity: 1,
    weight: 1.1,
    tags: ["health"]
  },
  {
    id: "q16",
    prompt: "데이터가 없으면 결정을 미루고 싶어진다.",
    dimension: "execution",
    polarity: -1,
    weight: 1.1,
    tags: ["data"]
  },
  {
    id: "q17",
    prompt: "고객 피드백에 맞춰 스프린트 계획을 바로 바꾼다.",
    dimension: "execution",
    polarity: 1,
    weight: 1,
    tags: ["agility"]
  },
  {
    id: "q18",
    prompt: "사람보다 프로세스에 문제가 있다고 느낄 때가 많다.",
    dimension: "execution",
    polarity: -1,
    weight: 1,
    tags: ["process"]
  },
  {
    id: "q19",
    prompt: "예상치 못한 기회가 오면 계획을 틀어서라도 붙잡는다.",
    dimension: "execution",
    polarity: 1,
    weight: 1,
    tags: ["opportunity"]
  },
  {
    id: "q20",
    prompt: "장기 KPI를 매주 리뷰하며 쪼개는 시간을 확보한다.",
    dimension: "execution",
    polarity: -1,
    weight: 1.1,
    tags: ["kpi"]
  }
];
