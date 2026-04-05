import { STATUS_LABELS } from '@/lib/constants';

export function buildErrorExportRows(rows) {
  return rows
    .filter((row) => row.status !== 'MATCH')
    .map((row) => ({
      'HS code': row.hsCode || '',
      'Trạng thái': STATUS_LABELS[row.status] ?? row.status,
      'Dòng PDF': row.pdf?.rowNumber ?? '',
      'Dòng Excel': row.excel?.rowNumber ?? '',
      'Tên hàng PDF': row.fields.itemName.pdfValue,
      'Tên hàng Excel': row.fields.itemName.excelValue,
      'Đơn vị PDF': row.fields.unit.pdfValue,
      'Đơn vị Excel': row.fields.unit.excelValue,
      'Số lượng PDF': row.fields.quantity.pdfValue,
      'Số lượng Excel': row.fields.quantity.excelValue,
      'Ghi chú': row.reason
    }));
}
