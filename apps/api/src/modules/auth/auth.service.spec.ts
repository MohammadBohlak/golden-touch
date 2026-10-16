import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.service'
import { AuthService } from './auth.service'

describe('AuthService', () => {
  let service: AuthService
  let passwordHash: string
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  }
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') }

  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'u1',
    name: 'مدير',
    email: 'admin@test.local',
    phone: null,
    passwordHash,
    isActive: true,
    role: {
      id: 1,
      name: 'admin',
      label: 'المدير',
      permissions: [{ key: 'users.read' }, { key: 'bookings.read' }],
    },
    ...overrides,
  })

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('secret123', 4)
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile()
    service = moduleRef.get(AuthService)
  })

  it('logs in with valid credentials and returns token + permissions', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser())
    const result = await service.login(' Admin@Test.local ', 'secret123')

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@test.local' } }),
    )
    expect(result.token).toBe('signed-token')
    expect(result.user).toEqual({
      id: 'u1',
      name: 'مدير',
      email: 'admin@test.local',
      phone: null,
      role: { id: 1, name: 'admin', label: 'المدير' },
      permissions: ['bookings.read', 'users.read'],
    })
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1' })
  })

  it('rejects a wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser())
    await expect(service.login('admin@test.local', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rejects an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null)
    await expect(service.login('nobody@test.local', 'secret123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
  })

  it('rejects a deactivated account', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }))
    await expect(service.login('admin@test.local', 'secret123')).rejects.toThrow('موقوف')
  })

  it('validateUser returns null for inactive users', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }))
    await expect(service.validateUser('u1')).resolves.toBeNull()
  })

  it('changePassword verifies the current password', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue(makeUser())
    await expect(service.changePassword('u1', 'wrong', 'newpass123')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await service.changePassword('u1', 'secret123', 'newpass123')
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
  })
})
