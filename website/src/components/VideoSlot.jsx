import { asset } from "../asset.js";

// Plays a real video when `src` is given; otherwise shows the "demo coming" placeholder.
// Record real screens only. Label replay or simulated data on screen.
export default function VideoSlot({ src, poster, title, length, note }) {
  return (
    <figure>
      {src ? (
        <div className="video-player">
          <video
            src={asset(src)}
            poster={poster ? asset(poster) : undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={title}
          />
        </div>
      ) : (
        <div className="video" role="img" aria-label={`${title} video, coming soon`}>
          <div>
            <div className="play" />
            <b>Demo coming</b>
            <small>{length}</small>
          </div>
        </div>
      )}
      <figcaption className="vcap">
        <b>{title}</b>
        <span>{note}</span>
      </figcaption>
    </figure>
  );
}
