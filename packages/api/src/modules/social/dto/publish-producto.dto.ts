import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { MetaNetwork, MetaPostKind } from '@base-template/shared';

/** Opciones al publicar un producto en las redes del rubro. */
export class PublishProductoDto {
	@ApiProperty({ required: false, isArray: true, enum: ['facebook', 'instagram'], example: ['facebook', 'instagram'] })
	@IsOptional()
	@IsArray()
	@IsIn(['facebook', 'instagram'], { each: true })
	networks?: MetaNetwork[];

	@ApiProperty({ required: false, description: 'Texto del posteo; si se omite, se arma con los datos del producto.' })
	@IsOptional()
	@IsString()
	@MaxLength(2200)
	caption?: string;

	@ApiProperty({
		required: false,
		description:
			'URL de imagen pública para publicar (override). Útil para probar: Meta descarga la imagen de esta ' +
			'URL, que debe ser accesible desde internet y JPEG. Si se omite, usa la imagen del producto.',
	})
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	imageUrl?: string;

	@ApiProperty({
		required: false,
		enum: ['post', 'story'],
		default: 'post',
		description:
			'Qué se publica: "post" va al feed (con caption y permalink), "story" publica una Historia ' +
			'(media_type=STORIES, 9:16, sin caption, expira a las 24 h). Las Historias son solo de Instagram.',
	})
	@IsOptional()
	@IsIn(['post', 'story'])
	kind?: MetaPostKind;
}
