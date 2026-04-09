import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { localized } from '@/lib/localize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Upload, FileText, Eye, EyeOff, Pencil, ClipboardCheck, Trash2, Paperclip, AlertTriangle } from 'lucide-react';

const categoryKeys = [
  'Политика ИБ',
  'Регламент ИБ',
  'Правила',
  'Процедура',
  'Перечень',
  'Другое',
];

export default function DocumentUpload() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'draft' | 'publish' | null>(null);
  const [form, setForm] = useState({
    title: '',
    titleKk: '',
    category: categoryKeys[0],
    version: '1.0',
    description: '',
    descriptionKk: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileKk, setFileKk] = useState<File | null>(null);
  const fileKkRef = useRef<HTMLInputElement>(null);
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
      if (form.titleKk) formData.append('titleKk', form.titleKk);
      formData.append('category', form.category);
      formData.append('version', form.version);
      formData.append('description', form.description);
      if (form.descriptionKk) formData.append('descriptionKk', form.descriptionKk);
      if (file) formData.append('file', file);
      if (fileKk) formData.append('fileKk', fileKk);

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
      toast.success(publish ? t('admin.documents.docPublished') : editingId ? t('admin.documents.docUpdated') : t('admin.documents.draftSaved'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
      setPendingAction(null);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.documents.uploadError'));
      setPendingAction(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const res = await api.patch(`/api/admin/documents/${id}`, { isPublished });
      return res.data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isPublished ? t('admin.documents.docPublished') : t('admin.documents.docUnpublished'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.users.error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/api/admin/documents/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(t('admin.documents.docDeleted'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'documents'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('admin.documents.deleteError'));
    },
  });

  const handleDelete = (doc: any) => {
    if (window.confirm(t('admin.documents.deleteConfirm', { title: doc.title }))) {
      deleteMutation.mutate(doc.id);
    }
  };

  const resetForm = () => {
    setForm({ title: '', titleKk: '', category: categoryKeys[0], version: '1.0', description: '', descriptionKk: '' });
    setFile(null);
    setFileKk(null);
    setEditingId(null);
    setEditingDoc(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
    if (fileKkRef.current) fileKkRef.current.value = '';
  };

  const handleEdit = (doc: any) => {
    setForm({
      title: doc.title,
      titleKk: doc.titleKk || '',
      category: doc.category,
      version: doc.version,
      description: doc.description || '',
      descriptionKk: doc.descriptionKk || '',
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
      toast.error(t('admin.documents.onlyPdfWord'));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('admin.documents.title')}</h1>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.documents.title')}</h1>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gap-2">
          <Upload className="h-4 w-4" />
          {showForm ? t('admin.documents.hideForm') : t('admin.documents.upload')}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? t('admin.documents.editDocument') : t('admin.documents.newDocument')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('admin.documents.nameLabel')} (рус)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('admin.documents.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.documents.nameLabel')} (қаз)</Label>
                <Input
                  value={form.titleKk}
                  onChange={(e) => setForm({ ...form, titleKk: e.target.value })}
                  placeholder="Құжат атауы"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.documents.category')}</Label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categoryKeys.map((c) => (
                    <option key={c} value={c}>{t(`admin.categories.${c}`)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t('admin.documents.version')}</Label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.documents.description')} (рус)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('admin.documents.descPlaceholder')}
                  rows={1}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.documents.description')} (қаз)</Label>
                <Textarea
                  value={form.descriptionKk}
                  onChange={(e) => setForm({ ...form, descriptionKk: e.target.value })}
                  placeholder="Құжаттың қысқаша сипаттамасы"
                  rows={1}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>{t('admin.documents.fileLabel')} {!editingId && '*'}</Label>

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
                          <span className="font-medium text-green-700 dark:text-green-400">{t('admin.documents.fileAttached')} </span>
                          <span className="text-green-600 dark:text-green-500">{editingDoc.fileName}</span>
                          <span className="text-green-500 dark:text-green-600 ml-1">
                            ({(editingDoc.fileSize / 1024 / 1024).toFixed(2)} {t('admin.documents.mb')})
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
                        <div className="text-sm">
                          <span className="font-medium text-orange-700 dark:text-orange-400">{t('admin.documents.fileNotAttached')} </span>
                          <span className="text-orange-600 dark:text-orange-500">{t('admin.documents.uploadFileBelow')}</span>
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
                      {file.name} ({(file.size / 1024 / 1024).toFixed(1)} {t('admin.documents.mb')})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {editingDoc
                        ? t('admin.documents.dragReplace')
                        : t('admin.documents.dragSelect')}
                      <br />
                      <span className="text-xs">{t('admin.documents.fileFormats')}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">{t('admin.documents.wordAutoConvert')}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>{t('admin.documents.fileLabel')} (қаз)</Label>

                {editingDoc && !fileKk && editingDoc.fileNameKk && (
                  <div className="rounded-lg border p-3 flex items-center gap-3 bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
                    <Paperclip className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium text-green-700 dark:text-green-400">{t('admin.documents.fileAttached')} </span>
                      <span className="text-green-600 dark:text-green-500">{editingDoc.fileNameKk}</span>
                      {editingDoc.fileSizeKk && (
                        <span className="text-green-500 dark:text-green-600 ml-1">
                          ({(editingDoc.fileSizeKk / 1024 / 1024).toFixed(2)} {t('admin.documents.mb')})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedFile = e.dataTransfer.files[0];
                    if (droppedFile && ALLOWED_TYPES.includes(droppedFile.type)) {
                      setFileKk(droppedFile);
                    } else {
                      toast.error(t('admin.documents.onlyPdfWord'));
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileKkRef.current?.click()}
                >
                  <input
                    ref={fileKkRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFileKk(f);
                    }}
                  />
                  {fileKk ? (
                    <p className="text-sm">
                      <FileText className="h-5 w-5 inline mr-2" />
                      {fileKk.name} ({(fileKk.size / 1024 / 1024).toFixed(1)} {t('admin.documents.mb')})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {editingDoc && editingDoc.fileNameKk
                        ? t('admin.documents.dragReplace')
                        : t('admin.documents.dragSelect')}
                      <br />
                      <span className="text-xs">{t('admin.documents.fileFormats')}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={resetForm}>{t('admin.documents.cancelBtn')}</Button>
              <Button
                variant="secondary"
                onClick={() => { setPendingAction('draft'); uploadMutation.mutate(false); }}
                disabled={uploadMutation.isPending || (!editingId && (!form.title || !file))}
              >
                {pendingAction === 'draft' && uploadMutation.isPending ? t('admin.documents.saving') : t('admin.documents.saveDraft')}
              </Button>
              <Button
                onClick={() => { setPendingAction('publish'); uploadMutation.mutate(true); }}
                disabled={uploadMutation.isPending || (!editingId && (!form.title || !file))}
              >
                {pendingAction === 'publish' && uploadMutation.isPending ? t('admin.documents.publishing') : t('admin.documents.publish')}
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
                  <th className="text-left p-4 font-medium">{t('admin.documents.document')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.documents.categoryCol')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.documents.versionCol')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.documents.statusCol')}</th>
                  <th className="text-left p-4 font-medium">{t('admin.documents.ackCount')}</th>
                  <th className="text-right p-4 font-medium">{t('admin.documents.actionsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {documents?.map((doc: any) => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-medium">{localized(doc, 'title')}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {doc.fileSize > 0 ? (
                          <Paperclip className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                        )}
                        {doc.fileSize > 0 ? doc.fileName : t('admin.documents.noFile')}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary">{t(`admin.categories.${doc.category}`)}</Badge>
                    </td>
                    <td className="p-4">v{doc.version}</td>
                    <td className="p-4">
                      <Badge variant={doc.isPublished ? 'success' : 'outline'}>
                        {doc.isPublished ? t('admin.documents.published') : t('admin.documents.draft')}
                      </Badge>
                    </td>
                    <td className="p-4">{doc._count?.acknowledgments || 0}</td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(doc)}
                          title={t('admin.documents.editBtn')}
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
                          title={doc.isPublished ? t('admin.documents.unpublishBtn') : t('admin.documents.publishBtn')}
                        >
                          {doc.isPublished ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {doc._count?.tests === 0 && (
                          <Link to={`/admin/tests/${doc.id}`}>
                            <Button variant="ghost" size="icon" title={t('admin.documents.createTest')}>
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        {doc._count?.tests > 0 && (
                          <Link to={`/admin/tests/${doc.id}`}>
                            <Button variant="ghost" size="icon" title={t('admin.documents.editTest')}>
                              <ClipboardCheck className="h-4 w-4 text-primary" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc)}
                          disabled={deleteMutation.isPending}
                          title={t('admin.documents.deleteBtn')}
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
