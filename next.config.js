/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', '@prisma/adapter-libsql'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@libsql/client', '@prisma/adapter-libsql')
    }
    return config
  },
}

module.exports = nextConfig
