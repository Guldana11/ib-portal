import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  const { i18n } = useTranslation();
  const lang = i18n.language;
  return useQuery({
    queryKey: ['documents', id, 'file', lang],
    queryFn: async () => {
      const res = await api.get(`/api/documents/${id}/file`, { params: { lang } });
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
