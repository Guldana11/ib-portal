import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Download, Mail, Bell, X } from 'lucide-react';

export default function ComplianceReport() {
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
      toast.success('Отчёт отправлен на email');
      setEmailModal(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка отправки');
    },
  });

  const remindMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/admin/notifications/remind', {});
      return res.data;
    },
    onSuccess: () => {
      toast.success('Напоминания отправлены');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка отправки');
    },
  });

  const handleExportCSV = () => {
    window.open(`/api/admin/reports/export?${queryParams.toString()}`, '_blank');
  };

  const statusLabels: Record<string, string> = {
    acknowledged: 'Ознакомлен',
    pending: 'Не ознакомлен',
    passed: 'Сдан',
    failed: 'Не сдан',
    not_taken: 'Не проходил',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Отчёт по соответствию</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => remindMutation.mutate()} disabled={remindMutation.isPending} className="gap-2">
            <Bell className="h-4 w-4" />
            Напомнить
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Скачать CSV
          </Button>
          <Button variant="outline" onClick={() => setEmailModal(true)} className="gap-2">
            <Mail className="h-4 w-4" />
            Отправить на email
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Документ</label>
              <select
                value={filters.documentId}
                onChange={(e) => setFilters({ ...filters, documentId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">Все</option>
                {documents?.map((doc: any) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Сотрудник</label>
              <select
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">Все</option>
                {users?.filter((u: any) => u.role !== 'ADMIN').map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Ознакомление</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">Все</option>
                <option value="acknowledged">Ознакомлен</option>
                <option value="pending">Не ознакомлен</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Тест</label>
              <select
                value={filters.testStatus}
                onChange={(e) => setFilters({ ...filters, testStatus: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              >
                <option value="">Все</option>
                <option value="passed">Сдан</option>
                <option value="failed">Не сдан</option>
                <option value="not_taken">Не проходил</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Дата от</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Дата до</label>
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

      {/* Report table */}
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
                    <th className="text-left p-3 font-medium">Сотрудник</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Документ</th>
                    <th className="text-left p-3 font-medium">Версия</th>
                    <th className="text-left p-3 font-medium">Ознакомлен</th>
                    <th className="text-left p-3 font-medium">Тест</th>
                    <th className="text-left p-3 font-medium">Балл</th>
                    <th className="text-left p-3 font-medium">Дата теста</th>
                  </tr>
                </thead>
                <tbody>
                  {report?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Нет данных для отображения
                      </td>
                    </tr>
                  )}
                  {report?.map((row: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{row.userName}</td>
                      <td className="p-3 text-muted-foreground">{row.userEmail}</td>
                      <td className="p-3">{row.documentTitle}</td>
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
                        {row.testDate ? new Date(row.testDate).toLocaleDateString('ru-RU') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email modal */}
      {emailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Отправить отчёт на email</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setEmailModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email получателя</label>
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="admin@crystalspring.kz"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEmailModal(false)}>
                  Отмена
                </Button>
                <Button
                  disabled={!emailTo || sendEmailMutation.isPending}
                  onClick={() => sendEmailMutation.mutate()}
                >
                  {sendEmailMutation.isPending ? 'Отправка...' : 'Отправить'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
