import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

  // Create / Update user
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
      toast.success(editingId ? 'Пользователь обновлён' : 'Пользователь добавлен');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка сохранения');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.patch(`/api/admin/users/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Пользователь обновлён');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка');
    },
  });

  const resetMutation = useMutation({
    mutationFn: async ({ userId, testId }: { userId: string; testId: string }) => {
      const res = await api.post(`/api/admin/users/${userId}/reset-attempts`, { testId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Попытки сброшены');
      setResetModal(null);
      setSelectedTestId('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/admin/users/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Пользователь удалён');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка удаления');
    },
  });

  const resetForm = () => {
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
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          {showForm ? 'Скрыть форму' : 'Добавить сотрудника'}
        </Button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? 'Редактирование пользователя' : 'Новый пользователь'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ФИО *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ivanov@crystalspring.kz"
                />
              </div>
              <div className="space-y-2">
                <Label>Роль</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'EMPLOYEE' | 'ADMIN' | 'EXTERNAL' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="EMPLOYEE">Сотрудник</option>
                  <option value="ADMIN">Администратор</option>
                  <option value="EXTERNAL">Внешний</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Статус</Label>
                <select
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="true">Активен</option>
                  <option value="false">Заблокирован</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={resetForm}>
                Отмена
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name || !form.email}
              >
                {saveMutation.isPending
                  ? 'Сохранение...'
                  : editingId
                  ? 'Сохранить изменения'
                  : 'Добавить пользователя'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Имя</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Роль</th>
                  <th className="text-left p-4 font-medium">Статус</th>
                  <th className="text-left p-4 font-medium">Последний вход</th>
                  <th className="text-left p-4 font-medium">Стат.</th>
                  <th className="text-right p-4 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Нет пользователей
                    </td>
                  </tr>
                )}
                {users?.map((user: any) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4 font-medium">{user.name}</td>
                    <td className="p-4 text-muted-foreground">{user.email}</td>
                    <td className="p-4">
                      <Badge variant={user.role === 'ADMIN' ? 'default' : user.role === 'EXTERNAL' ? 'outline' : 'secondary'}>
                        {user.role === 'ADMIN' ? 'Администратор' : user.role === 'EXTERNAL' ? 'Внешний' : 'Сотрудник'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.isActive ? 'success' : 'destructive'}>
                        {user.isActive ? 'Активен' : 'Заблокирован'}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString('ru-RU')
                        : 'Не входил'}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      Озн: {user._count?.acknowledgments || 0}
                      <br />
                      Тесты: {user._count?.testAttempts || 0}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(user)}
                          title="Редактировать"
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
                          title={user.role === 'ADMIN' ? 'Снять админа' : 'Назначить админом'}
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
                          title={user.isActive ? 'Заблокировать' : 'Разблокировать'}
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
                          title="Сбросить попытки теста"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Удалить пользователя ${user.name}?`)) {
                              deleteMutation.mutate(user.id);
                            }
                          }}
                          title="Удалить"
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

      {/* Reset attempts modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Сбросить попытки теста</CardTitle>
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
                Сотрудник: <strong>{resetModal.userName}</strong>
              </p>
              <div className="space-y-2">
                <Label>Выберите тест</Label>
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">-- Выберите тест --</option>
                  {tests?.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
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
                  Отмена
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
                  {resetMutation.isPending ? 'Сброс...' : 'Сбросить'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
