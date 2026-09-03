import { NextRequest, NextResponse } from "next/server";
import { parseCSVWithDuplicateHeaders, REQUIRED_SOURCE_COLUMNS } from "@/lib/preprocessor";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ detail: "Only CSV files are supported." }, { status: 400 });
    }

    const csvText = await file.text();
    const { rows } = parseCSVWithDuplicateHeaders(csvText);
    const firstRowCols = new Set(Object.keys(rows[0] || {}));
    const missing = REQUIRED_SOURCE_COLUMNS.filter((c) => !firstRowCols.has(c));

    return NextResponse.json({
      filename: file.name,
      row_count: rows.length,
      columns: Object.keys(rows[0] || {}),
      missing_required_columns: missing,
      is_valid: missing.length === 0,
      raw_csv: csvText,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to parse CSV" }, { status: 400 });
  }
}
