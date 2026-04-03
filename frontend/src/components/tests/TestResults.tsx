import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle2, XCircle, Trophy } from 'lucide-react';

export default function TestResults() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const locale = i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU';

  const { data: history, isLoading } = useQuery({
    queryKey: ['test-history', id],
    queryFn: async () => {
      const res = await api.get(`/api/tests/${id}/history`);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const latestAttempt = history?.[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/tests">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('testResults.backToTests')}
        </Button>
      </Link>

      {latestAttempt && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {latestAttempt.isPassed ? (
                <Trophy className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-destructive" />
              )}
            </div>
            <CardTitle className="text-2xl">
              {latestAttempt.isPassed ? t('testResults.testPassed') : t('testResults.testFailed')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-4xl font-bold">
              {latestAttempt.score}%
            </div>
            <Badge variant={latestAttempt.isPassed ? 'success' : 'destructive'} className="text-sm">
              {latestAttempt.isPassed ? t('testResults.pass') : t('testResults.fail')}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('testResults.attemptHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t('testResults.noAttempts')}</p>
          ) : (
            <div className="space-y-3">
              {history.map((attempt: any, i: number) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {attempt.isPassed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {t('testResults.attempt', { num: history.length - i })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.completedAt).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{attempt.score}%</p>
                    <Badge variant={attempt.isPassed ? 'success' : 'destructive'} className="text-xs">
                      {attempt.isPassed ? t('testResults.passed') : t('testResults.failed')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
