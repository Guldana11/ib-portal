import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDocuments } from '@/hooks/useDocuments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronRight } from 'lucide-react';

const statusMap = {
  acknowledged: { label: 'Ознакомлен', variant: 'success' as const },
  outdated: { label: 'Обновлён', variant: 'warning' as const },
  pending: { label: 'Требует ознакомления', variant: 'destructive' as const },
};

export default function DocumentList() {
  const { data: documents, isLoading } = useDocuments();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo((): string[] => {
    if (!documents) return [];
    const cats = Array.from(new Set<string>(documents.map((d: any) => d.category as string)));
    return cats.sort();
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!selectedCategory) return documents;
    return documents.filter((d: any) => d.category === selectedCategory);
  }, [documents, selectedCategory]);

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

      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            Все
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      )}

      {filteredDocuments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {documents?.length === 0
              ? 'Документы пока не опубликованы'
              : 'Нет документов в выбранной категории'}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.map((doc: any) => {
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
