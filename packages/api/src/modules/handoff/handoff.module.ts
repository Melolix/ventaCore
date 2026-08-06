import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { HandoffController } from './handoff.controller';
import { HandoffService } from './handoff.service';

@Module({
	imports: [UsersModule], // FirebaseAuthGuard inyecta UsersService
	controllers: [HandoffController],
	providers: [HandoffService, FirebaseAuthGuard, RolesGuard],
})
export class HandoffModule {}
