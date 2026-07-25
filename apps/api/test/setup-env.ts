/**
 * 테스트용 환경변수.
 *
 * .env를 먼저 읽고(로컬 DB 접속 정보), 없는 값만 테스트 기본값으로 채운다.
 * CI에는 .env가 없으므로 이 기본값들이 쓰인다.
 */
import 'dotenv/config';

process.env.NODE_ENV = 'test';
/* .env의 값을 덮어쓴다. 요청 로그가 쏟아지면 실패한 테스트가 묻힌다. */
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET ??= 'test-only-secret-do-not-use-in-production-0123456789';
process.env.DATABASE_URL ??=
  'postgresql://fitter:fitter_dev_only@localhost:5432/fitter?schema=public';
