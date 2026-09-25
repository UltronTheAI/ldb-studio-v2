import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isLoopbackHost,
  isCloudMetadataHost,
  isPrivateNetworkHost,
  classifyConnectionTarget,
  getSanitizedConnectionMetadata,
  validateConnectionTarget,
  sanitizeConnectionString,
  parseAndClassifyConnection,
} from "../lib/liorandb/connection";

import {
  LocalTargetNotReachableError,
  ProhibitedTargetError,
  mapStudioError,
  redactMessage,
} from "../lib/liorandb/errors";

describe("LioranDB Studio Connection Architecture & Target Classification", () => {
  describe("Target Classification", () => {
    it("classifies 127.0.0.1 as local-loopback", () => {
      assert.equal(isLoopbackHost("127.0.0.1"), true);
      assert.equal(classifyConnectionTarget("127.0.0.1"), "local-loopback");
    });

    it("classifies localhost and variations as local-loopback", () => {
      assert.equal(isLoopbackHost("localhost"), true);
      assert.equal(isLoopbackHost("localhost."), true);
      assert.equal(isLoopbackHost("app.localhost"), true);
      assert.equal(classifyConnectionTarget("localhost"), "local-loopback");
    });

    it("classifies ::1 and [::1] as local-loopback", () => {
      assert.equal(isLoopbackHost("::1"), true);
      assert.equal(isLoopbackHost("[::1]"), true);
      assert.equal(isLoopbackHost("0:0:0:0:0:0:0:1"), true);
      assert.equal(classifyConnectionTarget("::1"), "local-loopback");
    });

    it("classifies other 127.x.x.x IPv4 loopbacks as local-loopback", () => {
      assert.equal(isLoopbackHost("127.0.0.2"), true);
      assert.equal(isLoopbackHost("127.255.0.1"), true);
      assert.equal(classifyConnectionTarget("127.0.0.2"), "local-loopback");
    });

    it("classifies remote IPv4 as remote", () => {
      assert.equal(isLoopbackHost("93.184.216.34"), false);
      assert.equal(classifyConnectionTarget("93.184.216.34"), "remote");
    });

    it("classifies remote hostname as remote", () => {
      assert.equal(isLoopbackHost("swaraj.db.liorandb.com"), false);
      assert.equal(classifyConnectionTarget("swaraj.db.liorandb.com"), "remote");
    });

    it("classifies cloud metadata and link-local addresses for SSRF protection", () => {
      assert.equal(isCloudMetadataHost("169.254.169.254"), true);
      assert.equal(isCloudMetadataHost("169.254.1.1"), true);
      assert.equal(isCloudMetadataHost("instance-data"), true);
      assert.equal(isCloudMetadataHost("fd00:ec2::254"), true);
      assert.equal(classifyConnectionTarget("169.254.169.254"), "cloud-metadata");
    });

    it("classifies private network addresses", () => {
      assert.equal(isPrivateNetworkHost("10.0.0.1"), true);
      assert.equal(isPrivateNetworkHost("172.16.0.1"), true);
      assert.equal(isPrivateNetworkHost("192.168.1.100"), true);
      assert.equal(classifyConnectionTarget("192.168.1.100"), "private-network");
    });
  });

  describe("URI Parsing & Metadata Extraction", () => {
    it("handles percent-encoded passwords with special characters", () => {
      const uri = "liorandb://admin:N8v%40K3m%21T7q%23X2pL@127.0.0.1:27018/default";
      const { parsed, targetType, isLocal } = parseAndClassifyConnection(uri);

      assert.equal(parsed.host, "127.0.0.1");
      assert.equal(parsed.port, 27018);
      assert.equal(parsed.username, "admin");
      assert.equal(parsed.password, "N8v@K3m!T7q#X2pL");
      assert.equal(parsed.database, "default");
      assert.equal(targetType, "local-loopback");
      assert.equal(isLocal, true);
    });

    it("handles URI with database component", () => {
      const uri = "liorandb://admin:password@swaraj.db.liorandb.com:443/production";
      const metadata = getSanitizedConnectionMetadata(uri);

      assert.equal(metadata.host, "swaraj.db.liorandb.com");
      assert.equal(metadata.port, 443);
      assert.equal(metadata.database, "production");
      assert.equal(metadata.targetType, "remote");
      assert.equal(metadata.isLocal, false);
      assert.equal(metadata.tls, true);
    });

    it("handles URI without database component", () => {
      const uri = "liorandb://admin:password@swaraj.db.liorandb.com:443";
      const metadata = getSanitizedConnectionMetadata(uri);

      assert.equal(metadata.host, "swaraj.db.liorandb.com");
      assert.equal(metadata.port, 443);
      assert.equal(metadata.database, null);
      assert.equal(metadata.targetType, "remote");
      assert.equal(metadata.isLocal, false);
    });

    it("handles IPv6 URI format", () => {
      const uri = "liorandb://admin:password@[::1]:27018/mydb";
      const metadata = getSanitizedConnectionMetadata(uri);

      assert.equal(metadata.host, "::1");
      assert.equal(metadata.port, 27018);
      assert.equal(metadata.database, "mydb");
      assert.equal(metadata.targetType, "local-loopback");
      assert.equal(metadata.isLocal, true);
    });

    it("throws ConfigurationError on malformed URIs", () => {
      assert.throws(() => {
        getSanitizedConnectionMetadata("not-a-valid-uri");
      });
    });
  });

  describe("Validation & Hosted Security", () => {
    it("blocks localhost when allowLocal is false (hosted environment simulation)", () => {
      const uri = "liorandb://admin:password@127.0.0.1:27018/default";

      assert.throws(
        () => {
          validateConnectionTarget(uri, { allowLocal: false });
        },
        (err) => {
          assert.ok(err instanceof LocalTargetNotReachableError);
          assert.equal(err.targetHost, "127.0.0.1");
          assert.equal(err.targetPort, 27018);
          assert.match(err.message, /Local database detected/);
          assert.match(err.message, /hosted remotely/);
          return true;
        },
      );
    });

    it("blocks cloud metadata SSRF targets unconditionally", () => {
      const uri = "liorandb://admin:password@169.254.169.254:27018/default";

      assert.throws(
        () => {
          validateConnectionTarget(uri);
        },
        (err) => {
          assert.ok(err instanceof ProhibitedTargetError);
          assert.match(err.message, /restricted/);
          return true;
        },
      );
    });

    it("allows valid remote targets in hosted mode", () => {
      const uri = "liorandb://admin:password@swaraj.db.liorandb.com:443/default";
      const metadata = validateConnectionTarget(uri, { allowLocal: false });

      assert.equal(metadata.host, "swaraj.db.liorandb.com");
      assert.equal(metadata.targetType, "remote");
    });
  });

  describe("Credential Sanitization & Error Redaction", () => {
    it("sanitizes connection strings by masking passwords", () => {
      const uri = "liorandb://admin:SuperSecret123!@127.0.0.1:27018/default";
      const sanitized = sanitizeConnectionString(uri);

      assert.ok(!sanitized.includes("SuperSecret123!"));
      assert.ok(sanitized.includes("admin:***@127.0.0.1:27018"));
    });

    it("redacts credentials from error messages", () => {
      const raw = "Failed to connect to liorandb://admin:P%40ssw0rd!@127.0.0.1:27018/default";
      const redacted = redactMessage(raw);

      assert.ok(!redacted.includes("P%40ssw0rd!"));
      assert.ok(redacted.includes("admin:***@127.0.0.1:27018"));
    });

    it("maps LocalTargetNotReachableError cleanly to user-friendly descriptor", () => {
      const err = new LocalTargetNotReachableError("127.0.0.1", 27018);
      const mapped = mapStudioError(err);

      assert.equal(mapped.title, "Local database detected");
      assert.match(mapped.message, /hosted remotely/);
      assert.equal(mapped.code, "LDB_LOCAL_TARGET_HOSTED_STUDIO");
    });
  });
});
