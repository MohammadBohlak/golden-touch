import { AppConfig } from '../../config/app-config'
import { KeepAliveService } from './keep-alive.service'

describe('KeepAliveService', () => {
  const fetchMock = jest.fn()
  const realFetch = global.fetch

  beforeEach(() => {
    jest.useFakeTimers()
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = realFetch
  })

  const make = (keepAliveUrl: string | undefined) =>
    new KeepAliveService({ keepAliveUrl, keepAliveIntervalMs: 10 * 60_000 } as AppConfig)

  it('pings /api/health every interval when a public URL exists', () => {
    const service = make('https://golden-touch.onrender.com/api/health')
    service.onApplicationBootstrap()

    jest.advanceTimersByTime(10 * 60_000 - 1)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://golden-touch.onrender.com/api/health')
    jest.advanceTimersByTime(20 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    service.onModuleDestroy()
    jest.advanceTimersByTime(60 * 60_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stays disabled without a URL (local development)', () => {
    const service = make(undefined)
    service.onApplicationBootstrap()
    jest.advanceTimersByTime(60 * 60_000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never throws when the ping fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(make('https://x.test/api/health').ping('https://x.test/api/health')).resolves.toBe(
      false,
    )
  })
})
