import { useState, useRef } from "react";
import { getAudioUrlFromRef } from "../utils/audioUrl";

interface VerseAudioProps {
  reference: string;
  verseText?: string;
}

export default function VerseAudio({ reference, verseText }: VerseAudioProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<"v1" | "v2">("v2"); // v1=여성, v2=남성
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = getAudioUrlFromRef(reference, voice);

  const stopCurrent = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    setPlaying(false);
  };

  const handlePlay = () => {
    if (!audioUrl) return;

    if (playing) {
      stopCurrent();
      return;
    }

    setLoading(true);
    stopCurrent();

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); audioRef.current = null; };
    audio.onerror = () => { setLoading(false); setPlaying(false); audioRef.current = null; };

    audio.play().then(() => {
      setPlaying(true);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  };

  const handleVoiceToggle = () => {
    const newVoice = voice === "v1" ? "v2" : "v1";
    stopCurrent();
    setVoice(newVoice);
  };

  if (!audioUrl) {
    return (
      <div style={styles.container}>
        <div style={styles.ref}>{reference}</div>
        {verseText && <div style={styles.text}>"{verseText}"</div>}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        <button onClick={handlePlay} style={styles.playButton}>
          {loading ? "⟳" : playing ? "⏸" : "▶"}
        </button>
        <div style={styles.info}>
          <div style={styles.refRow}>
            <span style={styles.ref}>{reference}</span>
            <button onClick={handleVoiceToggle} style={styles.voiceToggle}>
              {voice === "v2" ? "👨" : "👩"}
              <span style={styles.voiceLabel}>{voice === "v2" ? "남" : "여"}</span>
            </button>
          </div>
          {verseText && <div style={styles.text}>"{verseText}"</div>}
        </div>
      </div>
      {playing && (
        <div style={styles.playingBar}>
          <div style={styles.playingDot} />
          <span style={styles.playingText}>재생 중 ({voice === "v2" ? "남성" : "여성"})</span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "14px 16px",
    backgroundColor: "#F0FDFA",
    borderRadius: "12px",
    borderLeft: "3px solid #0D9488",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
  },
  playButton: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0D9488, #10B981)",
    color: "#FFFFFF",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  info: { flex: 1 },
  refRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  ref: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#0D9488",
  },
  voiceToggle: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "100px",
    backgroundColor: "#E0F2FE",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
  },
  voiceLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#0369A1",
  },
  text: {
    fontSize: "14px",
    color: "#115E59",
    fontStyle: "italic",
    lineHeight: "1.6",
  },
  playingBar: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid rgba(13,148,136,0.15)",
  },
  playingDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#0D9488",
  },
  playingText: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#0D9488",
  },
};
