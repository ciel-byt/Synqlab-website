import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="hero">
      <div className="wrap">
        <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>Page not found.</h1>
        <p className="lead" style={{ margin: "20px 0 28px" }}>That page does not exist.</p>
        <Link to="/" className="btn">Back to home</Link>
      </div>
    </section>
  );
}
