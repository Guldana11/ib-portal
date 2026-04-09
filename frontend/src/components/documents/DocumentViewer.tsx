import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';
import { localized } from '@/lib/localize';
import { useDocument, useDocumentFile } from '@/hooks/useDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AcknowledgeButton from './AcknowledgeButton';
import { ArrowLeft, Download, ClipboardCheck } from 'lucide-react';

export default function DocumentViewer() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading: docLoading } = useDocument(id!);
  const { data: fileUrl, isLoading: fileLoading } = useDocumentFile(id!);

  const { data: tests } = useQuery({
    queryKey: ['tests'],
    queryFn: async () => {
      const res = await api.get('/api/tests');
      return res.data.data;
    },
  });

  const testForDoc = tests?.find((t: any) => t.documentId === id);

  if (docLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t('documents.notFound')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/documents">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('documents.backToDocuments')}
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{localized(doc, 'title')}</CardTitle>
              {(doc.description || doc.descriptionKk) && (
                <p className="text-sm text-muted-foreground mt-2">{localized(doc, 'description')}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary">{String(t(`documents.categories.${doc.category}`, doc.category))}</Badge>
                <Badge variant="outline">{t('documents.version', { version: doc.version })}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    {t('documents.download')}
                  </Button>
                </a>
              )}
              <AcknowledgeButton documentId={doc.id} ackStatus={doc.ackStatus} />
              {doc.ackStatus === 'acknowledged' && testForDoc && (
                <Link to={`/tests/${testForDoc.id}`}>
                  <Button className="gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    {t('documents.takeTest')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {fileLoading ? (
            <Skeleton className="h-[700px] w-full" />
          ) : fileUrl ? (
            <iframe
              src={fileUrl}
              className="w-full h-[700px] rounded-md border"
              title={doc.title}
            />
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              {t('documents.failedLoad')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
