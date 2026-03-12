import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await api.get('/api/documents');
      return res.data.data;
    },
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const res = await api.get(`/api/documents/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useDocumentFile(id: string) {
  return useQuery({
    queryKey: ['documents', id, 'file'],
    queryFn: async () => {
      const res = await api.get(`/api/documents/${id}/file`);
      return res.data.url;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAcknowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await api.post(`/api/documents/${documentId}/acknowledge`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
