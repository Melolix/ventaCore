import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialModule } from '../social/social.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RubroEntity } from '../catalog/entities/rubro.entity';
import { InstagramMessageEntity } from './entities/instagram-message.entity';
import { InstagramInboundService } from './instagram-inbound.service';
import { InstagramService } from './instagram.service';
import { InstagramWebhookController } from './instagram-webhook.controller';

/**
 * Responder DMs de Instagram por WhatsApp (mismo patrón que las preguntas de ML).
 *
 * Flujo: llega un DM → webhook de IG → se guarda (`instagram_messages`) → se avisa
 * por WhatsApp (`WhatsappService`) → el CM responde citando → el entrante de
 * WhatsApp rutea por `kind='ig_dm'` y envía la respuesta de vuelta al DM (Graph API
 * con el Page token del rubro, vía `MetaConnectionService`).
 *
 * Importa `SocialModule` (resolver rubro + Page token por cuenta de IG) y
 * `WhatsappModule` (avisar). El envío de la respuesta a IG (Paso 3) se agrega luego.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([InstagramMessageEntity, RubroEntity]),
		SocialModule,
		forwardRef(() => WhatsappModule),
	],
	controllers: [InstagramWebhookController],
	providers: [InstagramInboundService, InstagramService],
	exports: [InstagramService],
})
export class InstagramModule {}
