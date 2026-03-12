import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ArrowLeft, Save } from 'lucide-react';

interface QuestionForm {
  text: string;
  explanation: string;
  options: { text: string; isCorrect: boolean }[];
}

export default function QuestionEditor() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [testSettings, setTestSettings] = useState({
    title: '',
    description: '',
    passingScore: 80,
    timeLimit: '',
    maxAttempts: 3,
    periodDays: 365,
  });

  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [testId, setTestId] = useState<string | null>(null);

  const { data: existingTest, isLoading } = useQuery({
    queryKey: ['admin', 'test', documentId],
    queryFn: async () => {
      const res = await api.get(`/api/admin/tests/${documentId}`);
      return res.data.data;
    },
  });

  useEffect(() => {
    if (existingTest) {
      setTestId(existingTest.id);
      setTestSettings({
        title: existingTest.title,
        description: existingTest.description || '',
        passingScore: existingTest.passingScore,
        timeLimit: existingTest.timeLimit?.toString() || '',
        maxAttempts: existingTest.maxAttempts,
        periodDays: existingTest.periodDays,
      });
      setQuestions(
        existingTest.questions.map((q: any) => ({
          text: q.text,
          explanation: q.explanation || '',
          options: q.options.map((o: any) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        }))
      );
    }
  }, [existingTest]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/admin/tests', {
        documentId,
        title: testSettings.title,
        description: testSettings.description || undefined,
        passingScore: testSettings.passingScore,
        timeLimit: testSettings.timeLimit ? parseInt(testSettings.timeLimit) : null,
        maxAttempts: testSettings.maxAttempts,
        periodDays: testSettings.periodDays,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setTestId(data.id);
      toast.success('Тест создан');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка создания теста');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/api/admin/tests/${testId}`, {
        title: testSettings.title,
        description: testSettings.description || undefined,
        passingScore: testSettings.passingScore,
        timeLimit: testSettings.timeLimit ? parseInt(testSettings.timeLimit) : null,
        maxAttempts: testSettings.maxAttempts,
        periodDays: testSettings.periodDays,
        questions: questions.map((q, qi) => ({
          text: q.text,
          orderIndex: qi,
          explanation: q.explanation || null,
          options: q.options.map((o, oi) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            orderIndex: oi,
          })),
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Тест сохранён');
      queryClient.invalidateQueries({ queryKey: ['admin', 'test', documentId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка сохранения');
    },
  });

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: '', explanation: '', options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }] },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof QuestionForm, value: string) => {
    const updated = [...questions];
    (updated[index] as any)[field] = value;
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    if (questions[qIndex].options.length >= 6) return;
    const updated = [...questions];
    updated[qIndex].options.push({ text: '', isCorrect: false });
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    if (questions[qIndex].options.length <= 2) return;
    const updated = [...questions];
    updated[qIndex].options.splice(oIndex, 1);
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[qIndex].options[oIndex] as any)[field] = value;
    setQuestions(updated);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/documents')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
        <h1 className="text-2xl font-bold">
          {testId ? 'Редактирование теста' : 'Создание теста'}
        </h1>
      </div>

      {/* Test settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Настройки теста</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label>Название теста *</Label>
              <Input
                value={testSettings.title}
                onChange={(e) => setTestSettings({ ...testSettings, title: e.target.value })}
                placeholder="Тест по политике ИБ"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={testSettings.description}
                onChange={(e) => setTestSettings({ ...testSettings, description: e.target.value })}
                placeholder="Описание теста"
              />
            </div>
            <div className="space-y-2">
              <Label>Проходной балл (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={testSettings.passingScore}
                onChange={(e) => setTestSettings({ ...testSettings, passingScore: parseInt(e.target.value) || 80 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ограничение времени (мин)</Label>
              <Input
                type="number"
                min={1}
                value={testSettings.timeLimit}
                onChange={(e) => setTestSettings({ ...testSettings, timeLimit: e.target.value })}
                placeholder="Без ограничения"
              />
            </div>
            <div className="space-y-2">
              <Label>Максимум попыток</Label>
              <Input
                type="number"
                min={1}
                value={testSettings.maxAttempts}
                onChange={(e) => setTestSettings({ ...testSettings, maxAttempts: parseInt(e.target.value) || 3 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Периодичность (дней)</Label>
              <Input
                type="number"
                min={1}
                value={testSettings.periodDays}
                onChange={(e) => setTestSettings({ ...testSettings, periodDays: parseInt(e.target.value) || 365 })}
              />
            </div>
          </div>

          {!testId && (
            <Button
              className="mt-4"
              onClick={() => createMutation.mutate()}
              disabled={!testSettings.title || createMutation.isPending}
            >
              {createMutation.isPending ? 'Создание...' : 'Создать тест'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Questions */}
      {testId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Вопросы ({questions.length})</h2>
            <Button onClick={addQuestion} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Добавить вопрос
            </Button>
          </div>

          {questions.map((question, qi) => (
            <Card key={qi}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Вопрос {qi + 1}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(qi)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Текст вопроса *</Label>
                  <Textarea
                    value={question.text}
                    onChange={(e) => updateQuestion(qi, 'text', e.target.value)}
                    placeholder="Введите вопрос..."
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Варианты ответов</Label>
                    {question.options.length < 6 && (
                      <Button variant="ghost" size="sm" onClick={() => addOption(qi)} className="gap-1 text-xs">
                        <Plus className="h-3 w-3" />
                        Добавить
                      </Button>
                    )}
                  </div>
                  {question.options.map((option, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(qi, oi, 'isCorrect', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        title="Правильный ответ"
                      />
                      <Input
                        value={option.text}
                        onChange={(e) => updateOption(qi, oi, 'text', e.target.value)}
                        placeholder={`Вариант ${oi + 1}`}
                        className="flex-1"
                      />
                      {question.options.length > 2 && (
                        <Button variant="ghost" size="icon" onClick={() => removeOption(qi, oi)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Отметьте галочкой правильные варианты ответов
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Пояснение (показывается после сдачи)</Label>
                  <Textarea
                    value={question.explanation}
                    onChange={(e) => updateQuestion(qi, 'explanation', e.target.value)}
                    placeholder="Пояснение к правильному ответу"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {questions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Нет вопросов. Нажмите «Добавить вопрос» чтобы начать.
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 sticky bottom-4">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || questions.length === 0}
              className="gap-2"
              size="lg"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Сохранение...' : 'Сохранить тест'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
