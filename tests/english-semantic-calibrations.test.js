import { applyEnglishSemanticCalibration } from '@/lib/english-checker/semantic-calibrations';

function createSemantic() {
  return {
    rowId: 'row-1',
    canonicalName: 'Model output',
    coreProduct: 'model output',
    productClass: 'product',
    specificSubtype: null,
    partWholeScope: 'not_applicable',
    setScope: 'single',
    criticalQualifiers: [],
    optionalQualifiers: [],
    comparison: {
      productIdentity: 'equivalent',
      partWhole: 'not_applicable',
      setScope: 'not_applicable',
      material: 'not_applicable',
      function: 'not_applicable',
      terminology: 'natural',
      unsupportedInfo: false
    },
    confidence: 0.8
  };
}

describe('measured semantic calibrations', () => {
  it.each([
    ['Giá đỡ máy chiếu, loại một chân', 'Projector stand', 'Projector stand', 'exact'],
    ['Ốp điện thoại có từ tính bằng nhựa acrylic', 'PHONE CASE', 'Phone case', 'exact'],
    ['Nắp chụp luồn dây điện dùng ở bàn làm việc', 'COVER', 'Desk cable grommet', 'broader'],
    ['Đồ trang trí sân vườn hình xe đẩy', 'GARDEN DECORATIONS', 'Garden cart decoration', 'broader'],
    ['Đồ trang trí: hình cái đĩa', 'Decorations', 'Model output', 'equivalent'],
    ['Dây đeo kính bằng vải', 'Eyeglasses bag', 'Eyeglasses strap', 'different'],
    ['Lược chải tóc cầm tay', 'Hairbrush', 'Hair comb', 'different'],
    ['Mô đun điều chỉnh nguồn 24V sang 20mA', 'Electronic links', 'Power regulation module', 'different'],
    ['Tóc mái nhân tạo, không phải bộ tóc giả', 'WIGS', 'Fringe hairpiece', 'different'],
    ['Lõi lọc dầu thủy lực, bộ phận thiết bị lọc', 'oil filter', 'Hydraulic oil filter element', 'different'],
    ['Bộ van điều áp khí nén kèm đồng hồ', 'VOLTAGE REGULATOR', 'Pneumatic pressure regulator kit', 'different'],
    ['Bông tai cho nữ bằng thép', 'EARRINGS FOR WOMEN', 'Model output', 'equivalent'],
    ['Vòng tay cho nữ bằng thép', 'Bracelet', 'Model output', 'equivalent'],
    ['Dây chuyền thời trang cho nam', 'Fashion necklace', 'Model output', 'equivalent'],
    ['Túi xách tay cho nữ bằng vải', 'Handbag', 'Model output', 'equivalent'],
    ['Băng đô cho nữ bằng nhựa', 'Hairbands for women', 'Model output', 'equivalent'],
    ['Tấm lót ly bằng nhựa PVC', 'Coasters', 'Model output', 'equivalent'],
    ['Áo đầm dài cho nữ', 'dress', 'Model output', 'equivalent'],
    ['Mũi vít bằng thép S2', 'screwdriver bit', 'Model output', 'equivalent'],
    ['Van giảm áp khí nén', 'PRESSURE REDUCING VALVE', 'Pressure reducing valve', 'equivalent'],
    ['Tay nắm cửa tủ dạng thanh', 'CABINET DOOR HANDLES', 'Cabinet door handle', 'equivalent'],
    ['Loa thùng đã lắp loa vào vỏ', 'Speaker cabinets', 'Speaker cabinet', 'equivalent'],
    ['Lõi tách dầu thủy lực', 'OIL SEPARATOR FILTER', 'Hydraulic oil separator filter element', 'broader'],
    ['Lưỡi dao cạo bavia bằng thép', 'RAZOR BLADES', 'Deburring blade', 'broader'],
    ['Bộ phận của máy photocopy: cụm trống', 'PARTS OF A PHOTOCOPIER', 'Photocopier drum unit', 'broader'],
    ['Chậu cây dùng trồng cây trang trí', 'DECORATIONS', 'Plant pot', 'broader'],
    ['Cán dao cạo bavia cầm tay', 'PART OF THE BAVIA RAZOR', 'Deburring tool handle', 'broader'],
    ['Dây treo trang trí cho điện thoại', 'hanging rope', 'Decorative hanging strap', 'broader'],
    ['Balo đeo vai cho nữ', 'Backpack', 'Backpack', 'equivalent'],
    ['Transistor lưỡng cực NPN 2c/set', 'TRANSISTOR', 'Model output', 'broader'],
    ['Miếng dán tóc mái 2 miếng/set', 'Hair bangs sticker', 'Hair bangs sticker', 'equivalent']
  ])('stabilizes %s / %s', (productNameVi, productNameEn, canonicalName, productIdentity) => {
    const result = applyEnglishSemanticCalibration(
      { productNameVi, productNameEn },
      createSemantic()
    );

    expect(result).toMatchObject({
      canonicalName,
      comparison: { productIdentity },
      confidence: 0.95
    });
  });
});
