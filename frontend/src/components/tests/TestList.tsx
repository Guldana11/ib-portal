import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardCheck, ArrowRight } from 'lucide-react';

export default function TestList() {
  const { t } = useTranslation();

  const statusMap = {
    available: { label: t('tests.available'), variant: 'default' as const },
    passed: { label: t('tests.passed'), variant: 'success' as const },
    failed: { label: t('tests.failed'), variant: 'destructive' as const },
    expired: { label: t('tests.expired'), variant: 'warning' as const },
    no_ack: { label: t('tests.requiresAck'), variant: 'secondary' as const },
  };

  const { data: tests, isLoading } = useQuery({
    queryKey: ['tests'],
    queryFn: async () => {
      const res = await api.get('/api/tests');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('tests.title')}</h1>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-1/3" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('tests.title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('tests.subtitle')}
        </p>
      </div>

      {tests?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('tests.noTests')}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {tests?.map((test: any) => {
          const status = statusMap[test.status as keyof typeof statusMap];
          const canTake = test.status === 'available' || test.status === 'expired';

          return (
            <Card key={test.id}>
              <CardContent className="py-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <ClipboardCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-medium">{test.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('tests.forDocument')} {test.document.title}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {t('tests.attempts')} {test.attemptsUsed}/{test.maxAttempts}
                        </span>
                        {test.passingScore && (
                          <span className="text-xs text-muted-foreground">
                            {t('tests.passingScore')} {test.passingScore}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {test.status === 'passed' && (
                      <Link to={`/tests/${test.id}/results`}>
                        <Button variant="outline" size="sm">{t('tests.results')}</Button>
                      </Link>
                    )}
                    {canTake && (
                      <Link to={`/tests/${test.id}`}>
                        <Button size="sm" className="gap-2">
                          {t('tests.takeTest')}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {test.status === 'no_ack' && (
                      <Link to={`/documents/${test.document.id}`}>
                        <Button variant="outline" size="sm">
                          {t('tests.readDocument')}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
