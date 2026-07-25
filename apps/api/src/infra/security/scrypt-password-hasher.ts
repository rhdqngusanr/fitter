import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type { PasswordHasherPort } from '@fitter/domain';

/**
 * promisify(scrypt)는 옵션 없는 3-인자 오버로드로 추론된다.
 * 비용 파라미터를 넘겨야 하므로 직접 감싼다.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

/**
 * scrypt 기반 비밀번호 해시.
 *
 * **왜 argon2가 아닌가.** argon2id가 더 낫지만 네이티브 모듈이고,
 * 이 개발 환경의 Windows Application Control 정책이 서명되지 않은 네이티브 모듈을 막는다
 * (@swc/core에서 이미 겪었다). scrypt는 Node 내장이라 그 문제가 없고,
 * 메모리 하드 KDF라는 점에서 bcrypt보다 낫다.
 *
 * 알고리즘을 바꾸려면 이 파일만 갈아 끼우면 된다. 도메인은 PasswordHasherPort만 안다.
 *
 * 저장 형식: `scrypt$N$r$p$saltHex$hashHex`
 * 파라미터를 해시에 함께 저장하는 이유는, 나중에 비용을 올려도
 * **기존 해시를 그대로 검증할 수 있어야** 하기 때문이다.
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasherPort {
  /* OWASP 권고 수준. N=2^16, r=8, p=1 */
  private readonly N = 65536;
  private readonly r = 8;
  private readonly p = 1;
  private readonly keyLength = 64;

  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await scryptAsync(plain, salt, this.keyLength, {
      N: this.N,
      r: this.r,
      p: this.p,
      /* 기본 메모리 상한(32MB)으로는 N=65536을 못 돌린다. 여유를 준다. */
      maxmem: 256 * 1024 * 1024,
    });

    return ['scrypt', this.N, this.r, this.p, salt.toString('hex'), derived.toString('hex')].join(
      '$',
    );
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    const parts = hashed.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    let expected: Buffer;
    let actual: Buffer;
    try {
      expected = Buffer.from(hashHex ?? '', 'hex');
      actual = await scryptAsync(plain, Buffer.from(saltHex ?? '', 'hex'), expected.length, {
        N,
        r,
        p,
        maxmem: 256 * 1024 * 1024,
      });
    } catch {
      /* 형식이 깨진 해시. 예외를 밖으로 내보내면 "이 계정은 해시가 이상하다"가 새어나간다. */
      return false;
    }

    if (expected.length !== actual.length || expected.length === 0) return false;
    /* 길이 비교 후 상수 시간 비교. 문자열 === 로 하면 타이밍 공격 표면이 생긴다. */
    return timingSafeEqual(expected, actual);
  }
}
