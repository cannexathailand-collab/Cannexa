'use client';

import {useEffect, useId, useRef, type CSSProperties, type ReactNode} from 'react';

type Props = {
  children: ReactNode;
  summary: ReactNode;
  summaryClassName?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  open?: boolean;
  'aria-label'?: string;
};

export function PopupDetails({children, summary, summaryClassName = '', className = '', style, id, open, 'aria-label': ariaLabel}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const title = summary;

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  return <div className={'popup-details ' + className} style={style} id={id} aria-label={ariaLabel}>
    <button type="button" className={'popup-details-trigger ' + summaryClassName}
      aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <span>{title}</span><span aria-hidden="true">↗</span>
    </button>
    <dialog ref={dialog} className="stock-modal popup-details-dialog" aria-labelledby={titleId}>
      <header className="popup-details-header">
        <div id={titleId} role="heading" aria-level={2}>{title}</div>
        <button type="button" className="secondary" onClick={() => dialog.current?.close()}>ปิด</button>
      </header>
      <div className="popup-details-body">{children}</div>
    </dialog>
  </div>;
}
