import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RubrosService } from './rubros.service';
import { CreateRubroDto } from './dto/create-rubro.dto';
import { UpdateRubroDto } from './dto/update-rubro.dto';

@ApiTags('rubros')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rubros')
export class RubrosController {
	constructor(private readonly rubros: RubrosService) {}

	@Get()
	findAll(@CurrentUser() user: AuthenticatedUser) {
		return this.rubros.findByOwner(user.uid);
	}

	@Get(':id')
	findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
		return this.rubros.findOne(id, user.uid);
	}

	@Post()
	create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRubroDto) {
		return this.rubros.create(user.uid, dto);
	}

	@Patch(':id')
	update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRubroDto) {
		return this.rubros.update(id, user.uid, dto);
	}

	@Delete(':id')
	remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
		return this.rubros.remove(id, user.uid);
	}
}
