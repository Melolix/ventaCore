import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, PaymentProvider, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { PaymentConfigService } from './payment-config.service';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SavePaymentConfigDto } from './dto/save-payment-config.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

/** Devuelve el espacio del admin o rechaza si no tiene uno asignado. */
function espacioDe(user: AuthenticatedUser): string {
	if (!user.espacioId) throw new ForbiddenException('El usuario no tiene un espacio asignado');
	return user.espacioId;
}

/**
 * El admin (CM) configura los cobros de SU espacio: credenciales del proveedor y
 * los planes de suscripción de cada rubro.
 */
@ApiTags('mi-espacio-pagos')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('mi-espacio')
export class PaymentsAdminController {
	constructor(
		private readonly config: PaymentConfigService,
		private readonly plans: SubscriptionPlansService,
	) {}

	// ── Credenciales del proveedor ──

	@Get('payment-config')
	@ApiQuery({ name: 'provider', enum: PaymentProvider, required: false })
	getConfig(@CurrentUser() user: AuthenticatedUser, @Query('provider') provider?: PaymentProvider) {
		return this.config.getPublic(espacioDe(user), provider ?? PaymentProvider.LEMON_SQUEEZY);
	}

	@Put('payment-config')
	saveConfig(@CurrentUser() user: AuthenticatedUser, @Body() dto: SavePaymentConfigDto) {
		return this.config.save(espacioDe(user), dto);
	}

	// ── Planes de un rubro ──

	@Get('rubros/:rubroId/plans')
	listPlans(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string) {
		return this.plans.listByRubro(rubroId, espacioDe(user));
	}

	@Post('rubros/:rubroId/plans')
	createPlan(@CurrentUser() user: AuthenticatedUser, @Param('rubroId') rubroId: string, @Body() dto: CreatePlanDto) {
		return this.plans.create(rubroId, espacioDe(user), dto);
	}

	@Patch('rubros/:rubroId/plans/:planId')
	updatePlan(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('planId') planId: string,
		@Body() dto: UpdatePlanDto,
	) {
		return this.plans.update(planId, rubroId, espacioDe(user), dto);
	}

	@Delete('rubros/:rubroId/plans/:planId')
	removePlan(
		@CurrentUser() user: AuthenticatedUser,
		@Param('rubroId') rubroId: string,
		@Param('planId') planId: string,
	) {
		return this.plans.remove(planId, rubroId, espacioDe(user));
	}
}
