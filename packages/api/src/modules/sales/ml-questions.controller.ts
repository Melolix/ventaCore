import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MlQuestionsService } from './ml-questions.service';

function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/** Panel de preguntas de Mercado Libre de un rubro (responder desde la app). */
@ApiTags('mercadolibre')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros/:rubroId/ml/questions')
export class MlQuestionsController {
	constructor(private readonly questions: MlQuestionsService) {}

	/** Lista las preguntas del rubro (filtro opcional por estado, ej. UNANSWERED). */
	@Get()
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Query('status') status?: string,
		@Query('limit') limit?: string,
		@Query('offset') offset?: string,
	) {
		return this.questions.list(rubroId, espacioDe(user), {
			status: status || undefined,
			limit: limit ? Number(limit) : undefined,
			offset: offset ? Number(offset) : undefined,
		});
	}

	/** Sincroniza (backfill) las preguntas desde Mercado Libre. */
	@Post('sync')
	sync(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.questions.backfill(rubroId, espacioDe(user));
	}

	/** Publica la respuesta de una pregunta en Mercado Libre. */
	@Post(':questionId/answer')
	answer(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('questionId') questionId: string,
		@Body('text') text: string,
	) {
		return this.questions.answer(rubroId, espacioDe(user), questionId, text);
	}
}
