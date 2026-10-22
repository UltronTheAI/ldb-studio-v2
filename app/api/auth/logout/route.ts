import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, destroyStudioSession } from "@/lib/liorandb/session";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    await destroyStudioSession();
  } catch {
    // Ignore
  }

  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {
    // Ignore
  }

  const response = NextResponse.redirect(new URL("/", url.origin));
  response.cookies.set(COOKIE_NAME, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
  });

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
