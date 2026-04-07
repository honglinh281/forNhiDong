import { ROW_STATUS, STATUS_LABELS } from '@/lib/constants';

export function buildErrorExportRows(rows) {
  return rows
    .filter((row) => row.status !== ROW_STATUS.MATCH && row.status !== ROW_STATUS.MATCH_WITH_HS_RULE)
    .map((row) => ({
      'Trạng thái': STATUS_LABELS[row.status] ?? row.status,
      'Dòng PDF': row.pdf?.rowNumber ?? '',
      'Dòng Excel': row.excel?.rowNumber ?? '',
      'HS code PDF': row.fields.hsCode.pdfValue,
      'HS code Excel': row.fields.hsCode.excelValue,
      'Tên hàng PDF': row.fields.itemName.pdfValue,
      'Tên hàng Excel': row.fields.itemName.excelValue,
      'Đơn vị PDF': row.fields.unit.pdfValue,
      'Đơn vị Excel': row.fields.unit.excelValue,
      'Số lượng PDF': row.fields.quantity.pdfValue,
      'Số lượng Excel': row.fields.quantity.excelValue,
      'Ghi chú': row.reason
    }));
}
