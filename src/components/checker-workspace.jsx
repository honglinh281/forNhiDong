'use client';

import { useState } from 'react';

import CustomsCheckerApp from '@/components/customs-checker-app';
import EnglishNameCheckerApp from '@/components/english-name-checker-app';

const MODES = Object.freeze({
  HS_CODE: 'hs-code',
  ENGLISH_NAME: 'english-name'
});

export default function CheckerWorkspace() {
  const [activeMode, setActiveMode] = useState(MODES.HS_CODE);

  return (
    <main className="workspace-page">
      <nav aria-label="Chọn chức năng kiểm tra" className="mode-switch" role="tablist">
        <button
          aria-controls="hs-code-panel"
          aria-selected={activeMode === MODES.HS_CODE}
          className={`mode-switch-button ${activeMode === MODES.HS_CODE ? 'is-active' : ''}`}
          id="hs-code-tab"
          onClick={() => setActiveMode(MODES.HS_CODE)}
          role="tab"
          type="button"
        >
          Check HS Code
        </button>
        <button
          aria-controls="english-name-panel"
          aria-selected={activeMode === MODES.ENGLISH_NAME}
          className={`mode-switch-button ${activeMode === MODES.ENGLISH_NAME ? 'is-active' : ''}`}
          id="english-name-tab"
          onClick={() => setActiveMode(MODES.ENGLISH_NAME)}
          role="tab"
          type="button"
        >
          Check Tiếng Anh
        </button>
      </nav>

      <div
        aria-labelledby="hs-code-tab"
        hidden={activeMode !== MODES.HS_CODE}
        id="hs-code-panel"
        role="tabpanel"
      >
        <CustomsCheckerApp embedded />
      </div>

      <div
        aria-labelledby="english-name-tab"
        hidden={activeMode !== MODES.ENGLISH_NAME}
        id="english-name-panel"
        role="tabpanel"
      >
        <EnglishNameCheckerApp />
      </div>
    </main>
  );
}
