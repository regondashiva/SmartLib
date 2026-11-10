import { prisma } from '../../config/prisma.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { comparePassword } from '../../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt.js';
import { LoginInput } from './auth.schema.js';
import { AuditAction } from '@prisma/client';

export class AuthService {
  async login(
    input: LoginInput,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase().trim() },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid institutional email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError(
        `Account access denied. Status: ${user.status.toLowerCase()}`
      );
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid institutional email or password');
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role.name,
      permissions,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update last login timestamp asynchronously
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Record login audit event
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: AuditAction.LOGIN,
        entityName: 'User',
        entityId: user.id,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        newState: {
          event: 'AUTHENTICATED_SESSION_STARTED',
          role: user.role.name,
        },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        permissions,
        lastLoginAt: user.lastLoginAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.code);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      permissions,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();

