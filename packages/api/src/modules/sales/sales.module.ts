import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';
import { ProductoEntity } from '../catalog/entities/producto.entity';
import { MlNotificationEntity } from './entities/ml-notification.entity';
import { MlOrderEntity } from './entities/ml-order.entity';
import { MlQuestionEntity } from './entities/ml-question.entity';
import { MlWebhookController } from './ml-webhook.controller';
import { MlOrdersController } from './ml-orders.controller';
import { MlQuestionsController } from './ml-questions.controller';
import { MlNotificationsService } from './ml-notifications.service';
import { MlOrdersService } from './ml-orders.service';
import { MlShipmentsService } from './ml-shipments.service';
import { MlQuestionsService } from './ml-questions.service';

/**
 * Ventas de Mercado Libre: receptor de notificaciones (webhooks), panel de
 * ventas concretadas, descuento de stock y etiquetas de envío.
 *
 * Reutiliza `MlConnectionService` (tokens + refresh) importando
 * `MercadoLibreModule`, que lo exporta. No duplica lógica de conexión.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([MlNotificationEntity, MlOrderEntity, MlQuestionEntity, ProductoEntity]),
		MercadoLibreModule,
	],
	controllers: [MlWebhookController, MlOrdersController, MlQuestionsController],
	providers: [MlNotificationsService, MlOrdersService, MlShipmentsService, MlQuestionsService],
})
export class SalesModule {}
