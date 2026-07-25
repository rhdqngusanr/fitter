import { Global, Module } from '@nestjs/common';

import type { PasswordHasherPort } from '@fitter/domain';

import { ScryptPasswordHasher } from './scrypt-password-hasher';

/**
 * 비밀번호 해시 구현 주입 지점.
 *
 * 알고리즘을 바꾸려면 여기 한 줄만 바꾼다. 호출부는 어떤 해시인지 모른다.
 */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

@Global()
@Module({
  providers: [
    { provide: PASSWORD_HASHER, useFactory: (): PasswordHasherPort => new ScryptPasswordHasher() },
  ],
  exports: [PASSWORD_HASHER],
})
export class SecurityModule {}
