export const STATUS_CONFIG = {
  pending:     { label: 'Pendente',     color: 'text-notion-muted',  bg: 'bg-notion-surface', dot: 'bg-notion-border2' },
  in_progress: { label: 'Em progresso', color: 'text-blue-600',      bg: 'bg-blue-50',        dot: 'bg-blue-400'       },
  review:      { label: 'Em revisão',   color: 'text-purple-600',    bg: 'bg-purple-50',      dot: 'bg-purple-400'     },
  blocked:     { label: 'Bloqueada',    color: 'text-red-600',       bg: 'bg-red-50',         dot: 'bg-red-400'        },
  completed:   { label: 'Concluída',    color: 'text-green-600',     bg: 'bg-green-50',       dot: 'bg-green-400'      },
  cancelled:   { label: 'Cancelada',    color: 'text-gray-500',      bg: 'bg-gray-50',        dot: 'bg-gray-300'       },
}

export const STATUS_TRANSITIONS = {
  pending:     ['in_progress', 'cancelled'],
  in_progress: ['review', 'blocked', 'completed', 'cancelled'],
  review:      ['in_progress', 'completed', 'cancelled'],
  blocked:     ['in_progress', 'cancelled'],
  completed:   ['pending'],
  cancelled:   ['pending'],
}

export const DONE_STATUSES = ['completed', 'cancelled']
