import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Clock, ChevronLeft, ChevronRight, Send, CheckCircle2, XCircle, Trophy, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TestRunner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  const [shuffledQuestions, setShuffledQuestions] = useState<any[] | null>(null);

  const { data: test, isLoading } = useQuery({
    queryKey: ['test', id],
    queryFn: async () => {
      const res = await api.get(`/api/tests/${id}`);
      return res.data.data;
    },
  });

  const { data: inProgress, refetch: refetchInProgress } = useQuery({
    queryKey: ['test-in-progress', id],
    queryFn: async () => {
      const res = await api.get(`/api/tests/${id}/in-progress`);
      return res.data.data;
    },
    enabled: !!test && !attemptId,
  });

  const cancelMutation = useMutation({
    mutationFn: async (attemptIdToCancel: string) => {
      await api.delete(`/api/tests/${id}/cancel-attempt?attemptId=${attemptIdToCancel}`);
    },
    onSuccess: () => {
      toast.success('Попытка отменена');
      refetchInProgress();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка отмены');
    },
  });

  useEffect(() => {
    if (test?.questions && !shuffledQuestions) {
      const shuffled = [...test.questions]
        .sort(() => Math.random() - 0.5)
        .map((q: any) => ({
          ...q,
          options: [...q.options].sort(() => Math.random() - 0.5),
        }));
      setShuffledQuestions(shuffled);
    }
  }, [test]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/api/tests/${id}/start`);
      return res.data.data;
    },
    onSuccess: (data) => {
      setAttemptId(data.attemptId);
      if (test?.timeLimit) {
        setTimeLeft(test.timeLimit * 60);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Не удалось начать тест');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const answerArray = Object.entries(answers).map(([questionId, selectedIds]) => ({
        questionId,
        selectedIds,
      }));
      const res = await api.post(`/api/tests/${id}/submit`, {
        attemptId,
        answers: answerArray,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setSubmitResult(data);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка при отправке теста');
    },
  });

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          submitMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleOptionToggle = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: [optionId],
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const activeQuestions = shuffledQuestions || test?.questions || [];

  if (!test) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Тест не найден
        </CardContent>
      </Card>
    );
  }

  // Results screen with explanations
  if (submitResult) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {submitResult.isPassed ? (
                <Trophy className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-destructive" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {submitResult.isPassed ? 'Тест сдан!' : 'Тест не сдан'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-4xl font-bold">{submitResult.score}%</div>
            <Badge variant={submitResult.isPassed ? 'success' : 'destructive'} className="text-sm">
              {submitResult.isPassed ? 'Зачёт' : 'Незачёт'}
            </Badge>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold">Разбор ответов</h2>

        {activeQuestions.map((q: any, i: number) => {
          const result = submitResult.answers?.find((a: any) => a.questionId === q.id);
          const userSelected = answers[q.id] || [];
          return (
            <Card key={q.id} className={result?.isCorrect ? 'border-green-200' : 'border-red-200'}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {result?.isCorrect ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <span className="text-sm font-medium text-muted-foreground">Вопрос {i + 1}</span>
                </div>
                <CardTitle className="text-base mt-1">{q.text}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {q.options.map((opt: any) => {
                  const wasSelected = userSelected.includes(opt.id);
                  const isCorrectOption = result?.correctOptionIds?.includes(opt.id);
                  let className = 'border-border';
                  if (isCorrectOption) {
                    className = 'border-green-300 bg-green-50';
                  } else if (wasSelected && !isCorrectOption) {
                    className = 'border-red-300 bg-red-50';
                  }
                  return (
                    <div
                      key={opt.id}
                      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${className}`}
                    >
                      <span>{opt.text}</span>
                      <span className="text-xs ml-2 shrink-0">
                        {isCorrectOption && wasSelected && (
                          <span className="text-green-600 font-medium">✓ Верно</span>
                        )}
                        {isCorrectOption && !wasSelected && (
                          <span className="text-green-600 font-medium">✓ Правильный ответ</span>
                        )}
                        {!isCorrectOption && wasSelected && (
                          <span className="text-red-600 font-medium">✗ Ваш ответ</span>
                        )}
                      </span>
                    </div>
                  );
                })}
                {result?.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                    <span className="font-medium text-blue-700">Пояснение: </span>
                    <span className="text-blue-900">{result.explanation}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/tests')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            К списку тестов
          </Button>
          <Button onClick={() => navigate(`/tests/${id}/results`)}>
            История попыток
          </Button>
        </div>
      </div>
    );
  }

  // Start screen
  if (!attemptId) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{test.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {test.description && <p className="text-muted-foreground">{test.description}</p>}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground">Вопросов</p>
                <p className="font-medium text-lg">{test.questions.length}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground">Проходной балл</p>
                <p className="font-medium text-lg">{test.passingScore}%</p>
              </div>
              {test.timeLimit && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-muted-foreground">Ограничение времени</p>
                  <p className="font-medium text-lg">{test.timeLimit} мин</p>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              К документу: {test.document.title}
            </p>

            {inProgress ? (
              <div className="space-y-3">
                <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm">
                  <p className="font-medium text-amber-800">У вас есть незавершённая попытка</p>
                  <p className="text-amber-700 mt-1">
                    Начата: {new Date(inProgress.startedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setAttemptId(inProgress.id);
                      if (test?.timeLimit) setTimeLeft(test.timeLimit * 60);
                    }}
                    className="flex-1"
                    size="lg"
                  >
                    Продолжить тест
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => cancelMutation.mutate(inProgress.id)}
                    disabled={cancelMutation.isPending}
                    size="lg"
                  >
                    {cancelMutation.isPending ? 'Отмена...' : 'Отменить попытку'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="w-full"
                size="lg"
              >
                {startMutation.isPending ? 'Загрузка...' : 'Начать тест'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = activeQuestions[currentQuestion];
  const totalQuestions = activeQuestions.length;
  const answeredCount = Object.keys(answers).filter((k) => answers[k].length > 0).length;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Progress value={(answeredCount / totalQuestions) * 100} />
          <p className="text-xs text-muted-foreground mt-1">
            Отвечено: {answeredCount} из {totalQuestions}
          </p>
        </div>
        {timeLeft !== null && (
          <div className="flex items-center gap-1 text-sm font-mono">
            <Clock className="h-4 w-4" />
            <span className={timeLeft < 60 ? 'text-destructive font-bold' : ''}>
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Вопрос {currentQuestion + 1} из {totalQuestions}
            </span>
          </div>
          <CardTitle className="text-lg mt-2">{question.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {question.options.map((option: any) => {
            const isSelected = (answers[question.id] || []).includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => handleOptionToggle(question.id, option.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors flex items-center gap-3 ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  isSelected ? 'border-primary' : 'border-muted-foreground/40'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <span className="text-sm">{option.text}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
          disabled={currentQuestion === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>

        {currentQuestion < totalQuestions - 1 ? (
          <Button
            onClick={() => setCurrentQuestion((p) => Math.min(totalQuestions - 1, p + 1))}
            className="gap-2"
          >
            Далее
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <>
            {!showConfirm ? (
              <Button onClick={() => setShowConfirm(true)} className="gap-2">
                <Send className="h-4 w-4" />
                Завершить тест
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Вы уверены?</span>
                <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
                  Отмена
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? 'Отправка...' : 'Подтвердить'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Question dots */}
      <div className="flex gap-1 justify-center flex-wrap">
        {activeQuestions.map((_: any, i: number) => {
          const qId = activeQuestions[i].id;
          const isAnswered = answers[qId]?.length > 0;
          return (
            <button
              key={i}
              onClick={() => setCurrentQuestion(i)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                i === currentQuestion
                  ? 'bg-primary text-primary-foreground'
                  : isAnswered
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
