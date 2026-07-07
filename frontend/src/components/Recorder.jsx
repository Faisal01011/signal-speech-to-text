import { useRef, useState, useCallback, useEffect } from "react";

/**
 * Handles microphone capture via MediaRecorder, draws a live waveform
 * on a canvas while recording using the Web Audio API's AnalyserNode,
 * and hands the finished audio Blob back to the parent via onRecordingComplete.
 */
export default function Recorder({ onRecordingComplete, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteTimeDomainData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barCount = 64;
      const step = Math.floor(bufferLength / barCount);
      const barWidth = width / barCount;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] / 128.0 - 1.0; // -1..1
        const magnitude = Math.abs(value);
        const barHeight = Math.max(3, magnitude * height * 1.8);

        ctx.fillStyle = "#E8A33D";
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, barWidth - 2, barHeight);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      drawWaveform();

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        onRecordingComplete(blob);
        cleanup();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      console.error("Microphone access denied or unavailable:", err);
      alert("Couldn't access your microphone. Check browser permissions and try again.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const cleanup = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
  };

  useEffect(() => () => cleanup(), []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="recorder">
      <canvas ref={canvasRef} width={560} height={100} className="recorder__waveform" />

      <div className="recorder__controls">
        <button
          className={`recorder__button ${isRecording ? "recorder__button--recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
        >
          <span className="recorder__dot" />
          {isRecording ? "Stop recording" : "Start recording"}
        </button>

        {isRecording && <span className="recorder__timer">{formatTime(elapsed)}</span>}
      </div>
    </div>
  );
}
