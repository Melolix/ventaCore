import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstagramMessageEntity } from './entities/instagram-message.entity';

/**
 * Responder DMs de Instagram por WhatsApp (mismo patrón que las preguntas de ML).
 *
 * Flujo: llega un DM → webhook de IG → se guarda (`instagram_messages`) → se avisa
 * por WhatsApp (reusa `WhatsappService`) → el CM responde citando → el entrante de
 * WhatsApp rutea por `kind='ig_dm'` y envía la respuesta de vuelta al DM (Graph API
 * con el Page token del rubro, vía `MetaConnectionService`).
 *
 * Este módulo arranca como esqueleto: por ahora solo registra la entidad para que
 * `synchronize` cree la tabla. El webhook + el servicio de envío vienen después.
 */
@Module({
	imports: [TypeOrmModule.forFeature([InstagramMessageEntity])],
	controllers: [],
	providers: [],
	exports: [],
})
export class InstagramModule {}
