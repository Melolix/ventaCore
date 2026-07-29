import { PartialType } from '@nestjs/swagger';
import { CreateProductoDto } from './create-producto.dto';

/** Todos los campos de creación, pero opcionales (edición parcial). */
export class UpdateProductoDto extends PartialType(CreateProductoDto) {}
