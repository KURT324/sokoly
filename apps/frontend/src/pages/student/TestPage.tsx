import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { testsApi, Test, TestQuestion, SubmitResult } from '../../api/tests';
import { DrawingCanvas } from '../../components/DrawingCanvas';

interface Answers {
  [questionId: string]: {
    answer_ids?: string[];
    text?: string;
    drawing_data?: string;
  };
}

export function StudentTestPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!testId) return;
    testsApi.getTest(testId).then((r) => {
      setTest(r.data);
      if (r.data.time_limit_min) {
        setTimeLeft(r.data.time_limit_min * 60);
      }
    }).finally(() => setLoading(false));
  }, [testId]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || result) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = setInterval(() => setTimeLeft((t) => (t !== null ? t - 1 : null)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft, result]);

  const handleSubmit = async () => {
    if (!test || !testId || submitting) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitting(true);

    const payload = test.questions.map((q) => {
      const ans = answers[q.id] ?? {};
      return { question_id: q.id, ...ans };
    });

    try {
      const r = await testsApi.submitTest(testId, payload);
      setResult(r.data);
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswerField = (qId: string, patch: Partial<Answers[string]>) =>
    setAnswers((prev) => ({ ...prev, [qId]: { ...(prev[qId] ?? {}), ...patch } }));

  if (loading) return <Layout><div className="text-center text-gray-400 dark:text-slate-500 py-12">Загрузка...</div></Layout>;
  if (!test) return <Layout><div className="text-center text-gray-400 dark:text-slate-500 py-12">Тест не найден</div></Layout>;

  // Result screen
  if (result) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Результаты</h1>

          {result.show_result && result.auto_score != null ? (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
              <div className="text-center">
                <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">{result.auto_score.toFixed(0)}%</div>
                <p className="text-gray-500 dark:text-slate-400 mt-2">правильных ответов</p>
              </div>

              <div className="space-y-3 mt-4">
                {result.questions?.filter((q) => q.type === 'SINGLE' || q.type === 'MULTIPLE').map((q) => {
                  const detail = result.answers_detail?.find((a) => a.question_id === q.id);
                  const isCorrect = detail?.is_correct;
                  return (
                    <div key={q.id} className={`flex items-start gap-3 p-3 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <span className="text-lg">{isCorrect ? '✅' : '❌'}</span>
                      <p className="text-sm text-gray-800 dark:text-slate-100">{q.question_text}</p>
                    </div>
                  );
                })}
                {(result.questions?.some((q) => q.type === 'OPEN_TEXT' || q.type === 'DRAWING')) && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                    Некоторые вопросы ждут проверки преподавателем
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📬</div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Ответы отправлены</h2>
              <p className="text-gray-500 dark:text-slate-400">Ждите проверки инструктора</p>
            </div>
          )}

          <button
            onClick={() => navigate('/student/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            На главную
          </button>
        </div>
      </Layout>
    );
  }

  const question = test.questions[currentIdx];
  const totalQ = test.questions.length;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">{test.title}</h1>
          {timeLeft !== null && (
            <div className={`font-mono text-lg font-semibold px-3 py-1 rounded-lg ${timeLeft < 60 ? 'bg-red-100 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200'}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {test.questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIdx(i)}
              className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                i === currentIdx
                  ? 'bg-blue-600 text-white'
                  : answers[q.id]
                  ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                  : 'bg-gray-200 text-gray-500 dark:text-slate-400'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500 dark:text-slate-400">Вопрос {currentIdx + 1} из {totalQ}</p>

        {/* Question */}
        <QuestionRenderer
          question={question}
          answer={answers[question.id] ?? {}}
          onAnswer={(patch) => setAnswerField(question.id, patch)}
        />

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 disabled:opacity-40"
          >
            ← Назад
          </button>

          {currentIdx < totalQ - 1 ? (
            <button
              onClick={() => setCurrentIdx((i) => i + 1)}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Далее →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {submitting ? 'Отправка...' : 'Отправить тест'}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}

function QuestionRenderer({
  question,
  answer,
  onAnswer,
}: {
  question: TestQuestion;
  answer: Answers[string];
  onAnswer: (patch: Answers[string]) => void;
}) {
  const selectedIds = answer.answer_ids ?? [];

  const toggleSingle = (id: string) => onAnswer({ answer_ids: [id] });

  const toggleMultiple = (id: string) => {
    const set = new Set(selectedIds);
    set.has(id) ? set.delete(id) : set.add(id);
    onAnswer({ answer_ids: [...set] });
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
      <p className="text-base font-medium text-gray-900 dark:text-slate-100">{question.question_text}</p>

      {question.type === 'SINGLE' && (
        <div className="space-y-2">
          {question.answers.map((a) => (
            <label key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.includes(a.id) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={selectedIds.includes(a.id)}
                onChange={() => toggleSingle(a.id)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800 dark:text-slate-100">{a.answer_text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'MULTIPLE' && (
        <div className="space-y-2">
          {question.answers.map((a) => (
            <label key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.includes(a.id) ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
              <input
                type="checkbox"
                checked={selectedIds.includes(a.id)}
                onChange={() => toggleMultiple(a.id)}
                className="accent-blue-600"
              />
              <span className="text-sm text-gray-800 dark:text-slate-100">{a.answer_text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'OPEN_TEXT' && (
        <textarea
          value={answer.text ?? ''}
          onChange={(e) => onAnswer({ text: e.target.value })}
          placeholder="Ваш ответ..."
          rows={5}
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      )}

      {question.type === 'DRAWING' && (
        <DrawingCanvas
          backgroundUrl={question.image_path ? testsApi.getQuestionImageUrl(question.image_path) : undefined}
          onChange={(dataUrl) => onAnswer({ drawing_data: dataUrl })}
        />
      )}
    </div>
  );
}
