import type { AppConfig } from '../../config/app-config'
import { BOOT_DELAY_MS, RecurringSyncService } from './recurring-sync.service'
import type { RecurringService } from './recurring.service'

describe('RecurringSyncService', () => {
  const syncAll = jest.fn()

  beforeEach(() => {
    jest.useFakeTimers()
    syncAll.mockReset().mockResolvedValue({ series: 2, created: 3, issues: 1, failed: 0 })
  })
  afterEach(() => jest.useRealTimers())

  const make = (config: Partial<AppConfig>) =>
    new RecurringSyncService(
      { isTest: false, recurringSyncMinutes: 360, ...config } as AppConfig,
      { syncAll } as unknown as RecurringService,
    )

  it('لا يعمل في الاختبارات ولا عند تعطيله (0)', () => {
    for (const config of [{ isTest: true }, { recurringSyncMinutes: 0 }]) {
      const service = make(config)
      service.onApplicationBootstrap()
      jest.advanceTimersByTime(BOOT_DELAY_MS + 10 * 360 * 60_000)
      expect(syncAll).not.toHaveBeenCalled()
      service.onModuleDestroy()
    }
  })

  it('أول مزامنة بعد تأخير الإقلاع ثم كل فاصل', async () => {
    const service = make({})
    service.onApplicationBootstrap()
    await jest.advanceTimersByTimeAsync(BOOT_DELAY_MS - 1)
    expect(syncAll).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(syncAll).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(360 * 60_000)
    expect(syncAll).toHaveBeenCalledTimes(2)
    service.onModuleDestroy()
  })

  it('onModuleDestroy يوقف المؤقتات', () => {
    const service = make({})
    service.onApplicationBootstrap()
    service.onModuleDestroy()
    jest.advanceTimersByTime(BOOT_DELAY_MS + 360 * 60_000)
    expect(syncAll).not.toHaveBeenCalled()
  })

  it('لا تتداخل دورتان', async () => {
    let release!: () => void
    syncAll.mockReturnValue(
      new Promise(
        (resolve) => (release = () => resolve({ series: 0, created: 0, issues: 0, failed: 0 })),
      ),
    )
    const service = make({})
    const first = service.run()
    await service.run() // تُتجاهل لأن الأولى جارية
    expect(syncAll).toHaveBeenCalledTimes(1)
    release()
    await first
    await service.run()
    expect(syncAll).toHaveBeenCalledTimes(2)
  })

  it('الخطأ يُسجَّل ولا يُرمى، وتبقى الدورة التالية ممكنة', async () => {
    syncAll.mockRejectedValueOnce(new Error('db down'))
    const service = make({})
    await expect(service.run()).resolves.toBeUndefined()
    await service.run()
    expect(syncAll).toHaveBeenCalledTimes(2)
  })
})
