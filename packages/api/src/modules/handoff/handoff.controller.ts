import {
	Controller,
	Get,
	Headers,
	Param,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { HandoffService, UploadedImage } from './handoff.service';

/** Corte duro de multer (el límite de negocio, 8 MB, lo valida el service). */
const MULTER_MAX_BYTES = 15 * 1024 * 1024;

@ApiTags('handoff')
@Controller('uploads/handoff')
export class HandoffController {
	constructor(private readonly handoff: HandoffService) {}

	/** La compu (admin logueado) abre una sesión de subida por QR. */
	@Post()
	@ApiBearerAuth()
	@UseGuards(FirebaseAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	create(@CurrentUser() user: AuthenticatedUser) {
		return this.handoff.create(user.uid);
	}

	/** El celular sube una foto. Público: se autoriza con el token de la sesión. */
	@Post(':id/foto')
	@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MULTER_MAX_BYTES } }))
	addPhoto(
		@Param('id') id: string,
		@Headers('x-handoff-token') token: string,
		@UploadedFile() file: UploadedImage,
	) {
		return this.handoff.addPhoto(id, token, file);
	}

	/** La compu consulta (polling) las fotos que fueron llegando. */
	@Get(':id')
	@ApiBearerAuth()
	@UseGuards(FirebaseAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	poll(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
		return this.handoff.poll(id, user.uid);
	}
}
