import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
	// `rawBody: true` conserva el cuerpo crudo en `req.rawBody` para verificar la
	// firma HMAC de los webhooks de pago (Lemon Squeezy).
	const app = await NestFactory.create(AppModule, { rawBody: true });

	const prefix = process.env.API_PREFIX || 'api';
	app.setGlobalPrefix(prefix);

	app.enableCors({
		origin: true,
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: true,
		}),
	);

	// Swagger → fuente para generar el SDK (typescript-axios)
	const config = new DocumentBuilder()
		.setTitle('Base Template API')
		.setDescription('API base con auth Firebase y autorización por rol (superadmin / admin / user)')
		.setVersion('1.0.0')
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup(`${prefix}/docs`, app, document);

	const port = Number(process.env.API_PORT) || 3000;
	await app.listen(port);
	// eslint-disable-next-line no-console
	console.log(`🚀 API en http://localhost:${port}/${prefix} — docs en /${prefix}/docs`);
}

bootstrap();
