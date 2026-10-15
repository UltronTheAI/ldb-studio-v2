import { ImageResponse } from "next/og";

export const alt = "LioranDB Studio — Developer Control Plane";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px 48px 72px",
          backgroundColor: "#ffffff",
          backgroundImage:
            "radial-gradient(circle at 85% 15%, #cfe7ff 0%, rgba(207, 231, 255, 0.4) 35%, rgba(255, 255, 255, 0) 70%), radial-gradient(circle at 10% 90%, #f0f7ff 0%, rgba(255, 255, 255, 0) 50%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Top Header Row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          {/* Brand Logo & Name */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                backgroundColor: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7l8-4 8 4M4 12l8 4 8-4M4 17l8 4 8-4" />
              </svg>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  color: "#171717",
                  letterSpacing: "-0.8px",
                }}
              >
                LioranDB
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: 500,
                  color: "#60646c",
                  letterSpacing: "-0.3px",
                }}
              >
                Studio
              </span>
            </div>
          </div>

          {/* Badge Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              backgroundColor: "#f0f0f3",
              border: "1px solid #dcdee0",
              borderRadius: "9999px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "9999px",
                backgroundColor: "#16a34a",
              }}
            />
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#171717",
                letterSpacing: "0.88px",
                textTransform: "uppercase",
              }}
            >
              Developer Control Plane
            </span>
          </div>
        </div>

        {/* Center Hero Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            maxWidth: "980px",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#171717",
              lineHeight: 1.1,
              letterSpacing: "-1.8px",
            }}
          >
            Meet your database thinking partner.
          </div>
          <div
            style={{
              fontSize: "23px",
              fontWeight: 400,
              color: "#60646c",
              lineHeight: 1.45,
              letterSpacing: "-0.3px",
              maxWidth: "840px",
            }}
          >
            A quietly confident console for LioranDB. Browse collections, evaluate live queries, configure granular RBAC security, and inspect Raft cluster topologies.
          </div>
        </div>

        {/* Bottom Feature Cards Strip */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            width: "100%",
            marginTop: "20px",
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "20px 22px",
              backgroundColor: "#ffffff",
              border: "1px solid #dcdee0",
              borderRadius: "14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "#f0f0f3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0d74ce"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </div>
              <span style={{ fontSize: "16px", fontWeight: 600, color: "#171717" }}>
                Query Workbench
              </span>
            </div>
            <span style={{ fontSize: "14px", color: "#60646c", lineHeight: 1.35 }}>
              Schema-agnostic documents & gRPC execution
            </span>
          </div>

          {/* Card 2 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "20px 22px",
              backgroundColor: "#ffffff",
              border: "1px solid #dcdee0",
              borderRadius: "14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "#f0f0f3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0d74ce"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="6" height="6" rx="1" />
                  <rect x="16" y="2" width="6" height="6" rx="1" />
                  <rect x="9" y="16" width="6" height="6" rx="1" />
                  <path d="M5 8v3a2 2 0 002 2h10a2 2 0 002-2V8" />
                  <line x1="12" y1="13" x2="12" y2="16" />
                </svg>
              </div>
              <span style={{ fontSize: "16px", fontWeight: 600, color: "#171717" }}>
                Raft Mesh
              </span>
            </div>
            <span style={{ fontSize: "14px", color: "#60646c", lineHeight: 1.35 }}>
              Distributed consensus & cluster topology
            </span>
          </div>

          {/* Card 3 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "20px 22px",
              backgroundColor: "#ffffff",
              border: "1px solid #dcdee0",
              borderRadius: "14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: "#f0f0f3",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0d74ce"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span style={{ fontSize: "16px", fontWeight: 600, color: "#171717" }}>
                User Governance
              </span>
            </div>
            <span style={{ fontSize: "14px", color: "#60646c", lineHeight: 1.35 }}>
              Granular role-based access & audit security
            </span>
          </div>
        </div>

        {/* Signature Accent Hairline at bottom edge */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(90deg, #0d74ce 0%, #476cff 50%, #47c2ff 100%)",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
