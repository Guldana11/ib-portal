import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Upload, FileText, Eye, EyeOff, Pencil, ClipboardCheck, Trash2, Paperclip, AlertTriangle } from 'lucide-react';

const categories = [
  'Политика ИБ',
  'Регламент ИБ',
  'Правила',
  'Процедура',
  'Перечень',
  'Другое',
];

export default function DocumentUpload() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'draft' | 'publish' | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: categories[0],
    version: '1.0',
    description: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [editingDoc, setEditingDoc] = useState<any>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['admin', 'documents'],
    queryFn: async () => {
      const res = await api.get('/api/admin/documents');
      return res.data.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('category', form.category);
      formData.append('version', form.version);
      formData.append('description', form.description);
      if (file) formData.append('file', file);

      if (editingId) {
        if (publish) formData.append('isPublished', 'true');
        const res = await api.patch(`/api/admin/documents/${editingId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      } else {
        const res = await api.post('/api/admin/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (publish) {
          const docId = res.data.data.id;
          await api.patch(`/api/admin/documents/${docId}`, { isPublished: true });
        }
        return res.data;
      }
    },
    onSuccess: (_, publish) => {
      toast.success(publish ? 'Документ опубликован' : editingId ? 'Документ обновлён' : 'Черновик сохранён');
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
      setPendingAction(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка загрузки');
      setPendingAction(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const res = await api.patch(`/api/admin/documents/${id}`, { isPublished });
      return res.data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isPublished ? 'Документ опубликован' : 'Документ снят с публикации');
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/admin/documents/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Документ удалён');
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Ошибка удаления');
    },
  });

  const handleDelete = (doc: any) => {
    if (window.confirm(`Удалить документ «${doc.title}»? Это действие необратимо — будут удалены все связанные ознакомления и тесты.`)) {
      deleteMutation.mutate(doc.id);
    }
  };

  const resetForm = () => {
    setForm({ title: '', category: categories[0], version: '1.0', description: '' });
    setFile(null);
    setEditingId(null);
    setEditingDoc(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleEdit = (doc: any) => {
    setForm({
      title: doc.title,
      category: doc.category,
      version: doc.version,
      description: doc.description || '',
    });
    setEditingId(doc.id);
    setEditingDoc(doc);
    setShowForm(true);
  };

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && ALLOWED_TYPES.includes(droppedFile.type)) {
      setFile(droppedFile);
    } else {
      toast.error('Допускаются только PDF и Word файлы (.pdf, .doc, .docx)');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Управление документами</h1>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Управление документами</h1>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gap-2">
          <Upload className="h-4 w-4" />
          {showForm ? 'Скрыть форму' : 'Загрузить документ'}
        </Button>
      </div>

      {/* Upload form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? 'Редактирование документа' : 'Новый документ'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Название *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Название документа"
                />
              </div>
              <div className="space-y-2">
                <Label>Категория</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Версия</Label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Краткое описание документа"
                  rows={1}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Файл (PDF или Word) {!editingId && '*'}</Label>

                {editingDoc && !file && (
                  <div className={`rounded-lg border p-3 flex items-center gap-3 ${
                    editingDoc.fileSize > 0
                      ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
                      : 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
                  }`}>
                    {editingDoc.fileSize > 0 ? (
                      <>
                        <Paperclip className="h-4 w-4 text-green-600 shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-green-700 dark:text-green-400">Файл прикреплён: </span>
                          <span className="text-green-600 dark:text-green-500">{editingDoc.fileName}</span>
                          <span className="text-green-500 dark:text-green-600 ml-1">
                            ({(editingDoc.fileSize / 1024 / 1024).toFixed(2)} МБ)
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-orange-700 dark:text-orange-400">Файл не прикреплён. </span>
                          <span className="text-orange-600 dark:text-orange-500">Загрузите файл документа ниже.</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                  {file ? (
                    <p className="text-sm">
                      <FileText className="h-5 w-5 inline mr-2" />
                      {file.name} ({(file.size / 1024 / 1024).toFixed(1)} МБ)
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {editingDoc
                        ? 'Перетащите новый файл или нажмите для замены'
                        : 'Перетащите файл сюда или нажмите для выбора'}
                      <br />
                      <span className="text-xs">PDF, DOC, DOCX — максимум 50 МБ</span>
                      <br />
                      <span className="text-xs text-muted-foreground">Word-файлы автоматически конвертируются в PDF</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={resetForm}>Отмена</Button>
              <Button
                variant="secondary"
                onClick={() => { setPendingAction('draft'); uploadMutation.mutate(false); }}
                disabled={uploadMutation.isPending || (!editingId && (!form.title || !file))}
              >
                {pendingAction === 'draft' && uploadMutation.isPending ? 'Сохранение...' : 'Сохранить как черновик'}
              </Button>
              <Button
                onClick={() => { setPendingAction('publish'); uploadMutation.mutate(true); }}
                disabled={uploadMutation.isPending || (!editingId && (!form.title || !file))}
              >
                {pendingAction === 'publish' && uploadMutation.isPending ? 'Публикация...' : 'Опубликовать'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Документ</th>
                  <th className="text-left p-4 font-medium">Категория</th>
                  <th className="text-left p-4 font-medium">Версия</th>
                  <th className="text-left p-4 font-medium">Статус</th>
                  <th className="text-left p-4 font-medium">Ознакомлений</th>
                  <th className="text-right p-4 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {documents?.map((doc: any) => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {doc.fileSize > 0 ? (
                          <Paperclip className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                        )}
                        {doc.fileSize > 0 ? doc.fileName : 'Файл не прикреплён'}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary">{doc.category}</Badge>
                    </td>
                    <td className="p-4">v{doc.version}</td>
                    <td className="p-4">
                      <Badge variant={doc.isPublished ? 'success' : 'outline'}>
                        {doc.isPublished ? 'Опубликован' : 'Черновик'}
                      </Badge>
                    </td>
                    <td className="p-4">{doc._count?.acknowledgments || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(doc)}
                          title="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            publishMutation.mutate({
                              id: doc.id,
                              isPublished: !doc.isPublished,
                            })
                          }
                          title={doc.isPublished ? 'Снять с публикации' : 'Опубликовать'}
                        >
                          {doc.isPublished ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {doc._count?.tests === 0 && (
                          <Link to={`/admin/tests/${doc.id}`}>
                            <Button variant="ghost" size="icon" title="Создать тест">
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {doc._count?.tests > 0 && (
                          <Link to={`/admin/tests/${doc.id}`}>
                            <Button variant="ghost" size="icon" title="Редактировать тест">
                              <ClipboardCheck className="h-4 w-4 text-primary" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc)}
                          disabled={deleteMutation.isPending}
                          title="Удалить"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
