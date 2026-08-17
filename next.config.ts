import type { NextConfig } from "next";

const sessionSecret = process.env.STUDIO_SESSION_SECRET?.trim();

// A development-only fallback exists for local convenience, but production
// sessions encrypt connection URIs and therefore require a deployment-specific
// secret. Validate during the build so a bad deployment never reaches users.
if (process.env.NODE_ENV === "production" && (!sessionSecret || sessionSecret.length < 16)) {
  throw new Error(
    "STUDIO_SESSION_SECRET must be set to a unique value of at least 16 characters before building Studio for production.",
  );
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["@liorandb/driver"],
};

export default nextConfig;
