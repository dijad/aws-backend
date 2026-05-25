import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AUTH_DISABLED, DEV_MOCK_USER } from '../common/config/auth-dev';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
  namespace: '/ws',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(@ConnectedSocket() socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers['authorization']?.toString().replace(/^Bearer /, '');

      if (AUTH_DISABLED && token === 'dev-bypass') {
        socket.data.userId = DEV_MOCK_USER.id;
        socket.join(`user:${DEV_MOCK_USER.id}`);
        this.logger.log(`Dev bypass connected (socket ${socket.id})`);
        return;
      }

      if (!token) {
        socket.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET') ?? 'dev-secret',
      });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!user) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = user.id;
      socket.join(`user:${user.id}`);
      this.logger.log(`User ${user.id} connected via socket ${socket.id}`);
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    if (socket.data.userId) {
      this.logger.log(
        `User ${socket.data.userId} disconnected (socket ${socket.id})`,
      );
    }
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
