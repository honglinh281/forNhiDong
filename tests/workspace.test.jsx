// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CheckerWorkspace from '@/components/checker-workspace';

describe('CheckerWorkspace', () => {
  it('switches between the HS Code and English-name features', async () => {
    const user = userEvent.setup();
    render(<CheckerWorkspace />);

    expect(screen.getByRole('tab', { name: 'Check HS Code' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Upload file đối chiếu' })).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Check Tiếng Anh' }));

    expect(screen.getByRole('tab', { name: 'Check Tiếng Anh' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Upload file' })).toBeVisible();
    expect(screen.getByLabelText('File Excel kiểm tra Tên TA')).toBeInTheDocument();
  });
});
