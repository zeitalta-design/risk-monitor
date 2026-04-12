// middleware.js - 一時的に完全無効化
import { NextResponse } from "next/server";

export default function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
