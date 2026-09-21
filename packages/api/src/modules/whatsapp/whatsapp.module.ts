import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SalesModule } from '../sales/sales.module';
import { FirebaseAuthGuard } from '../../common/auth/firebase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { WhatsappRecipientEntity } from './entities/whatsapp-recipient.entity';
import { WhatsappNotificationEntity } from './entities/whatsapp-notification.entity';
import { WhatsappInboundEntity } from './entities/whatsapp-inbound.entity';
import { WhatsappRecipientsService } from './whatsapp-recipients.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappInboundService } from './whatsapp-inbound.service';
import { WhatsappRecipientsController } from './whatsapp-recipients.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

/**
 * Integración con WhatsApp Cloud API para responder las preguntas de Mercado
 * Libre por WhatsApp.
 *
 * El número que envía es ÚNICO de plataforma (Cloud API: WHATSAPP_PHONE_ID /
 * WHATSAPP_TOKEN en el entorno). Cada rubro define UN destinatario
 * (`whatsapp_recipients`) al que se le avisan las preguntas. El ruteo de la
 * respuesta va por mensaje citado (`whatsapp_notifications.waMessageId`).
 *
 * Fases: F1 saliente (avisar pregunta nueva) · F2 entrante (parsear cita →
 * publicar en ML) · F3 endurecer (estados de entrega, reintentos, fallback).
 *
 * Exporta `WhatsappService` para que `SalesModule` dispare el aviso saliente
 * cuando entra una pregunta nueva de ML.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([WhatsappRecipientEntity, WhatsappNotificationEntity, WhatsappInboundEntity]),
		UsersModule,
		forwardRef(() => SalesModule),
	],
	controllers: [WhatsappRecipientsController, WhatsappWebhookController],
	providers: [WhatsappRecipientsService, WhatsappService, WhatsappInboundService, FirebaseAuthGuard, RolesGuard],
	exports: [WhatsappService, WhatsappRecipientsService],
})
export class WhatsappModule {}
