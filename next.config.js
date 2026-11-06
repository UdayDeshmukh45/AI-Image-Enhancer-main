/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: {
    domains: ["upcdn.io", "replicate.delivery", "pbxt.replicate.delivery"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.replicate.delivery",
      },
      {
        protocol: "https",
        hostname: "upcdn.io",
      },
    ],
  },
};
