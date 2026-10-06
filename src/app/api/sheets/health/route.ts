import { NextResponse } from "next/server";
import { testSheetsConnection } from "@/lib/sheets/repository";

export async function GET() {
  const result = await testSheetsConnection();

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}
