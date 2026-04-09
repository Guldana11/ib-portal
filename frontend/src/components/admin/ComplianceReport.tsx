import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { localized } from '@/lib/localize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Download, Mail, Bell, X } from 'lucide-react';

export default function ComplianceReport() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU';

  const [filters, setFilters] = useState({
    documentId: '',
    userId: '',
    status: '',
    testStatus: '',
    dateFrom: '',
    dateTo: '',
  });
  const [emailModal, setEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  const { data: documents } = useQuery({
    queryKey: ['admin', 'documents'],
    queryFn: async () => {
      const res = await api.get('/api/admin/documents');
      return res.data.data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await api.get('/api/admin/users');
      return res.data.data;
    },
  });

  const queryParams = new URLSearchParams();
  if (filters.documentId) queryParams.set('documentId', filters.documentId);
  if (filters.userId) queryParams.set('userId', filters.userId);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.testStatus) queryParams.set('testStatus', filters.testStatus);
  if (filters.dateFrom) queryParams.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) queryParams.set('dateTo', filters.dateTo);

  const { data: report, isLoading } = useQuery({
    queryKey: ['admin', 'compliance', filters],
    queryFn: async () => {
      const res = await api.get(`/api/admin/reports/compliance?${queryParams.toString()}`);
      return res.data.data;
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/admin/reports/send-email', {
        to: emailTo,
        filters,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('admin.reports.reportSent'));
      setEmailModal(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.reports.sendError'));
    },
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/admin/notifications/remind', {});
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('admin.reports.remindersSent'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.reports.sendError'));
    },
  });

  const handleExportCSV = () => {
    window.open(`/api/admin/reports/export?${queryParams.toString()}`, '_blank');
  };

  const statusLabels: Record<string, string> = {
    acknowledged: t('admin.reports.acknowledged'),
    pending: t('admin.reports.notAcknowledged'),
    passed: t('admin.reports.passed'),
    failed: t('admin.reports.failed'),
    not_taken: t('admin.reports.notTaken'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">{t('admin.reports.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => remindMutation.mutate()} disabled={remindMutation.isPending} className="gap-2">
            <Bell className="h-4 w-4" />
            {t('admin.reports.remind')}
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            {t('admin.reports.downloadCsv')}
          </Button>
          <Button variant="outline" onClick={() => setEmailModal(true)} className="gap-2">
            <Mail className="h-4 w-4" />
            {t('admin.reports.sendEmail')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('admin.reports.document')}</label>
              <select
                value={filters.documentId}
                onChange={(e) => setFilters({ ...filters, documentId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">{t('admin.reports.all')}</option>
                {documents?.map((doc: any) => (
                  <option key={doc.id} value={doc.id}>{localized(doc, 'title')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('admin.reports.employee')}</label>
              <select
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">{t('admin.reports.all')}</option>
                {users?.filter((u: any) => u.role !== 'ADMIN').map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('admin.reports.acknowledgment')}</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">{t('admin.reports.all')}</option>
                <option value="acknowledged">{t('admin.reports.acknowledged')}</option>
                <option value="pending">{t('admin.reports.notAcknowledged')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('admin.reports.test')}</label>
              <select
                value={filters.testStatus}
                onChange={(e) => setFilters({ ...filters, testStatus: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">{t('admin.reports.all')}</option>
                <option value="passed">{t('admin.reports.passed')}</option>
                <option value="failed">{t('admin.reports.failed')}</option>
                <option value="not_taken">{t('admin.reports.notTaken')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('admin.reports.dateFrom')}</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('admin.reports.dateTo')}</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="h-9 mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">{t('admin.reports.employeeCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.emailCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.documentCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.versionCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.ackCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.testCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.scoreCol')}</th>
                    <th className="text-left p-3 font-medium">{t('admin.reports.testDateCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {t('admin.reports.noData')}
                      </td>
                    </tr>
                  )}
                  {report?.map((row: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{row.userName}</td>
                      <td className="p-3 text-muted-foreground">{row.userEmail}</td>
                      <td className="p-3">{localized({ title: row.documentTitle, titleKk: row.documentTitleKk }, 'title')}</td>
                      <td className="p-3">v{row.documentVersion}</td>
                      <td className="p-3">
                        <Badge variant={row.ackStatus === 'acknowledged' ? 'success' : 'destructive'}>
                          {statusLabels[row.ackStatus] || row.ackStatus}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            row.testStatus === 'passed'
                              ? 'success'
                              : row.testStatus === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {statusLabels[row.testStatus] || row.testStatus}
                        </Badge>
                      </td>
                      <td className="p-3">{row.testScore != null ? `${row.testScore}%` : '—'}</td>
                      <td className="p-3 text-muted-foreground">
                        {row.testDate ? new Date(row.testDate).toLocaleDateString(locale) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('admin.reports.sendReportTitle')}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setEmailModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.reports.recipientEmail')}</label>
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder={t('admin.reports.emailPlaceholder')}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEmailModal(false)}>
                  {t('admin.reports.cancelBtn')}
                </Button>
                <Button
                  disabled={!emailTo || sendEmailMutation.isPending}
                  onClick={() => sendEmailMutation.mutate()}
                >
                  {sendEmailMutation.isPending ? t('admin.reports.sending') : t('admin.reports.sendBtn')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
