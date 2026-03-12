import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'EMPLOYEE' | 'ADMIN';
  avatarUrl: string | null;
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logout = async () => {
    await api.post('/auth/logout');
    queryClient.clear();
    window.location.href = '/login';
  };

  return {
    user: data ?? null,
    isLoading,
    isAuthenticated: !!data && !error,
    isAdmin: data?.role === 'ADMIN',
    logout,
  };
}
