import { Link } from 'react-router-dom';
import { useDocuments } from '@/hooks/useDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronRight } from 'lucide-react';

const statusMap = {
  acknowledged: { label: 'Ознакомлен', variant: 'success' as const },
  outdated: { label: 'Обновлён', variant: 'warning' as const },
  pending: { label: 'Требует ознакомления', variant: 'destructive' as const },
};

export default function DocumentList() {
  const { data: documents, isLoading } = useDocuments();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Документы</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-1/2" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Документы</h1>
        <p className="text-muted-foreground mt-1">
          Регламенты и политики информационной безопасности
        </p>
      </div>

      {documents?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Документы пока не опубликованы
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {documents?.map((doc: any) => {
          const status = statusMap[doc.ackStatus as keyof typeof statusMap];
          return (
            <Link key={doc.id} to={`/documents/${doc.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <CardTitle className="text-base line-clamp-2">{doc.title}</CardTitle>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doc.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{doc.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{doc.category}</Badge>
                    <Badge variant="outline">v{doc.version}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
