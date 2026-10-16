import { DEFAULT_TZ, formatTime, formatTimeRange, todayInTz } from '~/utils/datetime'

/** الوصول لتوقيت الصالون في المكوّنات: المنطقة الزمنية + تاريخ اليوم + منسّقات جاهزة */
export function useShopTime() {
  const settings = useSettingsStore()
  const timezone = computed(() => settings.settings?.timezone ?? DEFAULT_TZ)
  const today = computed(() => todayInTz(timezone.value))

  return {
    timezone,
    today,
    time: (value: string | Date) => formatTime(value, timezone.value),
    range: (start: string | Date, end: string | Date) =>
      formatTimeRange(start, end, timezone.value),
  }
}
