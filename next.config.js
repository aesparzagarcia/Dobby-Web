/** @type {import('next').NextConfig} */
function resolveBackendUrl() {
  let url = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001").trim().replace(/\/$/, "");
  if (/^http:\/\/[^/]*onrender\.com/i.test(url)) {
    url = `https://${url.slice("http://".length)}`;
  }
  return url;
}

const backendUrl = resolveBackendUrl();

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
