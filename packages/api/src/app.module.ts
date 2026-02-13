import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { PoliciesModule } from './policies/policies.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { DocumentsModule } from './documents/documents.module.js';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AgentsModule,
    PoliciesModule,
    AuditModule,
    ApprovalsModule,
    DocumentsModule,
  ],
})
export class AppModule {}
