import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.jsx';
import { Card } from '../components/ui/Card.jsx';
import { LoadingState, ErrorState } from '../components/ui/States.jsx';
import { BinsTable } from '../components/bins/BinsTable.jsx';
import { BinFilters } from '../components/bins/BinFilters.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { fetchBins } from '../api/bins.js';

export default function BinsPage() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const bins = usePolling(() => fetchBins({ status, priority }), [status, priority]);

  return (
    <AppShell title="Bins" subtitle="All monitored waste bins across the network">
      <Card
        title={`Bins${bins.data ? ` (${bins.data.length})` : ''}`}
        action={<BinFilters status={status} priority={priority} onStatusChange={setStatus} onPriorityChange={setPriority} />}
      >
        {bins.loading && <LoadingState label="Loading bins…" />}
        {!bins.loading && bins.error && <ErrorState error={bins.error} onRetry={bins.refetch} />}
        {!bins.loading && !bins.error && <BinsTable bins={bins.data} />}
      </Card>
    </AppShell>
  );
}
