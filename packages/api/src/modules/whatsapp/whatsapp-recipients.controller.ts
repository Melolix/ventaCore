import { Body, Controller, Delete, ForbiddenException, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { WhatsappRecipientsService } from './whatsapp-recipients.service';
import { UpsertRecipientDto } from './dto/upsert-recipient.dto';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** El admin gestiona a quién se le avisan por WhatsApp las preguntas de cada rubro. */
@ApiTags('whatsapp')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/whatsapp/recipient')
export class WhatsappRecipientsController {
	constructor(private readonly recipients: WhatsappRecipientsService) {}

	/** Devuelve el destinatario del rubro (o null si no hay). */
	@Get()
	get(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.recipients.get(rubroId, espacioDe(user));
	}

	/** Crea o actualiza el destinatario del rubro. */
	@Put()
	upsert(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Body() dto: UpsertRecipientDto,
	) {
		return this.recipients.upsert(rubroId, espacioDe(user), dto);
	}

	/** Elimina el destinatario del rubro. */
	@Delete()
	remove(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.recipients.remove(rubroId, espacioDe(user));
	}
}
