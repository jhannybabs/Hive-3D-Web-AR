import React, { useEffect, useRef, useState } from "react";

type Keypoint = {
  name: string;
  x: number;
  y: number;
  z: number;
  score: number;
};

type Props = {
  pose: { keypoints: Keypoint[] } | null;
};

const EDGES: [number, number][] = [
  [11, 12], // shoulders
  [11, 23], // left shoulder to left hip
  [12, 24], // right shoulder to right hip
  [23, 24], // hips
  [11, 13], // left arm
  [13, 15],
  [12, 14], // right arm
  [14, 16],
];

const PoseDebugOverlay: React.FC<Props> = ({ pose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pose || !canvas || !visible) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const keypoints = pose.keypoints;

    // Draw skeleton lines
    EDGES.forEach(([i, j]) => {
      const kp1 = keypoints[i];
      const kp2 = keypoints[j];
      if (kp1 && kp2 && kp1.score >= 0.5 && kp2.score >= 0.5) {
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.strokeStyle = "lime";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    // Draw keypoints
    keypoints.forEach((kp, idx) => {
      if (kp.score >= 0.5) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "red";
        ctx.fill();

        // Show z values for shoulders
        if (idx === 11 || idx === 12) {
          ctx.fillStyle = "white";
          ctx.font = "12px Arial";
          ctx.fillText(`z:${kp.z.toFixed(2)}`, kp.x + 8, kp.y - 8);
        }
      }
    });

    // Draw chest midpoint
    const left = keypoints[11];
    const right = keypoints[12];
    if (left && right) {
      const chestX = (left.x + right.x) / 2;
      const chestY = (left.y + right.y) / 2;
      ctx.beginPath();
      ctx.arc(chestX, chestY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "cyan";
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.fillText("Chest", chestX + 8, chestY - 8);
    }
  }, [pose, visible]);

  return (
    <>
      <button
        onClick={() => setVisible(!visible)}
        className="absolute top-4 right-4 z-40 bg-black text-white px-3 py-1 rounded"
      >
        {visible ? "Hide Debug" : "Show Debug"}
      </button>

      {visible && (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none z-30"
        />
      )}
    </>
  );
};

export default PoseDebugOverlay;