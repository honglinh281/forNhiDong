import { ENGLISH_CHECK_STATUS } from '@/lib/english-checker/constants';

export const ENGLISH_CHECK_FEW_SHOT_EXAMPLES = Object.freeze([
  {
    productNameVi: 'Bộ khóa cửa, gồm tay nắm và ổ khóa',
    productNameEn: 'Door handle set',
    canonicalName: 'Door lock set',
    expectedComparison: { productIdentity: 'different', setScope: 'different' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Tay nắm chỉ là một thành phần, không phải bộ khóa cửa hoàn chỉnh.'
  },
  {
    productNameVi: 'Mô-đun transistor IGBT dùng cho biến tần',
    productNameEn: 'Module',
    canonicalName: 'IGBT transistor module',
    expectedComparison: { productIdentity: 'broader', terminology: 'acceptable' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Cùng lớp sản phẩm nhưng thiếu subtype IGBT transistor.'
  },
  {
    productNameVi: 'Đồ trang trí để bàn: hình ván trượt',
    productNameEn: 'Table decorations',
    canonicalName: 'Skateboard-shaped table decoration',
    expectedComparison: {
      productIdentity: 'broader',
      terminology: 'acceptable',
      missingCriticalDetails: ['skateboard shape']
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Tên decorations quá rộng vì bỏ mất hình dạng ván trượt dùng để phân biệt mặt hàng.'
  },
  {
    productNameVi: 'Vỏ bảo vệ đầu nối, bộ phận của đầu nối dây điện công nghiệp',
    productNameEn: 'Connector housing',
    canonicalName: 'Connector protective cover',
    expectedComparison: {
      productIdentity: 'broader',
      terminology: 'awkward',
      missingCriticalDetails: ['protective cover']
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Housing chưa thể hiện đúng chi tiết vỏ bảo vệ của đầu nối.'
  },
  {
    productNameVi: 'Bộ phận chuyên dùng cho van điện từ: màng van khí nén',
    productNameEn: 'Parts of a pneumatic valve',
    canonicalName: 'Pneumatic valve diaphragm',
    expectedComparison: {
      productIdentity: 'broader',
      missingCriticalDetails: ['pneumatic valve diaphragm']
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Tên hiện tại chỉ nêu lớp bộ phận và bỏ mất chi tiết cụ thể là màng van.'
  },
  {
    productNameVi: 'Thiết bị hỗ trợ dán kính cường lực điện thoại, dùng định vị và căn chỉnh, hoạt động bằng pin',
    productNameEn: 'Fixture for supporting tempered glass screen protector application',
    canonicalName: 'Phone screen protector alignment device',
    expectedComparison: {
      productIdentity: 'broader',
      terminology: 'awkward',
      missingCriticalDetails: ['positioning and alignment device']
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Fixture chưa diễn đạt sát thiết bị định vị và căn chỉnh khi dán màn hình.'
  },
  {
    productNameVi: 'Miếng dán cường lực bảo vệ màn hình điện thoại, chất liệu bằng nhựa TPU',
    productNameEn: 'Tempered glass screen protector for phone',
    canonicalName: 'Phone screen protector',
    expectedComparison: {
      productIdentity: 'different',
      material: 'different',
      terminology: 'wrong',
      mistranslatedDetails: ['TPU plastic translated as tempered glass']
    },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Tên tiếng Anh khẳng định vật liệu kính trong khi mô tả nêu rõ nhựa TPU.'
  },
  {
    productNameVi: 'Đầu bơm lốp dùng ghép nối với dây hơi',
    productNameEn: 'Tire inflation valve clamp',
    canonicalName: 'Tire inflator chuck',
    expectedComparison: { productIdentity: 'different', terminology: 'wrong' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Clamp là một loại chi tiết khác với tire inflator chuck.'
  },
  {
    productNameVi: 'Dụng cụ cầm tay: thanh nạy lốp',
    productNameEn: 'Tire removal tool',
    canonicalName: 'Tire lever',
    expectedComparison: { productIdentity: 'broader', terminology: 'acceptable' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Tên theo công dụng hiểu được nhưng rộng hơn tên dụng cụ cụ thể.'
  },
  {
    productNameVi: 'Máy ảnh kỹ thuật số loại chụp lấy ảnh ngay',
    productNameEn: 'Digital camera',
    canonicalName: 'Instant digital camera',
    expectedComparison: { productIdentity: 'broader', terminology: 'natural' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Digital camera đúng lớp sản phẩm nhưng thiếu subtype chụp lấy ảnh ngay.'
  },
  {
    productNameVi: 'Dây đeo kính bằng vải, có đầu kẹp',
    productNameEn: 'Eyeglasses bag',
    canonicalName: 'Eyeglasses strap',
    expectedComparison: { productIdentity: 'different', terminology: 'wrong' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Bag và strap là hai loại sản phẩm khác nhau.'
  },
  {
    productNameVi: 'Bộ nguồn chuyển mạch AC-DC cấp nguồn nội bộ cho máy kiểm tra bản mạch, vỏ hợp kim nhôm, đầu ra 72VDC/6.7A, 480W',
    productNameEn: 'AC-DC switching power supply for internal power supply of electronic circuit board testing machine, aluminum alloy casing, output 72VDC/6.7A, power 480W',
    canonicalName: 'AC-DC switching power supply',
    expectedComparison: { productIdentity: 'equivalent', terminology: 'natural', unsupportedInfo: false },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Tên dài hơn canonical nhưng mọi thông tin thêm đều được tiếng Việt hỗ trợ.'
  },
  {
    productNameVi: 'Dây cáp âm thanh quang kỹ thuật số',
    productNameEn: 'Audio cable',
    canonicalName: 'Optical audio cable',
    expectedComparison: { productIdentity: 'broader', terminology: 'natural' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Audio cable đúng họ sản phẩm nhưng thiếu đặc tính quang kỹ thuật số.'
  },
  {
    productNameVi: 'Công tắc áp suất dùng đóng ngắt khí nén',
    productNameEn: 'Pressure switch',
    canonicalName: 'Pressure switch',
    expectedComparison: { productIdentity: 'exact', function: 'equivalent' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Tên thương mại trùng chính xác; chi tiết công dụng không bắt buộc trong tên.'
  },
  {
    productNameVi: 'Bo mạch phát triển ESP32-S3 dùng điều khiển động cơ',
    productNameEn: 'Circuit board',
    canonicalName: 'ESP32-S3 development board',
    expectedComparison: { productIdentity: 'broader', terminology: 'acceptable' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Circuit board là lớp rộng hơn, không phải một sản phẩm hoàn toàn khác.'
  },
  {
    productNameVi: 'Lõi lọc dầu thủy lực, bộ phận của thiết bị lọc dầu',
    productNameEn: 'Oil filter',
    canonicalName: 'Hydraulic oil filter element',
    expectedComparison: { productIdentity: 'different', partWhole: 'different' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Lõi lọc là bộ phận, còn oil filter chỉ sản phẩm lọc hoàn chỉnh.'
  },
  {
    productNameVi: 'Lược chải tóc cầm tay bằng nhựa',
    productNameEn: 'Hairbrush',
    canonicalName: 'Hair comb',
    expectedComparison: { productIdentity: 'different', terminology: 'wrong' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Comb và brush là hai loại sản phẩm khác nhau.'
  },
  {
    productNameVi: 'Máy kiểm tra dung lượng pin dùng đo điện áp và dung lượng pin',
    productNameEn: 'Battery capacity tester',
    canonicalName: 'Battery capacity tester',
    expectedComparison: { productIdentity: 'exact', function: 'equivalent' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Tên hiện tại trùng tên thương mại cốt lõi.'
  },
  {
    productNameVi: 'Bộ chuyển đổi nguồn DC/DC dùng cho bảng mạch tivi, bằng PCB và đồng, 300V/4mA, 6W',
    productNameEn: 'DC/DC power converter for TV electronic circuit boards, made of PCB plastic and copper, voltage 300V/4mA, power 6W',
    canonicalName: 'DC-DC power converter',
    expectedComparison: { productIdentity: 'equivalent', unsupportedInfo: false },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Slash/hyphen và phần mô tả dài được hỗ trợ không làm thay đổi sản phẩm.'
  },
  {
    productNameVi: 'Bộ van điều áp khí nén kèm đồng hồ đo áp suất và giá đỡ',
    productNameEn: 'Voltage regulator',
    canonicalName: 'Pneumatic pressure regulator kit',
    expectedComparison: { productIdentity: 'different', terminology: 'wrong' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.WRONG,
    explanation: 'Voltage regulator là thiết bị điện, khác với van điều áp khí nén.'
  },
  {
    productNameVi: 'Giá đỡ máy chiếu loại một chân, điều chỉnh độ cao và xoay được',
    productNameEn: 'Projector stand',
    canonicalName: 'Projector stand',
    expectedComparison: { productIdentity: 'exact', terminology: 'natural' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.OK,
    explanation: 'Kiểu một chân và khả năng điều chỉnh là chi tiết tùy chọn, không đổi loại giá đỡ.'
  },
  {
    productNameVi: 'Đồ trang trí: hình cái đĩa, dùng trong khách sạn, bằng gỗ',
    productNameEn: 'Decorations',
    canonicalName: 'Decorative plate',
    expectedComparison: { productIdentity: 'broader', terminology: 'acceptable' },
    expectedFinalStatus: ENGLISH_CHECK_STATUS.CLOSE,
    explanation: 'Decorations đúng nhóm nhưng thiếu hình dạng cái đĩa dùng để định danh mặt hàng.'
  }
]);

export function serializeProductFactExamples() {
  return JSON.stringify(
    ENGLISH_CHECK_FEW_SHOT_EXAMPLES.map(({ productNameVi, canonicalName }) => ({
      productNameVi,
      canonicalName
    })),
    null,
    2
  );
}

export function serializeComparisonExamples() {
  return JSON.stringify(
    ENGLISH_CHECK_FEW_SHOT_EXAMPLES.map(
      ({ productNameVi, productNameEn, canonicalName, expectedFinalStatus, explanation }) => ({
        productNameVi,
        currentEnglish: productNameEn,
        canonicalName,
        expectedFinalStatus,
        explanation
      })
    ),
    null,
    2
  );
}
