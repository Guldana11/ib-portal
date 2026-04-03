import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  UserCheck,
  UserX,
  RotateCcw,
  Shield,
  ShieldOff,
  Pencil,
  X,
  UserPlus,
  Trash2,
} from 'lucide-react';

interface UserForm {
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'EXTERNAL';
  isActive: boolean;
}

const emptyForm: UserForm = { name: '', email: '', role: 'EMPLOYEE', isActive: true };

export default function UserManagement() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'kk' ? 'kk-KZ' : 'ru-RU';
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [resetModal, setResetModal] = useState<{ userId: string; userName: string } | null>(null);
  const [selectedTestId, setSelectedTestId] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await api.get('/api/admin/users');
      return res.data.data;
    },
  });

  const { data: tests } = useQuery({
    queryKey: ['admin', 'all-tests'],
    queryFn: async () => {
      const res = await api.get('/api/tests');
      return res.data.data;
    },
    enabled: !!resetModal,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const res = await api.patch(`/api/admin/users/${editingId}`, form);
        return res.data;
      } else {
        const res = await api.post('/api/admin/users', form);
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? t('admin.users.userUpdated') : t('admin.users.userAdded'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      resetFormFn();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.users.saveError'));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/api/admin/users/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(t('admin.users.userUpdated'));
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.users.error'));
    },
  });

  const resetMutation = useMutation({
    mutationFn: async ({ userId, testId }: { userId: string; testId: string }) => {
      const res = await api.post(`/api/admin/users/${userId}/reset-attempts`, { testId });
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('admin.users.attemptsReset'));
      setResetModal(null);
      setSelectedTestId('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.users.error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/admin/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('admin.users.userDeleted'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.users.deleteError'));
    },
  });

  const resetFormFn = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (user: any) => {
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        <Button
          onClick={() => {
            resetFormFn();
            setShowForm(!showForm);
          }}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          {showForm ? t('admin.users.hideForm') : t('admin.users.addEmployee')}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? t('admin.users.editUser') : t('admin.users.newUser')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.users.fullName')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('admin.users.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.users.email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t('admin.users.emailPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.users.role')}</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'EMPLOYEE' | 'ADMIN' | 'EXTERNAL' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="EMPLOYEE">{t('admin.users.employee')}</option>
                  <option value="ADMIN">{t('admin.users.administrator')}</option>
                  <option value="EXTERNAL">{t('admin.users.external')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.users.statusLabel')}</Label>
                <select
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">{t('admin.users.active')}</option>
                  <option value="false">{t('admin.users.blocked')}</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={resetFormFn}>
                {t('admin.users.cancelBtn')}
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name || !form.email}
              >
                {saveMutation.isPending
                  ? t('admin.users.saving')
                  : editingId
                  ? t('admin.users.saveChanges')
                  : t('admin.users.addUser')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">{t('admin.users.name')}</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">{t('admin.users.role')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.users.statusLabel')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.users.lastLogin')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.users.stat')}</th>
                  <th className="text-right p-4 font-medium">{t('admin.users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      {t('admin.users.noUsers')}
                    </td>
                  </tr>
                )}
                {users?.map((user: any) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 font-medium">{user.name}</td>
                    <td className="p-4 text-muted-foreground">{user.email}</td>
                    <td className="p-4">
                      <Badge variant={user.role === 'ADMIN' ? 'default' : user.role === 'EXTERNAL' ? 'outline' : 'secondary'}>
                        {user.role === 'ADMIN' ? t('admin.users.administrator') : user.role === 'EXTERNAL' ? t('admin.users.external') : t('admin.users.employee')}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.isActive ? 'success' : 'destructive'}>
                        {user.isActive ? t('admin.users.active') : t('admin.users.blocked')}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString(locale)
                        : t('admin.users.neverLoggedIn')}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {t('admin.users.ack')} {user._count?.acknowledgments || 0}
                      <br />
                      {t('admin.users.testsLabel')} {user._count?.testAttempts || 0}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(user)}
                          title={t('admin.users.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleMutation.mutate({
                              id: user.id,
                              data: { role: user.role === 'ADMIN' ? 'EMPLOYEE' : 'ADMIN' },
                            })
                          }
                          title={user.role === 'ADMIN' ? t('admin.users.removeAdmin') : t('admin.users.assignAdmin')}
                        >
                          {user.role === 'ADMIN' ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleMutation.mutate({
                              id: user.id,
                              data: { isActive: !user.isActive },
                            })
                          }
                          title={user.isActive ? t('admin.users.block') : t('admin.users.unblock')}
                        >
                          {user.isActive ? (
                            <UserX className="h-4 w-4 text-destructive" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setResetModal({ userId: user.id, userName: user.name })}
                          title={t('admin.users.resetAttempts')}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(t('admin.users.deleteConfirm', { name: user.name }))) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          title={t('admin.users.delete')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {resetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('admin.users.resetAttemptsTitle')}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setResetModal(null);
                    setSelectedTestId('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('admin.users.employeeLabel')} <strong>{resetModal.userName}</strong>
              </p>
              <div className="space-y-2">
                <Label>{t('admin.users.selectTest')}</Label>
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t('admin.users.selectTestPlaceholder')}</option>
                  {tests?.map((t_: any) => (
                    <option key={t_.id} value={t_.id}>
                      {t_.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResetModal(null);
                    setSelectedTestId('');
                  }}
                >
                  {t('admin.users.cancelBtn')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={!selectedTestId || resetMutation.isPending}
                  onClick={() =>
                    resetMutation.mutate({
                      userId: resetModal.userId,
                      testId: selectedTestId,
                    })
                  }
                >
                  {resetMutation.isPending ? t('admin.users.resetting') : t('admin.users.reset')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
