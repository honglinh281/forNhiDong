import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';
import {
  expandEnglishCheckResults,
  prepareEnglishChecks,
  summarizeEnglishCheckResults
} from '@/lib/english-checker/processing';

describe('English checker processing', () => {
  it('applies deterministic rules, deduplicates pairs, and reuses AI results', () => {
    const rows = [
      {
        rowId: 'Sheet1:2',
        sheet: 'Sheet1',
        excelRow: 2,
        stt: '1',
        productNameVi: 'Cánh bơm',
        productNameEn: 'Water pump'
      },
      {
        rowId: 'Sheet1:3',
        sheet: 'Sheet1',
        excelRow: 3,
        stt: '2',
        productNameVi: '  CÁNH BƠM ',
        productNameEn: ' water   pump '
      },
      {
        rowId: 'Sheet1:4',
        sheet: 'Sheet1',
        excelRow: 4,
        stt: '3',
        productNameVi: null,
        productNameEn: 'Pump impeller'
      },
      {
        rowId: 'Sheet1:5',
        sheet: 'Sheet1',
        excelRow: 5,
        stt: '4',
        productNameVi: 'Giá đỡ máy chiếu',
        productNameEn: null
      }
    ];
    const prepared = prepareEnglishChecks(rows);

    expect(prepared.uniqueRows).toHaveLength(2);
    expect(prepared.deterministicResults).toHaveLength(1);

    const expanded = expandEnglishCheckResults(rows, prepared, [
      {
        rowId: 'unique-check-1',
        status: ENGLISH_CHECK_STATUS.WRONG,
        reason: 'Tên hiện tại mô tả máy hoàn chỉnh.',
        suggestedName: 'Pump impeller'
      },
      {
        rowId: 'unique-check-2',
        status: ENGLISH_CHECK_STATUS.OK,
        reason: 'AI không được giữ reason này.',
        suggestedName: 'Projector stand'
      }
    ]);

    expect(expanded[0]).toMatchObject({ status: ENGLISH_CHECK_STATUS.WRONG, suggestedName: 'Pump impeller' });
    expect(expanded[1]).toMatchObject({ status: ENGLISH_CHECK_STATUS.WRONG, suggestedName: 'Pump impeller' });
    expect(expanded[2]).toMatchObject({ status: ENGLISH_CHECK_STATUS.MISSING, suggestedName: '' });
    expect(expanded[3]).toMatchObject({
      status: ENGLISH_CHECK_STATUS.MISSING,
      reason: 'Thiếu "Tên TA".',
      suggestedName: 'Projector stand'
    });
    expect(summarizeEnglishCheckResults(expanded)).toEqual({
      total: 4,
      ok: 0,
      close: 0,
      wrong: 2,
      missing: 2
    });
  });
});
