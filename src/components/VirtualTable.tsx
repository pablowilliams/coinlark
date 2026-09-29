import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { visibleRange } from '../lib/feed/filter';

export interface Column {
  readonly key: string;
  readonly label: string;
  readonly className?: string;
}

interface Props {
  readonly label: string;
  readonly columns: readonly Column[];
  readonly count: number;
  readonly rowHeight: number;
  readonly renderRow: (index: number) => ReactNode;
  /** false renders every row (the non-virtualised baseline used in benchmarks). */
  readonly virtual?: boolean;
  readonly empty?: ReactNode;
}

/**
 * Fixed-row-height virtual list with ARIA table semantics. Only the rows in view (plus overscan) exist in
 * the DOM; aria-rowcount/aria-rowindex tell assistive technology how big the full table is.
 */
export const VirtualTable = memo(function VirtualTable({
  label,
  columns,
  count,
  rowHeight,
  renderRow,
  virtual = true,
  empty,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(640);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight || 640);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Jump back to the top when the result set changes.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
    setScrollTop(0);
  }, [count]);

  const onScroll = useCallback(() => {
    if (scroller.current) setScrollTop(scroller.current.scrollTop);
  }, []);

  const { start, end } = virtual
    ? visibleRange(scrollTop, viewport, rowHeight, count)
    : { start: 0, end: count };
  const rows: ReactNode[] = [];
  for (let i = start; i < end; i++) {
    rows.push(
      <div
        key={i}
        role="row"
        aria-rowindex={i + 2}
        className="vrow"
        style={virtual ? { transform: `translateY(${i * rowHeight}px)` } : undefined}
      >
        {renderRow(i)}
      </div>,
    );
  }

  return (
    <div
      className="vtable"
      role="table"
      aria-label={label}
      aria-rowcount={count + 1}
      data-testid="feed-table"
    >
      <div role="rowgroup">
        <div role="row" aria-rowindex={1} className="vrow vhead">
          {columns.map((c) => (
            <span key={c.key} role="columnheader" className={c.className}>
              {c.label}
            </span>
          ))}
        </div>
      </div>
      {count === 0 ? (
        empty
      ) : (
        <div
          ref={scroller}
          role="rowgroup"
          className={`vscroll${virtual ? '' : ' vplain'}`}
          onScroll={virtual ? onScroll : undefined}
          tabIndex={0}
          aria-label={label}
          data-testid="feed-scroll"
        >
          <div
            className="vbody"
            role="presentation"
            style={virtual ? { height: count * rowHeight } : undefined}
          >
            {rows}
          </div>
        </div>
      )}
    </div>
  );
});
