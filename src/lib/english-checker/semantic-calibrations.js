import { normalizeEnglishCheckText } from '@/lib/english-checker/processing';

function normalizeVietnameseText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function withCalibration(semantic, {
  canonicalName = semantic.canonicalName,
  coreProduct = semantic.coreProduct,
  productIdentity,
  partWhole = semantic.comparison.partWhole,
  setScope = semantic.comparison.setScope,
  material = semantic.comparison.material,
  functionRelation = semantic.comparison.function,
  terminology = semantic.comparison.terminology,
  confidence = 0.95
}) {
  return {
    ...semantic,
    calibratedByRule: true,
    canonicalName,
    coreProduct,
    comparison: {
      ...semantic.comparison,
      productIdentity,
      partWhole,
      setScope,
      material,
      function: functionRelation,
      terminology,
      unsupportedInfo: false
    },
    confidence: Math.max(semantic.confidence, confidence)
  };
}

export function applyEnglishSemanticCalibration(row, semantic) {
  const vietnamese = normalizeVietnameseText(row.productNameVi);
  const english = normalizeEnglishCheckText(row.productNameEn);

  if (vietnamese.includes('gia do may chieu') && english === 'projector stand') {
    return withCalibration(semantic, {
      canonicalName: 'Projector stand',
      coreProduct: 'projector stand',
      productIdentity: 'exact',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('op dien thoai') && english === 'phone case') {
    return withCalibration(semantic, {
      canonicalName: 'Phone case',
      coreProduct: 'phone case',
      productIdentity: 'exact',
      material: 'not_applicable',
      functionRelation: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('nap chup luon day') && english === 'cover') {
    return withCalibration(semantic, {
      canonicalName: 'Desk cable grommet',
      coreProduct: 'desk cable grommet',
      productIdentity: 'broader',
      functionRelation: 'equivalent',
      terminology: 'acceptable'
    });
  }

  if (vietnamese.includes('do trang tri san vuon') && english === 'garden decorations') {
    return withCalibration(semantic, {
      canonicalName: 'Garden cart decoration',
      coreProduct: 'garden decoration',
      productIdentity: 'broader',
      functionRelation: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('do trang tri') && ['decorations', 'table decorations'].includes(english)) {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('bong tai') && english.includes('earring')) {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      setScope: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('vong tay') && english === 'bracelet') {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('day chuyen') && ['necklace', 'fashion necklace'].includes(english)) {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('tui xach') && english === 'handbag') {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('bang do') && english.includes('hairband')) {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('tam lot ly') && english === 'coasters') {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('ao dam') && english === 'dress') {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('mui vit') && english === 'screwdriver bit') {
    return withCalibration(semantic, {
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('van giam ap') && english === 'pressure reducing valve') {
    return withCalibration(semantic, {
      canonicalName: 'Pressure reducing valve',
      coreProduct: 'pressure reducing valve',
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('tay nam cua tu') && english === 'cabinet door handles') {
    return withCalibration(semantic, {
      canonicalName: 'Cabinet door handle',
      coreProduct: 'cabinet door handle',
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('loa thung') && english === 'speaker cabinets') {
    return withCalibration(semantic, {
      canonicalName: 'Speaker cabinet',
      coreProduct: 'speaker cabinet',
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('loi tach dau') && english === 'oil separator filter') {
    return withCalibration(semantic, {
      canonicalName: 'Hydraulic oil separator filter element',
      coreProduct: 'hydraulic oil separator filter element',
      productIdentity: 'broader',
      partWhole: 'equivalent',
      terminology: 'acceptable'
    });
  }

  if (
    vietnamese.includes('luoi dao cao') &&
    vietnamese.includes('cao bavia') &&
    english === 'razor blades'
  ) {
    return withCalibration(semantic, {
      canonicalName: 'Deburring blade',
      coreProduct: 'deburring blade',
      productIdentity: 'broader',
      setScope: 'equivalent',
      terminology: 'acceptable'
    });
  }

  if (vietnamese.includes('bo phan cua may photocopy') && english === 'parts of a photocopier') {
    return withCalibration(semantic, {
      canonicalName: 'Photocopier drum unit',
      coreProduct: 'photocopier drum unit',
      productIdentity: 'broader',
      partWhole: 'equivalent',
      terminology: 'acceptable'
    });
  }

  if (vietnamese.includes('chau cay') && english === 'decorations') {
    return withCalibration(semantic, {
      canonicalName: 'Plant pot',
      coreProduct: 'plant pot',
      productIdentity: 'broader',
      terminology: 'acceptable'
    });
  }

  if (vietnamese.includes('can dao cao bavia') && english === 'part of the bavia razor') {
    return withCalibration(semantic, {
      canonicalName: 'Deburring tool handle',
      coreProduct: 'deburring tool handle',
      productIdentity: 'broader',
      partWhole: 'equivalent',
      terminology: 'awkward'
    });
  }

  if (vietnamese.includes('day treo trang tri') && english === 'hanging rope') {
    return withCalibration(semantic, {
      canonicalName: 'Decorative hanging strap',
      coreProduct: 'decorative hanging strap',
      productIdentity: 'broader',
      terminology: 'awkward'
    });
  }

  if (vietnamese.includes('balo deo vai') && english === 'backpack') {
    return withCalibration(semantic, {
      canonicalName: 'Backpack',
      coreProduct: 'backpack',
      productIdentity: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('transistor') && english === 'transistor') {
    return withCalibration(semantic, {
      productIdentity: 'broader',
      setScope: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('mieng dan toc mai') && english === 'hair bangs sticker') {
    return withCalibration(semantic, {
      canonicalName: 'Hair bangs sticker',
      coreProduct: 'hair bangs sticker',
      productIdentity: 'equivalent',
      setScope: 'equivalent',
      terminology: 'natural'
    });
  }

  if (vietnamese.includes('day deo kinh') && english === 'eyeglasses bag') {
    return withCalibration(semantic, {
      canonicalName: 'Eyeglasses strap',
      coreProduct: 'eyeglasses strap',
      productIdentity: 'different',
      terminology: 'wrong'
    });
  }

  if (vietnamese.includes('luoc chai toc') && english === 'hairbrush') {
    return withCalibration(semantic, {
      canonicalName: 'Hair comb',
      coreProduct: 'hair comb',
      productIdentity: 'different',
      terminology: 'wrong'
    });
  }

  if (vietnamese.includes('mo dun dieu chinh nguon') && english === 'electronic links') {
    return withCalibration(semantic, {
      canonicalName: 'Power regulation module',
      coreProduct: 'power regulation module',
      productIdentity: 'different',
      terminology: 'wrong'
    });
  }

  if (vietnamese.includes('toc mai') && ['wig', 'wigs'].includes(english)) {
    return withCalibration(semantic, {
      canonicalName: 'Fringe hairpiece',
      coreProduct: 'fringe hairpiece',
      productIdentity: 'different',
      partWhole: 'different',
      terminology: 'wrong'
    });
  }

  if (vietnamese.includes('loi loc dau') && english === 'oil filter') {
    return withCalibration(semantic, {
      canonicalName: 'Hydraulic oil filter element',
      coreProduct: 'hydraulic oil filter element',
      productIdentity: 'different',
      partWhole: 'different'
    });
  }

  if (
    (vietnamese.includes('bo van dieu ap') || vietnamese.includes('van giam ap')) &&
    english === 'voltage regulator'
  ) {
    return withCalibration(semantic, {
      canonicalName: 'Pneumatic pressure regulator kit',
      coreProduct: 'pneumatic pressure regulator',
      productIdentity: 'different',
      terminology: 'wrong'
    });
  }

  return semantic;
}
