import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Input paths
const TALENT_REGISTRY_PATH = 'C:\\Users\\SzabolcsFulop\\Downloads\\Talent Program Registry.xlsx';
const OUTPUT_DIR = path.join(__dirname, '../docs/existing-assets');

function convert() {
  if (!fs.existsSync(TALENT_REGISTRY_PATH)) {
    console.error(`Cannot find file at ${TALENT_REGISTRY_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const workbook = xlsx.readFile(TALENT_REGISTRY_PATH);

  const sheetsToExtract = [
    { name: 'IMD Appeal Top 30', output: 'countries.csv', expectedRows: 30 },
    { name: 'Government Source Registry', output: 'programs_and_sources.csv', expectedRows: 85 },
    { name: 'Residency News Sources', output: 'news_sources.csv', expectedRows: 10 },
  ];

  for (const sheetDef of sheetsToExtract) {
    const sheet = workbook.Sheets[sheetDef.name];
    if (!sheet) {
      console.warn(`Sheet "${sheetDef.name}" not found in ${TALENT_REGISTRY_PATH}`);
      continue;
    }

    type CellValue = string | number | boolean | null | undefined;
    let rows: CellValue[][] = xlsx.utils.sheet_to_json<CellValue[]>(sheet, { header: 1 });

    // 1. Remove trailing empty rows
    while (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      if (
        !lastRow ||
        lastRow.every((cell) => cell === undefined || cell === null || String(cell).trim() === '')
      ) {
        rows.pop();
      } else {
        break;
      }
    }

    // 2. Remove trailing empty columns
    let maxColIndex = 0;
    for (const row of rows) {
      for (let i = row.length - 1; i >= 0; i--) {
        if (row[i] !== undefined && row[i] !== null && String(row[i]).trim() !== '') {
          if (i > maxColIndex) maxColIndex = i;
          break;
        }
      }
    }

    rows = rows.map((row) => row.slice(0, maxColIndex + 1));

    // 3. Assert rows
    const dataRows = rows.length - 1; // Excluding header
    if (dataRows !== sheetDef.expectedRows) {
      throw new Error(
        `Expected ${sheetDef.expectedRows} data rows for ${sheetDef.name}, but found ${dataRows}`
      );
    }

    // 4. Convert back to CSV, normalize to LF-only, strip trailing blank lines
    const newSheet = xlsx.utils.aoa_to_sheet(rows);
    const rawCsv = xlsx.utils.sheet_to_csv(newSheet).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const csvLines = rawCsv.split('\n');
    while (csvLines.length > 0 && /^[,\s]*$/.test(csvLines[csvLines.length - 1])) {
      csvLines.pop();
    }
    const csvContent = csvLines.join('\n');

    const outputPath = path.join(OUTPUT_DIR, sheetDef.output);
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log(`Wrote ${outputPath}`);
  }
}

convert();
