/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* 워크스페이스 패키지를 Next 빌드 파이프라인에 태운다. */
  transpilePackages: ['@fitter/shared'],
};

export default nextConfig;
