import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(UserEntity)
		private readonly repo: Repository<UserEntity>,
		private readonly firebase: FirebaseService,
	) {}

	findByUid(uid: string): Promise<UserEntity | null> {
		return this.repo.findOne({ where: { uid } });
	}

	findByEmail(email: string): Promise<UserEntity | null> {
		return this.repo.findOne({ where: { email } });
	}

	findAll(): Promise<UserEntity[]> {
		return this.repo.find({ order: { createdAt: 'DESC' } });
	}

	async findOne(id: string): Promise<UserEntity> {
		const user = await this.repo.findOne({ where: { id } });
		if (!user) throw new NotFoundException('Usuario no encontrado');
		return user;
	}

	/** Crea el usuario en Firebase Auth y persiste su perfil + rol. */
	async create(dto: CreateUserDto): Promise<UserEntity> {
		const existing = await this.findByEmail(dto.email);
		if (existing) throw new ConflictException('Ya existe un usuario con ese email');

		let fbUser: { uid: string };
		try {
			fbUser = await this.firebase.createUser(dto.email, dto.password, dto.displayName);
		} catch (err) {
			// El email puede existir en Firebase aunque no en Postgres (datos
			// desincronizados). Lo devolvemos como 409 para un mensaje claro, no un 500.
			const code = (err as { errorInfo?: { code?: string } })?.errorInfo?.code;
			if (code === 'auth/email-already-exists') {
				throw new ConflictException('Ya existe un usuario con ese email');
			}
			throw err;
		}

		const entity = this.repo.create({
			uid: fbUser.uid,
			email: dto.email,
			displayName: dto.displayName ?? null,
			role: dto.role,
			active: dto.active ?? true,
			espacioId: dto.espacioId ?? null,
		});
		return this.repo.save(entity);
	}

	async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
		const user = await this.findOne(id);
		Object.assign(user, dto);
		return this.repo.save(user);
	}

	async remove(id: string): Promise<void> {
		const user = await this.findOne(id);
		await this.firebase.deleteUser(user.uid).catch(() => undefined);
		await this.repo.remove(user);
	}
}
