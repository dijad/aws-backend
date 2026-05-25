import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { closeCloudSqlConnector, initCloudSqlConnector } from '../config/cloud-sql';
import { isCloudSqlTarget } from '../config/db-config';
import { ensureDatabaseUrl } from '../config/database-url';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private constructor(options?: ConstructorParameters<typeof PrismaClient>[0]) {
    super(options);
  }

  static async create(): Promise<PrismaService> {
    if (isCloudSqlTarget()) {
      const adapter = await initCloudSqlConnector();
      const service = new PrismaService({ adapter });
      await service.$connect();
      return service;
    }

    const service = new PrismaService({
      datasources: { db: { url: ensureDatabaseUrl() } },
    });
    await service.$connect();
    return service;
  }

  async onModuleInit() {
    /* conexión establecida en PrismaModule useFactory */
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (isCloudSqlTarget()) {
      await closeCloudSqlConnector();
    }
  }
}
