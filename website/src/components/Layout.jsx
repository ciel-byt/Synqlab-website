import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { nav } from "../content.js";
import { Icon } from "./icons.jsx";

// New page: scroll to the top. A link with #section: scroll to that section.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Dropdown({ item }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const active = item.children.some((c) => pathname === c.to.split("?")[0] || pathname.startsWith(c.to.split("?")[0] + "/"));
  return (
    <div className="dd" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className={`link dd-btn${active ? " active" : ""}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        {item.label}
        <svg className={`chev${open ? " up" : ""}`} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="dd-menu" role="menu">
          {item.children.map((c) => (
            <Link key={c.to} to={c.to} role="menuitem" className="dd-item">
              <span className="dd-icon"><Icon name={c.icon} size={17} /></span>
              <span className="dd-text"><b>{c.label}</b><small>{c.note}</small></span>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="nav">
      <div className="wrap nav-in">
        <Link to="/" className="logo" aria-label="SynqLab home">
          Synq<i>Lab</i>
        </Link>
        <nav className={`nav-links${open ? " open" : ""}`} aria-label="Main">
          {nav.map((n) => n.children ? <Dropdown key={n.to} item={n} /> : (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `link${isActive ? " active" : ""}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-right">
          <a href="/login" className="link nav-signin">
            Sign in
          </a>
          <Link to="/book-a-call" className="btn">
            Book a call
          </Link>
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
            Menu
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Link to="/" className="logo">
              Synq<i>Lab</i>
            </Link>
            <p style={{ color: "var(--mute)", marginTop: 12, maxWidth: "20rem" }}>
              An AI lab for biology.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <Link to="/platform">SynqLab</Link>
            <Link to="/aria">Aria</Link>
            <Link to="/lyra">Lyra</Link>
          </div>
          <div>
            <h4>Research</h4>
            <Link to="/research">Papers</Link>
            <Link to="/research?tab=blog">Blog</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/company">About us</Link>
            <Link to="/company#team">Our team</Link>
          </div>
        </div>
        <div className="fbottom">
          <span>© 2026 SynqLab</span>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
