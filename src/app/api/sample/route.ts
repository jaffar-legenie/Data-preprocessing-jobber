import { NextResponse } from "next/server";
import { parseCSVWithDuplicateHeaders, REQUIRED_SOURCE_COLUMNS } from "@/lib/preprocessor";
import { SAMPLE_CSV } from "@/data/sampleData";

export async function GET() {
  try {
    const csvText = SAMPLE_CSV;
    const { rows } = parseCSVWithDuplicateHeaders(csvText);
    const firstRowCols = new Set(Object.keys(rows[0] || {}));
    const missing = REQUIRED_SOURCE_COLUMNS.filter((c) => !firstRowCols.has(c));

    return NextResponse.json({
      filename: "Jobber Clients 1 of 1.csv",
      row_count: rows.length,
      columns: Object.keys(rows[0] || {}),
      missing_required_columns: missing,
      is_valid: missing.length === 0,
      raw_csv: csvText,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Failed to load sample" }, { status: 500 });
  }
}
