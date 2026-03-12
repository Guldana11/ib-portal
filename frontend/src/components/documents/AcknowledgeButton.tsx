import { useAcknowledge } from '@/hooks/useDocuments';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, AlertCircle } from 'lucide-react';

interface Props {
  documentId: string;
  ackStatus: 'acknowledged' | 'outdated' | 'pending';
}

export default function AcknowledgeButton({ documentId, ackStatus }: Props) {
  const { mutate, isPending } = useAcknowledge();

  if (ackStatus === 'acknowledged') {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Check className="h-4 w-4 text-green-600" />
        Ознакомлен
      </Button>
    );
  }

  const handleAcknowledge = () => {
    mutate(documentId, {
      onSuccess: () => {
        toast.success('Ознакомление подтверждено');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || 'Ошибка при подтверждении');
      },
    });
  };

  return (
    <Button onClick={handleAcknowledge} disabled={isPending} className="gap-2">
      {ackStatus === 'outdated' && <AlertCircle className="h-4 w-4" />}
      {isPending ? 'Подтверждение...' : 'Подтвердить ознакомление'}
    </Button>
  );
}
