export function useNow(tickMs = 1000) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, tickMs)
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
  })

  return readonly(now)
}
