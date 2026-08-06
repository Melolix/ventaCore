# Módulo `sales` — Ventas de Mercado Libre

Ventas concretadas, descuento de stock y etiquetas de envío, todo colgado de un
**receptor único de notificaciones (webhooks)** de la app de plataforma de ML.

## Arquitectura

```
ML  ──POST /webhooks/ml──►  MlWebhookController
                                 │ (responde 200 al toque)
                                 ▼
                          MlNotificationsService
                          · persiste el aviso (ml_notifications)
                          · resuelve el rubro por user_id (findByMlUserId)
                          · despacha por topic
                                 ├── orders_v2 ─► MlOrdersService   (venta + stock)
                                 └── shipments ─► MlShipmentsService (estado envío)
```

- **Un solo endpoint** atiende todos los topics; se despacha por `topic`.
- Reutiliza `MlConnectionService` (tokens + refresh) de `MercadoLibreModule`.
- La app de ML es **única de plataforma** (`ML_APP_ID` / `ML_APP_SECRET`): las
  notificaciones se configuran **una vez** y llegan de todos los vendedores.

## Entidades

- **`ml_notifications`** — log de cada webhook + estado de proceso (`received` /
  `processed` / `ignored` / `failed`). Auditoría y depuración. No es la
  idempotencia del negocio.
- **`ml_orders`** — venta concretada. Es la fuente del panel **y** el libro de
  idempotencia del stock (`stockApplied`). Los `order_items` van en `raw` (jsonb).

## Flujos

1. **Venta** (`orders_v2`): trae `GET /orders/{id}`, upsert en `ml_orders`.
2. **Stock**: si la orden está `paid` y no se aplicó → descuenta; si pasa a
   `cancelled`/`invalid` y ya se aplicó → repone. Idempotente por un **reclamo
   atómico** sobre `stockApplied` (aguanta webhooks concurrentes/reenviados).
   El **backfill NO toca stock** (las ventas históricas ya están reflejadas).
3. **Envío** (`shipments`): trae `GET /shipments/{id}`, actualiza `shipmentStatus`.
4. **Etiqueta**: on-demand desde el panel, `GET /shipment_labels` (PDF o ZPL).

## Endpoints

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| `POST` | `/webhooks/ml` | pública | Receptor de notificaciones (todos los topics) |
| `GET` | `/rubros/:rubroId/ml/orders` | admin | Lista las ventas del rubro |
| `POST` | `/rubros/:rubroId/ml/orders/sync` | admin | Backfill del historial (`/orders/search`) |
| `GET` | `/rubros/:rubroId/ml/orders/:orderId/label?format=pdf\|zpl` | admin | Baja la etiqueta |

## Configuración para que lleguen los webhooks

1. Esquema: correr la API una vez con **`DB_SYNCHRONIZE=true`** para crear
   `ml_orders` y `ml_notifications`.
2. Un **túnel público** al API (ej. ngrok).
3. En el panel de la app de ML (developers.mercadolibre.com.ar → Notificaciones):
   - **Callback URL**: `{túnel}/webhooks/ml`
   - **Topics**: `orders_v2`, `shipments`
4. El rubro tiene que tener una cuenta de ML **real** conectada (los usuarios de
   PRUEBA tienen bloqueado el envío/etiqueta por policy → 403).

Sin webhook, el **backfill** (botón Sincronizar) igual trae el historial de
ventas; lo que NO corre sin webhook es el descuento de stock en vivo ni el
estado del envío.

## Límites conocidos

- **Reembolsos que quedan en `paid`** (mediations) no reponen stock — solo
  `cancelled` / `invalid`. Detectarlos requeriría mirar `payments`/`mediations`.
- **Stock solo de productos linkeados**: se matchea por `producto.mlItemId`; los
  ítems sin producto local o con `stock` en null se saltean (a propósito).
- **Backfill** tiene un techo de 20 páginas (1000 órdenes) por sincronización.
- La tabla `ml_notifications` crece con cada aviso (incluye reintentos de ML);
  eventualmente conviene una retención/limpieza.
