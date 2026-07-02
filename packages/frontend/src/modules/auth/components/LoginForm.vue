<template>
	<div class="flex min-h-screen items-center justify-center bg-surface-50 p-4 dark:bg-surface-950">
		<div class="w-full max-w-sm rounded-2xl border border-surface-200 bg-white p-8 shadow-sm dark:border-surface-700 dark:bg-surface-900">
			<div class="mb-6 text-center">
				<div class="mb-2 text-sm font-medium uppercase tracking-wide text-primary">
					{{ $t('app.brand') }}
				</div>
				<h1 class="text-xl font-semibold text-surface-900 dark:text-surface-0">
					{{ $t('auth.signIn') }}
				</h1>
			</div>

			<form class="flex flex-col gap-4" @submit.prevent="onSubmit">
				<div class="flex flex-col gap-2">
					<label class="text-sm font-medium" for="email">{{ $t('common.email') }}</label>
					<InputText id="email" v-model="email" type="email" autocomplete="username" required />
				</div>

				<div class="flex flex-col gap-2">
					<label class="text-sm font-medium" for="password">{{ $t('common.password') }}</label>
					<Password
						id="password"
						v-model="password"
						input-id="password"
						:feedback="false"
						toggle-mask
						fluid
						autocomplete="current-password"
						required
					/>
				</div>

				<Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

				<Button type="submit" :label="$t('common.login')" :loading="loading" class="mt-2" />
			</form>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { areaForRole } from '@base-template/shared';
import { useUserStore } from '@/modules/auth/store/user';

export default defineComponent({
	name: 'LoginForm',
	data() {
		return {
			email: '',
			password: '',
			loading: false,
			error: '',
		};
	},
	methods: {
		async onSubmit() {
			this.loading = true;
			this.error = '';
			const userStore = useUserStore();
			try {
				const profile = await userStore.login(this.email, this.password);

				// Login único: redirige a la home del área que corresponde al rol.
				const redirect = (this.$route.query.redirect as string) || areaForRole(profile.role).homePath;
				this.$router.replace(redirect);
			} catch {
				this.error = this.$t('auth.invalidCredentials');
			} finally {
				this.loading = false;
			}
		},
	},
});
</script>
