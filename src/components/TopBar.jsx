import { useEffect, useId, useRef, useState } from 'react';
import { PAGE_ORDER, PAGES } from '../content.jsx';

/**
 * Top bar: wordmark on the left, hamburger menu in the top-right corner.
 *
 * The menu uses the disclosure pattern (a button that shows and hides a list
 * of links) rather than an ARIA menu, which is the recommended pattern for
 * site navigation. Escape or a click outside closes it and returns focus to
 * the button. The links are real <a href> elements, so they also work when
 * opened in a new tab.
 */
export default function TopBar({ current, onNavigate }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const firstLinkRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    firstLinkRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    };
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  function follow(e, id) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setOpen(false);
    onNavigate(id);
  }

  return (
    <header className="topbar">
      <a className="wordmark" href="/" onClick={(e) => follow(e, null)} aria-label="SEKHMET.QUEST, back to the map">
        SEKHMET.QUEST
      </a>

      <nav className="menu" ref={wrapRef} aria-label="Site">
        <button
          ref={buttonRef}
          type="button"
          className={open ? 'menu-button is-open' : 'menu-button'}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="menu-bars" aria-hidden="true"><span /><span /><span /></span>
        </button>

        <ul id={menuId} className="menu-list" hidden={!open}>
          {PAGE_ORDER.map((id, i) => (
            <li key={id}>
              <a
                ref={i === 0 ? firstLinkRef : undefined}
                href={`/${id}`}
                aria-current={current === id ? 'page' : undefined}
                onClick={(e) => follow(e, id)}
              >
                {PAGES[id].title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
