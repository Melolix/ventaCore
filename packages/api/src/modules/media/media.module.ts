import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { MediaController } from './media.controller';

@Module({
	imports: [UsersModule], // FirebaseAuthGuard inyecta UsersService
	controllers: [MediaController],
	providers: [FirebaseAuthGuard, RolesGuard],
})
export class MediaModule {}
