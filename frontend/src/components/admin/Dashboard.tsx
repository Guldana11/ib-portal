import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, FileText, ClipboardCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await api.get('/api/admin/stats');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Панель управления</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const metrics = [
    {
      title: 'Сотрудников',
      value: `${stats?.activeEmployees || 0}/${stats?.totalEmployees || 0}`,
      description: 'активных / всего',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Документов',
      value: stats?.publishedDocs || 0,
      description: 'опубликовано',
      icon: FileText,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Успешность тестов',
      value: `${stats?.testPassRate || 0}%`,
      description: `${stats?.passedAttempts || 0} из ${stats?.totalAttempts || 0}`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Просрочено',
      value: stats?.overdueList?.length || 0,
      description: 'требуется переобучение',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Панель управления</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${metric.bg}`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Ознакомление по документам */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ознакомление по документам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.docAckStats?.length === 0 && (
              <p className="text-sm text-muted-foreground">Нет опубликованных документов</p>
            )}
            {stats?.docAckStats?.map((doc: any) => (
              <div key={doc.documentId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate mr-2">{doc.title}</span>
                  <span className="shrink-0 font-medium">{doc.ackPercent}%</span>
                </div>
                <Progress value={doc.ackPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {doc.ackCount} из {stats.activeEmployees} сотрудников
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Просроченные переобучения */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Требуется переобучение</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.overdueList?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Все сотрудники в норме</p>
            ) : (
              <div className="overflow-y-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Сотрудник</th>
                      <th className="text-left py-2 font-medium">Тест</th>
                      <th className="text-left py-2 font-medium">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.overdueList.map((row: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2">
                          <p className="font-medium">{row.userName}</p>
                          <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                        </td>
                        <td className="py-2 text-sm">{row.testTitle}</td>
                        <td className="py-2">
                          {row.expiredAt ? (
                            <Badge variant="destructive">
                              Истёк {new Date(row.expiredAt).toLocaleDateString('ru-RU')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Не проходил</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Быстрые действия */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Link to="/admin/documents">
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" />
              Управление документами
            </Button>
          </Link>
          <Link to="/admin/users">
            <Button variant="outline" className="w-full justify-start gap-2">
              <Users className="h-4 w-4" />
              Управление пользователями
            </Button>
          </Link>
          <Link to="/admin/reports">
            <Button variant="outline" className="w-full justify-start gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Отчёты по соответствию
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
