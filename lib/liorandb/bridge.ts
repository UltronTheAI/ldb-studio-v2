/**
 * LioranDB Local Studio Bridge Architecture
 *
 * When LioranDB Studio is hosted remotely (such as https://studio.liorandb.com on Vercel),
 * the server-side environment cannot directly reach a LioranDB instance running on the
 * user's machine (e.g. 127.0.0.1:27018).
 *
 * This module defines the architecture and contracts for connecting the hosted Studio
 * to a local LioranDB instance via a local bridge or CLI process.
 */

export interface LocalBridgeSpecification {
  readonly protocolVersion: string;
  readonly defaultPort: number;
  readonly supportsTls: boolean;
  readonly description: string;
}

export interface LocalBridgeMethod {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly command?: string;
}

export interface LocalBridgeConnectionInstructions {
  readonly title: string;
  readonly reason: string;
  readonly methods: readonly LocalBridgeMethod[];
}

export const LOCAL_BRIDGE_SPEC: LocalBridgeSpecification = {
  protocolVersion: "1.0.0",
  defaultPort: 27018,
  supportsTls: false,
  description:
    "Local Studio Bridge forwarding requests between hosted browser studio and local LioranDB daemon.",
};

export function getLocalBridgeInstructions(
  host: string = "127.0.0.1",
  port: number = 27018,
): LocalBridgeConnectionInstructions {
  return {
    title: "Local Database Detected",
    reason: `LioranDB Studio is running in a hosted environment and cannot directly reach ${host}:${port} on your machine.`,
    methods: [
      {
        id: "cli",
        name: "Run Studio Locally via LioranDB CLI",
        description:
          "Launch Studio locally on your computer where it has direct access to your local LioranDB instance.",
        command: "liorandb studio",
      },
      {
        id: "npm-local",
        name: "Run Studio Locally from Source",
        description:
          "Run the Studio web console on your local machine.",
        command: "npm run dev",
      },
      {
        id: "tunnel",
        name: "Secure Tunnel / Remote Endpoint",
        description:
          "Expose your local LioranDB instance via an authenticated TLS tunnel or domain endpoint.",
        command: "ngrok http 27018",
      },
    ],
  };
}
