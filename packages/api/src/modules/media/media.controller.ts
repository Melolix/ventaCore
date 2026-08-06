import {
	BadGatewayException,
	BadRequestException,
	Controller,
	Get,
	Query,
	StreamableFile,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@base-template/shared';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';

/** Solo proxeamos imágenes de NUESTRO Storage de Firebase (evita SSRF). */
const ALLOWED_URL = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//;

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('media')
export class MediaController {
	/**
	 * Descarga una imagen de Storage del lado del servidor y la devuelve, para que
	 * el navegador NO tenga que hacer un fetch cross-origin (que exigiría CORS en
	 * el bucket). Lo usa "quitar fondo" cuando la fuente es una URL ya subida.
	 */
	@Get('proxy')
	async proxy(@Query('url') url: string): Promise<StreamableFile> {
		if (!url || !ALLOWED_URL.test(url)) throw new BadRequestException('URL no permitida');
		const upstream = await fetch(url);
		if (!upstream.ok) throw new BadGatewayException('No se pudo obtener la imagen');
		const buffer = Buffer.from(await upstream.arrayBuffer());
		const type = upstream.headers.get('content-type') ?? 'image/jpeg';
		return new StreamableFile(buffer, { type });
	}
}
