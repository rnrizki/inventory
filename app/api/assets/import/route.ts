import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

// Helper to parse standard CSV text (handles quotes, commas, newlines)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { csvText, simulate = false } = body;

    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ success: false, error: 'CSV data is required' }, { status: 400 });
    }

    const rawRows = parseCSV(csvText);
    if (rawRows.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV file must contain a header row and at least one data row.' },
        { status: 400 }
      );
    }

    // Normalize header names
    const headers = rawRows[0].map((h) =>
      h.toLowerCase().replace(/[\s*_]+/g, '_').replace(/[^a-z0-9_]/g, '')
    );

    const validatedRows: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let r = 1; r < rawRows.length; r++) {
      const rowData: Record<string, string> = {};
      const row = rawRows[r];

      headers.forEach((h, idx) => {
        rowData[h] = row[idx] !== undefined ? row[idx] : '';
      });

      const assetName = rowData.asset_name || rowData.name || '';
      const errors: string[] = [];

      if (!assetName) {
        errors.push('Asset name is required');
      }

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      validatedRows.push({
        rowNumber: r,
        isValid,
        errors,
        data: {
          asset_name: assetName,
          asset_description: rowData.asset_description || rowData.description || '',
          serial_number: rowData.serial_number || rowData.serial || '',
          model_number: rowData.model_number || rowData.model || rowData.specification || '',
          purchase_cost: Number(rowData.purchase_cost || rowData.cost) || 0,
          purchase_date: rowData.purchase_date || rowData.date || new Date().toISOString().split('T')[0],
          supplier_name: rowData.supplier_name || rowData.supplier || 'PT. Angan Kreasi Semesta',
          supplier_phone: rowData.supplier_phone || rowData.supplier_phone_number || '',
          supplier_address: rowData.supplier_address || '',
          category_name: rowData.category_name || rowData.category || '',
          location_name: rowData.location_name || rowData.location || '',
          category_id: rowData.category_id ? Number(rowData.category_id) : null,
          location_id: rowData.location_id ? Number(rowData.location_id) : null,
          assigned_to: rowData.assigned_to || rowData.asset_manager || '',
          warranty_period_month: Number(rowData.warranty_period_month || rowData.warranty) || 0,
          depreciation_months: Number(rowData.depreciation_months) || 0,
          depreciation_percentage: rowData.depreciation_percentage || '',
          residual_value: rowData.residual_value || '',
          depreciation_method:
            rowData.depreciation_method === 'straight_line' ? 'straight_line' : 'reducing_balance',
        },
      });
    }

    // If simulation, return validation results without DB modifications
    if (simulate) {
      return NextResponse.json({
        success: true,
        simulated: true,
        validCount,
        invalidCount,
        totalRows: validatedRows.length,
        rows: validatedRows,
      });
    }

    // Actual Import: execute in transaction
    const importedIds: number[] = [];

    await db.withTransaction(async (client) => {
      for (const item of validatedRows) {
        if (!item.isValid) continue;
        const d = item.data;

        // Resolve Category
        let finalCatId = d.category_id;
        if (!finalCatId && d.category_name) {
          const catRes = await client.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [d.category_name]);
          if (catRes.rows.length > 0) {
            finalCatId = catRes.rows[0].id;
          } else {
            const insCat = await client.query(
              'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
              [d.category_name]
            );
            finalCatId = insCat.rows[0].id;
          }
        }

        // Resolve Location
        let finalLocId = d.location_id;
        if (!finalLocId && d.location_name) {
          const locRes = await client.query('SELECT id FROM locations WHERE LOWER(name) = LOWER($1)', [d.location_name]);
          if (locRes.rows.length > 0) {
            finalLocId = locRes.rows[0].id;
          } else {
            const insLoc = await client.query(
              'INSERT INTO locations (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
              [d.location_name]
            );
            finalLocId = insLoc.rows[0].id;
          }
        }

        // Status: 2 (Allocated) if assigned_to is present, otherwise 1 (Available)
        const finalStatus = d.assigned_to ? 2 : 1;

        const assetRes = await client.query(`
          INSERT INTO assets (
            asset_name, asset_description, serial_number, model_number,
            purchase_cost, purchase_date, supplier_name, supplier_phone,
            supplier_address, category_id, location_id, asset_status, assigned_to,
            warranty_period_month, depreciation_months, depreciation_percentage,
            residual_value, depreciation_method
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING id;
        `, [
          d.asset_name,
          d.asset_description,
          d.serial_number,
          d.model_number,
          d.purchase_cost,
          d.purchase_date,
          d.supplier_name,
          d.supplier_phone,
          d.supplier_address,
          finalCatId,
          finalLocId,
          finalStatus,
          d.assigned_to,
          d.warranty_period_month,
          d.depreciation_months,
          d.depreciation_percentage,
          d.residual_value,
          d.depreciation_method
        ]);

        const newId = assetRes.rows[0].id;
        importedIds.push(newId);

        await client.query(`INSERT INTO asset_events (asset_id, event_type, notes) VALUES ($1, 'Bulk CSV Imported', 'Registered via CSV bulk import')`, [newId]);
        await client.query(`INSERT INTO asset_history (asset_id, action, note) VALUES ($1, 'Created', 'Bulk imported from CSV')`, [newId]);
      }
    });

    return NextResponse.json({
      success: true,
      importedCount: importedIds.length,
      importedIds,
      message: `Successfully imported ${importedIds.length} assets.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
