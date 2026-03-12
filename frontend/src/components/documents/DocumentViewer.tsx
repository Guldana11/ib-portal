import { useParams, Link } from 'react-router-dom';
import { useDocument, useDocumentFile } from '@/hooks/useDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AcknowledgeButton from './AcknowledgeButton';
import { ArrowLeft, Download } from 'lucide-react';

export default function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading: docLoading } = useDocument(id!);
  const { data: fileUrl, isLoading: fileLoading } = useDocumentFile(id!);

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
          Документ не найден
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/documents">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Назад к документам
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{doc.title}</CardTitle>
              {doc.description && (
                <p className="text-sm text-muted-foreground mt-2">{doc.description}</p>
              )}
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary">{doc.category}</Badge>
                <Badge variant="outline">Версия {doc.version}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Скачать
                  </Button>
                </a>
              )}
              <AcknowledgeButton documentId={doc.id} ackStatus={doc.ackStatus} />
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
              Не удалось загрузить файл
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
