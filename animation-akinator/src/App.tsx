import { createRef, useEffect, useMemo, useRef, useState } from "react";
import TinderCard from "react-tinder-card";
import { founderQuestions } from "./data/founderQuestions";
import {
  bootstrapSwipeSession,
  finalizeSwipeSession,
  logSwipeAnswer,
  syncSessionParticipant
} from "./lib/founderPersistence";
import { computeFounderProfile } from "./lib/founderProfile";
import type { ParticipantProfile, SwipeAnswerValue, SwipeLog } from "./types/founder";
import { useKakaoAuth } from "./hooks/useKakaoAuth";
import { KakaoLoginPanel } from "./components/KakaoLoginPanel";
import { buildAnswerVector } from "./lib/answerVector";

const DECK_VERSION = "founder-deck-v1";
const PARTICIPANT_STORAGE_KEY = "founderSwipe.participant";

const directionToAnswer: Record<string, SwipeAnswerValue | null> = {
  right: "yes",
  left: "no",
  up: null,
  down: null
};

type CardRef = {
  swipe: (direction: "left" | "right" | "up" | "down") => Promise<void>;
  restoreCard: () => Promise<void>;
};

const loadParticipant = (): ParticipantProfile => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export default function App() {
  const deck = useMemo(() => [...founderQuestions], []);
  const [participant, setParticipant] = useState<ParticipantProfile>(() => loadParticipant());
  const [answers, setAnswers] = useState<SwipeLog[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deckIndex, setDeckIndex] = useState(deck.length - 1);
  const [lastAnswer, setLastAnswer] = useState<SwipeAnswerValue | null>(null);
  const [runId, setRunId] = useState(0);
  const { user: kakaoUser, loading: kakaoLoading, login: loginWithKakao, logout: logoutKakao } = useKakaoAuth();

  const swipeStartRef = useRef(performance.now());
  const currentIndexRef = useRef(deckIndex);
  const sessionPromiseRef = useRef<Promise<string | null> | null>(null);

  const cardRefs = useMemo(() => deck.map(() => createRef<CardRef>()), [deck, runId]);

  const updateDeckIndex = (value: number) => {
    setDeckIndex(value);
    currentIndexRef.current = value;
    swipeStartRef.current = performance.now();
  };

  const activeQuestion = deck[deckIndex] ?? null;
  const answeredCount = answers.length;
  const totalQuestions = deck.length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);
  const profile = useMemo(() => computeFounderProfile(answers), [answers]);
  const answerVector = useMemo(() => buildAnswerVector(answers, totalQuestions), [answers, totalQuestions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(participant));
  }, [participant]);

  useEffect(() => {
    if (kakaoUser) {
      setParticipant((prev) => ({
        ...prev,
        kakaoId: kakaoUser.id,
        name: prev.name || kakaoUser.nickname || prev.name
      }));
    } else {
      setParticipant((prev) => ({
        ...prev,
        kakaoId: undefined
      }));
    }
  }, [kakaoUser]);

  useEffect(() => {
    if (!sessionId) return;
    if (!participant.kakaoId) return;
    void syncSessionParticipant(sessionId, participant);
  }, [participant.kakaoId, sessionId, participant.name]);

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    sessionPromiseRef.current = bootstrapSwipeSession(participant, {
      deckVersion: DECK_VERSION,
      questionCount: totalQuestions
    });

    const createdId = await sessionPromiseRef.current;
    sessionPromiseRef.current = null;
    if (createdId) {
      setSessionId(createdId);
    }
    return createdId;
  };

  useEffect(() => {
    if (!sessionId) return;
    if (answers.length !== totalQuestions) return;
    void finalizeSwipeSession(sessionId, profile, answerVector);
  }, [answers, sessionId, totalQuestions, answerVector, profile]);

  const recordAnswer = (questionIndex: number, answerValue: SwipeAnswerValue) => {
    const question = deck[questionIndex];
    if (!question) return;

    const logEntry: SwipeLog = {
      questionId: question.id,
      answer: answerValue,
      durationMs: performance.now() - swipeStartRef.current,
      dimension: question.dimension,
      polarity: question.polarity,
      weight: question.weight,
      timestamp: new Date().toISOString()
    };

    setAnswers((prev) => [...prev, logEntry]);
    setLastAnswer(answerValue);

    void ensureSession().then((id) => {
      if (id) {
        void logSwipeAnswer(id, logEntry);
      }
    });
  };

  const handleSwipe = (direction: string, questionIndex: number) => {
    const answerValue = directionToAnswer[direction];
    if (!answerValue) return;
    if (currentIndexRef.current !== questionIndex) return;

    recordAnswer(questionIndex, answerValue);
    updateDeckIndex(questionIndex - 1);
  };

  const handleUndo = async () => {
    if (answers.length === 0) return;
    const newIndex = currentIndexRef.current + 1;
    if (newIndex >= deck.length) return;

    const ref = cardRefs[newIndex]?.current;
    setAnswers((prev) => prev.slice(0, -1));
    setLastAnswer(null);

    updateDeckIndex(newIndex);
    if (ref) {
      await ref.restoreCard();
    }
  };

  const handleReset = () => {
    setAnswers([]);
    setLastAnswer(null);
    setSessionId(null);
    setRunId((prev) => prev + 1);
    updateDeckIndex(deck.length - 1);
  };

  const manualSwipe = async (direction: "left" | "right") => {
    if (deckIndex < 0) return;
    const ref = cardRefs[deckIndex]?.current;
    if (ref) {
      await ref.swipe(direction);
    } else {
      handleSwipe(direction, deckIndex);
    }
  };

  const handleParticipantChange = (field: keyof ParticipantProfile, value: string) => {
    setParticipant((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Founder Swipe Lab</p>
          <h1>20장의 카드로 보는 나의 창업자 MBTI</h1>
          <p className="lede">
            오른쪽은 <strong>예</strong>, 왼쪽은 <strong>아니오</strong>. 스와이프 속도와 방향으로
            당신의 창업 성향을 실시간으로 분석합니다.
          </p>
        </div>
        <div className="progress-indicator">
          <span>{answeredCount}/{totalQuestions}</span>
          <div className="progress-bar">
            <div className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      <main className="app-grid">
        <section className="swipe-column">
          <div className="card-stack">
            {deck.map((question, index) => (
              <TinderCard
                key={`${question.id}-${runId}`}
                ref={cardRefs[index]}
                className={`tinder-card ${index <= deckIndex ? "active" : "inactive"}`}
                onSwipe={(direction) => handleSwipe(direction, index)}
                preventSwipe={["up", "down"]}
              >
                <div className="question-card">
                  <p className="card-index">Q{question.id.replace("q", "")}</p>
                  <h2>{question.prompt}</h2>
                  <p className="dimension-tag">{question.dimension}</p>
                </div>
              </TinderCard>
            ))}
            {deckIndex < 0 && (
              <div className="question-card finished">
                <p>20개의 응답이 모두 기록되었습니다.</p>
                <p>오른쪽 인사이트에서 당신의 타입을 확인해 보세요.</p>
              </div>
            )}
          </div>
          <div className="swipe-controls">
            <button onClick={() => manualSwipe("left")} disabled={deckIndex < 0}>
              아니오 (왼쪽)
            </button>
            <button onClick={handleUndo} disabled={answers.length === 0}>
              되돌리기
            </button>
            <button onClick={() => manualSwipe("right")} disabled={deckIndex < 0}>
              예 (오른쪽)
            </button>
          </div>
          <div className="secondary-actions">
            <button onClick={handleReset}>새로운 덱으로 다시 시작</button>
            <p className="hint">
              최근 답변:{" "}
              {lastAnswer ? (lastAnswer === "yes" ? "예 👍" : "아니오 👎") : "아직 없어요"}
            </p>
          </div>
        </section>

        <section className="insight-column">
          <div className="participant-card">
            <h3>참여자 메모</h3>
            <KakaoLoginPanel
              user={kakaoUser}
              loading={kakaoLoading}
              onLogin={loginWithKakao}
              onLogout={logoutKakao}
            />
            <div className="form-grid">
              <label>
                이름 / 닉네임
                <input
                  value={participant.name ?? ""}
                  onChange={(e) => handleParticipantChange("name", e.target.value)}
                  placeholder="예: 김창업"
                />
              </label>
              <label>
                카카오 로그인 ID
                <input
                  value={participant.kakaoId ?? ""}
                  onChange={(e) => handleParticipantChange("kakaoId", e.target.value)}
                  placeholder="kakao_1234 (선택)"
                />
              </label>
            </div>
          </div>

          <div className="insights-panel">
            <div className="profile-headline">
              <p className="eyebrow">실시간 MBTI</p>
              <h2>{profile.code}</h2>
              <p>{profile.archetype.name}</p>
              <span className="tagline">{profile.archetype.tagline}</span>
            </div>

            <div className="dimension-grid">
              {profile.axes.map((axis) => (
                <div key={axis.dimension} className="dimension-card">
                  <div className="dimension-header">
                    <p>{axis.axis}</p>
                    <strong>{axis.label}</strong>
                  </div>
                  <div className="dimension-bar">
                    <div
                      className={`dimension-fill ${axis.score >= 0 ? "positive" : "negative"}`}
                      style={{ width: `${Math.abs(axis.score) * 100}%` }}
                    />
                  </div>
                  <p className="dimension-copy">{axis.blurb}</p>
                </div>
              ))}
            </div>

            <div className="archetype-card">
              <h4>{profile.archetype.name}</h4>
              <p>{profile.archetype.description}</p>
              <div className="focus-chips">
                {profile.archetype.focus.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
