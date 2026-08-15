import { AppShell } from '../components/layout/AppShell.jsx';
import { Card } from '../components/ui/Card.jsx';
import { LoadingState, ErrorState } from '../components/ui/States.jsx';
import { QueueTable } from '../components/collection/QueueTable.jsx';
import { RoutePanel } from '../components/collection/RoutePanel.jsx';
import { usePolling } from '../hooks/usePolling.js';
import { fetchQueue, assignTask, completeTask } from '../api/collection.js';

export default function CollectionPage() {
  const queue = usePolling(fetchQueue);

  async function handleAssign(taskId) {
    await assignTask(taskId);
    queue.refetch();
  }

  async function handleComplete(taskId) {
    await completeTask(taskId);
    queue.refetch();
  }

  return (
    <AppShell title="Collection" subtitle="Task queue & route optimization">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card title={`Queue${queue.data ? ` (${queue.data.length})` : ''}`} className="xl:col-span-3">
          {queue.loading && <LoadingState label="Loading queue…" />}
          {!queue.loading && queue.error && <ErrorState error={queue.error} onRetry={queue.refetch} />}
          {!queue.loading && !queue.error && (
            <QueueTable tasks={queue.data} onAssign={handleAssign} onComplete={handleComplete} />
          )}
        </Card>
        <Card title="Optimized Route" className="xl:col-span-2">
          <RoutePanel />
        </Card>
      </div>
    </AppShell>
  );
}
