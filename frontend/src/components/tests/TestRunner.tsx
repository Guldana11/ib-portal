import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Clock, ChevronLeft, ChevronRight, Send } from 'lucide-react';

export default function TestRunner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: test, isLoading } = useQuery({
    queryKey: ['test', id],
    queryFn: async () => {
      const res = await api.get(`/api/tests/${id}`);
      return res.data.data;
    },
  });

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
    onSuccess: () => {
      navigate(`/tests/${id}/results`);
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
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const hasOption = current.includes(optionId);
      // For simplicity, treat all questions as single-select
      return { ...prev, [questionId]: hasOption ? [] : [optionId] };
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!test) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Тест не найден
        </CardContent>
      </Card>
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
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="w-full"
              size="lg"
            >
              {startMutation.isPending ? 'Загрузка...' : 'Начать тест'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const question = test.questions[currentQuestion];
  const totalQuestions = test.questions.length;
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
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
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
        {test.questions.map((_: any, i: number) => {
          const qId = test.questions[i].id;
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
