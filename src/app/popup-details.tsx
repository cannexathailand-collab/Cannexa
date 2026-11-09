'use client';

import {useEffect, useId, useRef, type CSSProperties, type ReactNode} from 'react';

type Props = {
  children: ReactNode;
  summary: ReactNode;
  title?: ReactNode;
  summaryClassName?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  open?: boolean;
  'aria-label'?: string;
};

export function PopupDetails({children, summary, title = summary, summaryClassName = '', className = '', style, id, open, 'aria-label': ariaLabel}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);

  return <div className={'popup-details ' + className} style={style} id={id} aria-label={ariaLabel}>
    <button type="button" className={'popup-details-trigger ' + summaryClassName}
      aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <span>{summary}</span><svg className="popup-trigger-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m9 5 7 7-7 7"/></svg>
    </button>
    <dialog ref={dialog} className="stock-modal popup-details-dialog" aria-labelledby={titleId}>
      <header className="popup-details-header">
        <div id={titleId} role="heading" aria-level={2}>{title}</div>
        <button type="button" className="secondary popup-close" onClick={() => dialog.current?.close()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg><span>ปิด</span></button>
      </header>
      <div className="popup-details-body">{children}</div>
    </dialog>
  </div>;
}
