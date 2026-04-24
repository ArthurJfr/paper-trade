export type ToastKind = 'info' | 'success' | 'warning' | 'danger'

export interface Toast {
  id: string
  kind: ToastKind
  title?: string
  message: string
  actionLabel?: string
  action?: () => void
  createdAt: number
  ttl: number
}

interface NotifyInput {
  kind?: ToastKind
  title?: string
  message: string
  ttl?: number
  actionLabel?: string
  action?: () => void
}

const toastsState = () => useState<Toast[]>('paper-trade-toasts', () => [])

export function useToasts() {
  const toasts = toastsState()

  function notify(input: NotifyInput) {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const toast: Toast = {
      id,
      kind: input.kind ?? 'info',
      title: input.title,
      message: input.message,
      actionLabel: input.actionLabel,
      action: input.action,
      createdAt: Date.now(),
      ttl: input.ttl ?? 4500,
    }
    toasts.value = [...toasts.value, toast]

    if (toast.ttl > 0 && import.meta.client) {
      setTimeout(() => dismiss(id), toast.ttl)
    }
    return id
  }

  function dismiss(id: string) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  function clearAll() {
    toasts.value = []
  }

  return {
    toasts,
    notify,
    success: (message: string, opts?: Omit<NotifyInput, 'message' | 'kind'>) =>
      notify({ ...opts, kind: 'success', message }),
    info: (message: string, opts?: Omit<NotifyInput, 'message' | 'kind'>) =>
      notify({ ...opts, kind: 'info', message }),
    warning: (message: string, opts?: Omit<NotifyInput, 'message' | 'kind'>) =>
      notify({ ...opts, kind: 'warning', message }),
    danger: (message: string, opts?: Omit<NotifyInput, 'message' | 'kind'>) =>
      notify({ ...opts, kind: 'danger', message }),
    dismiss,
    clearAll,
  }
}
