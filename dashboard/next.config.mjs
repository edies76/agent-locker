/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      { source: '/dashboard/overview', destination: '/overview' },
      { source: '/dashboard/activity', destination: '/activity' },
      { source: '/dashboard/approvals', destination: '/approvals' },
      { source: '/dashboard/logs', destination: '/logs' },
      { source: '/dashboard/plugin', destination: '/plugin' },
      { source: '/dashboard/mcp', destination: '/mcp' },
      { source: '/dashboard/mcp/setup', destination: '/mcp/setup' },
      { source: '/dashboard/analytics', destination: '/analytics' },
      { source: '/dashboard/settings', destination: '/settings' },
      { source: '/dashboard/about', destination: '/about' },
      { source: '/dashboard/chat', destination: '/chat' },
      { source: '/dashboard/cli', destination: '/cli' },
      { source: '/dashboard/activity/:actionId', destination: '/activity/:actionId' },
      { source: '/dashboard/mcp/:serverName', destination: '/mcp/:serverName' },
    ]
  },
}

export default nextConfig
