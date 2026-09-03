import { NextRequest, NextResponse } from "next/server";
import { preprocessJobberCSV } from "@/lib/preprocessor";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const csvText = body.csv_text;
    const defaultLanguage = body.default_language || "French";

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        { detail: "Missing or invalid csv_text in request body" },
        { status: 400 }
      );
    }

    const result = preprocessJobberCSV(csvText, defaultLanguage);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Failed to preprocess dataset" },
      { status: 500 }
    );
  }
}
