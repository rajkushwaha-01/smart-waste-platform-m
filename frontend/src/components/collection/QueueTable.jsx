import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { toApiError } from '../../api/client.js';
import { Badge } from '../ui/Badge.jsx';
import { EmptyState } from '../ui/States.jsx';
import { PRIORITY_STYLES, TASK_STATUS_STYLES } from '../../utils/constants.js';
import { formatRelativeTime } from '../../utils/formatters.js';

/**
 * `onAssign`/`onComplete` are async (taskId) => Promise — this
 * component only tracks which single row is in-flight so the rest of
 * the table stays interactive while one action is pending, and
 * surfaces a per-row error if the backend rejects the transition
 * (e.g. 409 CONFLICT if another operator already actioned it).
 */
export function QueueTable({ tasks, onAssign, onComplete }) {
  const [pendingId, setPendingId] = useState(null);
  const [rowError, setRowError] = useState(null);

  if (!tasks?.length) {
    return <EmptyState label="Collection queue is empty" hint="No bins currently require collection." />;
  }

  async function handleAction(taskId, action) {
    setPendingId(taskId);
    setRowError(null);
    try {
      if (action === 'assign') await onAssign(taskId);
      else await onComplete(taskId);
    } catch (err) {
      setRowError({ taskId, message: toApiError(err).message });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-surface-700 text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2 font-medium">Bin</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Reason</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="px-3 py-2 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800">
          {tasks.map((task) => {
            const isPending = pendingId === task._id;
            const error = rowError?.taskId === task._id ? rowError.message : null;
            return (
              <tr key={task._id} className="transition hover:bg-surface-800/60">
                <td className="px-3 py-2.5">
                  <Link to={`/bins/${task.binId}`} className="font-mono text-sm text-cyan-300 hover:underline">
                    {task.binId}
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <Badge style={PRIORITY_STYLES[task.priority]} showDot />
                </td>
                <td className="max-w-xs truncate px-3 py-2.5 text-xs text-slate-400" title={task.reason}>
                  {task.reason}
                </td>
                <td className="px-3 py-2.5">
                  <Badge style={TASK_STATUS_STYLES[task.status]} />
                  {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{formatRelativeTime(task.createdAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  {task.status === 'pending' && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAction(task._id, 'assign')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                      Assign
                    </button>
                  )}
                  {(task.status === 'assigned' || task.status === 'in_progress') && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAction(task._id, 'complete')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
