import React, { useRef, useEffect, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { MIN_VALID_KEYPOINTS } from "../lib/constants/pose.constant";
import { GARMENT_MODELS } from "../lib/utils/garmentSwitcher.util";
import ARScene from "../components/ARScene";

type Keypoint = {
  name: string;
  x: number;
  y: number;
  z: number;
  score: number;
};

type PoseData = {
  keypoints: Keypoint[];
  average_depth_cm?: number;
  center_x_m?: number;
  center_y_m?: number;
  scale_factor?: number;
  reference?: string;
};

// 🧭 Map scale factor to shirt sizes
function mapScaleToSize(scaleFactor: number) {
  if (scaleFactor < 0.9) return 'S (21.5" x 29")';
  if (scaleFactor < 1.0) return 'M (22.5" x 30")';
  if (scaleFactor < 1.1) return 'L (23.5" x 31")';
  if (scaleFactor < 1.2) return 'XL (24.5" x 32")';
  if (scaleFactor < 1.3) return '2XL (25.5" x 33")';
  return '3XL (26.5" x 34")';
}

const Camera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastDepthSentRef = useRef<number>(0);
  const lastValidDepthRef = useRef<PoseData | null>(null);
  const lastValidPoseRef = useRef<PoseData | null>(null);

  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [selectedGarment, setSelectedGarment] =
    useState<string>("busy_bees_cream");
  const [videoReady, setVideoReady] = useState(false);
  const [isEstimating, setIsEstimating] = useState(true);

  // 🔧 Send pose to backend
  const sendToDepthAPI = async (pose: PoseData) => {
    try {
      const res = await fetch(
        "https://8k973b0d-2702.asse.devtunnels.ms/depth",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pose),
        }
      );
      const json = await res.json();
      return json;
    } catch (err) {
      console.error("Depth API error:", err);
      return null;
    }
  };

  // 🧠 Setup camera and Mediapipe
  useEffect(() => {
    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            frameRate: { ideal: 30, max: 60 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;

        video.onloadedmetadata = () => {
          video.play().then(() => {
            setVideoReady(true);
            detectPose();
          });
        };
      } catch (error) {
        console.error("Error setting up camera:", error);
        alert("Please allow camera permissions.");
      }
    };

    setup();

    return () => {
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  // 🎯 Pose detection loop
  const detectPose = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTimestamp = -1;
    let lastDetected = Date.now();

    const render = async () => {
      if (video.readyState < 2) {
        requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight)
        canvas.height = video.videoHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      let now = performance.now();
      if (now <= lastTimestamp) now = lastTimestamp + 1;
      lastTimestamp = now;

      const results = landmarker.detectForVideo(video, now);

      if (results.landmarks?.length > 0) {
        const raw = results.landmarks[0];
        const keypoints: Keypoint[] = raw.map((kp, idx) => ({
          name: String(idx),
          x: kp.x * canvas.width,
          y: kp.y * canvas.height,
          z: kp.z,
          score: kp.visibility ?? 1,
        }));

        const valid = keypoints.filter((kp) => kp.score >= 0.5);
        if (valid.length >= MIN_VALID_KEYPOINTS) {
          const nowMs = Date.now();
          lastDetected = nowMs;

          const posePayload: PoseData = { keypoints };
          lastValidPoseRef.current = posePayload;

          if (nowMs - lastDepthSentRef.current > 1000) {
            lastDepthSentRef.current = nowMs;
            const depthResult = await sendToDepthAPI(posePayload);

            if (depthResult?.scale_factor && depthResult?.average_depth_cm) {
              const enriched = { ...posePayload, ...depthResult };
              setPoseData(enriched);
              lastValidDepthRef.current = enriched;
              setIsEstimating(false);
            } else {
              // Keep showing last depth
              setPoseData(lastValidDepthRef.current ?? posePayload);
            }
          } else {
            setPoseData(lastValidDepthRef.current ?? posePayload);
          }
        }
      } else {
        // ⏳ Keep last valid pose visible up to 2 seconds
        if (Date.now() - lastDetected < 2000 && lastValidDepthRef.current) {
          setPoseData(lastValidDepthRef.current);
        }
      }

      requestAnimationFrame(render);
    };

    render();
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        style={{ transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      <select
        value={selectedGarment}
        onChange={(e) => setSelectedGarment(e.target.value)}
        className="absolute top-4 left-4 z-20 bg-white/90 p-3 rounded-lg shadow-lg text-sm font-medium border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
      >
        {Object.keys(GARMENT_MODELS).map((key) => (
          <option key={key} value={key}>
            {key.replace(/_/g, " ").toUpperCase()}
          </option>
        ))}
      </select>

      {!videoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-30">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-yellow-400 border-t-transparent rounded-full mb-4 mx-auto"></div>
            <p className="text-white text-lg">Loading camera...</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10 pointer-events-none">
        <ARScene pose={poseData} selectedGarment={selectedGarment} />
      </div>

      {!isEstimating && poseData?.scale_factor && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white text-black px-5 py-3 rounded-lg shadow-lg text-base font-medium z-30 backdrop-blur-md">
          Estimated Size: {mapScaleToSize(poseData.scale_factor)} | Depth:{" "}
          {poseData.average_depth_cm?.toFixed(1)} cm
        </div>
      )}

      {isEstimating && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 text-black px-5 py-3 rounded-lg shadow-lg text-base font-medium z-30">
          Estimating size...
        </div>
      )}
    </div>
  );
};

export default Camera;
