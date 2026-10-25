// Placeholder until the demos are recorded. Swap the inner block for an <iframe> (YouTube/Vimeo unlisted) or <video>.
// Record real screens only. Label replay or simulated data on screen.
export default function VideoSlot({ title, length, note }) {
  return (
    <figure>
      <div className="video" role="img" aria-label={`${title} video, coming soon`}>
        <div>
          <div className="play" />
          <b>Demo coming</b>
          <small>{length}</small>
        </div>
      </div>
      <figcaption className="vcap">
        <b>{title}</b>
        <span>{note}</span>
      </figcaption>
    </figure>
  );
}
