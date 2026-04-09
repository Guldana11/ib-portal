import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  textKk: string;
  explanation: string;
  explanationKk: string;
  options: { text: string; textKk: string; isCorrect: boolean }[];
}

export default function QuestionEditor() {
  const { t } = useTranslation();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [testSettings, setTestSettings] = useState({
    title: '',
    titleKk: '',
    description: '',
    descriptionKk: '',
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
        titleKk: existingTest.titleKk || '',
        description: existingTest.description || '',
        descriptionKk: existingTest.descriptionKk || '',
        passingScore: existingTest.passingScore,
        timeLimit: existingTest.timeLimit?.toString() || '',
        maxAttempts: existingTest.maxAttempts,
        periodDays: existingTest.periodDays,
      });
      setQuestions(
        existingTest.questions.map((q: any) => ({
          text: q.text,
          textKk: q.textKk || '',
          explanation: q.explanation || '',
          explanationKk: q.explanationKk || '',
          options: q.options.map((o: any) => ({
            text: o.text,
            textKk: o.textKk || '',
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
        titleKk: testSettings.titleKk || undefined,
        description: testSettings.description || undefined,
        descriptionKk: testSettings.descriptionKk || undefined,
        passingScore: testSettings.passingScore,
        timeLimit: testSettings.timeLimit ? parseInt(testSettings.timeLimit) : null,
        maxAttempts: testSettings.maxAttempts,
        periodDays: testSettings.periodDays,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      setTestId(data.id);
      toast.success(t('admin.questionEditor.testCreated'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.questionEditor.createError'));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put(`/api/admin/tests/${testId}`, {
        title: testSettings.title,
        titleKk: testSettings.titleKk || undefined,
        description: testSettings.description || undefined,
        descriptionKk: testSettings.descriptionKk || undefined,
        passingScore: testSettings.passingScore,
        timeLimit: testSettings.timeLimit ? parseInt(testSettings.timeLimit) : null,
        maxAttempts: testSettings.maxAttempts,
        periodDays: testSettings.periodDays,
        questions: questions.map((q, qi) => ({
          text: q.text,
          textKk: q.textKk || null,
          orderIndex: qi,
          explanation: q.explanation || null,
          explanationKk: q.explanationKk || null,
          options: q.options.map((o, oi) => ({
            text: o.text,
            textKk: o.textKk || null,
            isCorrect: o.isCorrect,
            orderIndex: oi,
          })),
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('admin.questionEditor.testSaved'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'test', documentId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.questionEditor.saveError'));
    },
  });

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...questions];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setQuestions(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: '', textKk: '', explanation: '', explanationKk: '', options: [{ text: '', textKk: '', isCorrect: false }, { text: '', textKk: '', isCorrect: false }] },
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
    updated[qIndex].options.push({ text: '', textKk: '', isCorrect: false });
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
          {t('admin.questionEditor.back')}
        </Button>
        <h1 className="text-2xl font-bold">
          {testId ? t('admin.questionEditor.editTest') : t('admin.questionEditor.createTest')}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('admin.questionEditor.testSettings')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.testName')} (рус)</Label>
              <Input
                value={testSettings.title}
                onChange={(e) => setTestSettings({ ...testSettings, title: e.target.value })}
                placeholder={t('admin.questionEditor.testNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.testName')} (қаз)</Label>
              <Input
                value={testSettings.titleKk}
                onChange={(e) => setTestSettings({ ...testSettings, titleKk: e.target.value })}
                placeholder="Тест атауы"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.description')} (рус)</Label>
              <Textarea
                value={testSettings.description}
                onChange={(e) => setTestSettings({ ...testSettings, description: e.target.value })}
                placeholder={t('admin.questionEditor.descPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.description')} (қаз)</Label>
              <Textarea
                value={testSettings.descriptionKk}
                onChange={(e) => setTestSettings({ ...testSettings, descriptionKk: e.target.value })}
                placeholder="Сипаттама"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.passingScore')}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={testSettings.passingScore}
                onChange={(e) => setTestSettings({ ...testSettings, passingScore: parseInt(e.target.value) || 80 })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.timeLimit')}</Label>
              <Input
                type="number"
                min={1}
                value={testSettings.timeLimit}
                onChange={(e) => setTestSettings({ ...testSettings, timeLimit: e.target.value })}
                placeholder={t('admin.questionEditor.noLimit')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.maxAttempts')}</Label>
              <Input
                type="number"
                min={1}
                value={testSettings.maxAttempts}
                onChange={(e) => setTestSettings({ ...testSettings, maxAttempts: parseInt(e.target.value) || 3 })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('admin.questionEditor.period')}</Label>
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
              {createMutation.isPending ? t('admin.questionEditor.creating') : t('admin.questionEditor.createTestBtn')}
            </Button>
          )}
        </CardContent>
      </Card>

      {testId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('admin.questionEditor.questionsTitle', { count: questions.length })}</h2>
            <Button onClick={addQuestion} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              {t('admin.questionEditor.addQuestion')}
            </Button>
          </div>

          {questions.map((question, qi) => (
            <Card
              key={qi}
              draggable
              onDragStart={() => handleDragStart(qi)}
              onDragOver={(e) => handleDragOver(e, qi)}
              onDragEnd={handleDragEnd}
              className={`transition-opacity ${dragIndex === qi ? 'opacity-50' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {t('admin.questionEditor.questionNum', { num: qi + 1 })}
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
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('admin.questionEditor.questionText')} (рус)</Label>
                    <Textarea
                      value={question.text}
                      onChange={(e) => updateQuestion(qi, 'text', e.target.value)}
                      placeholder={t('admin.questionEditor.questionPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('admin.questionEditor.questionText')} (қаз)</Label>
                    <Textarea
                      value={question.textKk}
                      onChange={(e) => updateQuestion(qi, 'textKk', e.target.value)}
                      placeholder="Сұрақ мәтіні"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('admin.questionEditor.answerOptions')}</Label>
                    {question.options.length < 6 && (
                      <Button variant="ghost" size="sm" onClick={() => addOption(qi)} className="gap-1 text-xs">
                        <Plus className="h-3 w-3" />
                        {t('admin.questionEditor.add')}
                      </Button>
                    )}
                  </div>
                  {question.options.map((option, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={(e) => updateOption(qi, oi, 'isCorrect', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                        title={t('admin.questionEditor.correctAnswer')}
                      />
                      <Input
                        value={option.text}
                        onChange={(e) => updateOption(qi, oi, 'text', e.target.value)}
                        placeholder={`${t('admin.questionEditor.optionNum', { num: oi + 1 })} (рус)`}
                        className="flex-1"
                      />
                      <Input
                        value={option.textKk}
                        onChange={(e) => updateOption(qi, oi, 'textKk', e.target.value)}
                        placeholder={`${t('admin.questionEditor.optionNum', { num: oi + 1 })} (қаз)`}
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
                    {t('admin.questionEditor.checkCorrect')}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('admin.questionEditor.explanationLabel')} (рус)</Label>
                    <Textarea
                      value={question.explanation}
                      onChange={(e) => updateQuestion(qi, 'explanation', e.target.value)}
                      placeholder={t('admin.questionEditor.explanationPlaceholder')}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('admin.questionEditor.explanationLabel')} (қаз)</Label>
                    <Textarea
                      value={question.explanationKk}
                      onChange={(e) => updateQuestion(qi, 'explanationKk', e.target.value)}
                      placeholder="Түсіндірме"
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {questions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {t('admin.questionEditor.noQuestions')}
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
              {saveMutation.isPending ? t('admin.questionEditor.saving') : t('admin.questionEditor.saveTest')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
