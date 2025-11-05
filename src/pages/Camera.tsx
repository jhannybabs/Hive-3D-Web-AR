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

// 🔧 Map scale factor to shirt sizes
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
  const isMeasuringRef = useRef<boolean>(true);
  const lastDepthSentRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const lastValidDepthRef = useRef<PoseData | null>(null);

  const [poseData, setPoseData] = useState<PoseData | null>(null);
  const [selectedGarment, setSelectedGarment] =
    useState<string>("busy_bees_cream");
  const [videoReady, setVideoReady] = useState(false);

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
      return await res.json();
    } catch (err) {
      console.error("Depth API error:", err);
      return null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
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
            aspectRatio: { ideal: 16 / 9 },
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
        alert("Failed to access camera. Please allow camera permissions.");
      }
    };

    setup();
    return () => {
      isMountedRef.current = false;
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  const detectPose = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastTimestamp = -1;
    const render = async () => {
      if (!isMeasuringRef.current) return;

      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        requestAnimationFrame(render);
        return;
      }

      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      let now = performance.now();
      if (now <= lastTimestamp) now = lastTimestamp + 1;
      lastTimestamp = now;

      const results = landmarker.detectForVideo(video, now);
      if (results.landmarks && results.landmarks.length > 0) {
        const raw = results.landmarks[0];
        const keypoints: Keypoint[] = raw.map((kp, idx) => ({
          name: String(idx),
          x: kp.x * canvas.width,
          y: kp.y * canvas.height,
          z: kp.z,
          score: kp.visibility ?? 1,
        }));

        const validKeypoints = keypoints.filter((kp) => kp.score >= 0.5);
        if (validKeypoints.length >= MIN_VALID_KEYPOINTS) {
          const posePayload = { keypoints };
          const nowMs = Date.now();

          if (nowMs - lastDepthSentRef.current > 1000) {
            lastDepthSentRef.current = nowMs;
            sendToDepthAPI(posePayload).then((depthResult) => {
              if (isMountedRef.current) {
                if (
                  depthResult &&
                  typeof depthResult.scale_factor === "number"
                ) {
                  // ✅ Keep keypoints and add depth data
                  const enriched = { keypoints, ...depthResult };
                  lastValidDepthRef.current = enriched;
                  setPoseData(enriched);
                } else {
                  // ✅ If no depth data, still update with current keypoints
                  if (lastValidDepthRef.current) {
                    // Merge current keypoints with last valid depth data
                    setPoseData({
                      ...lastValidDepthRef.current,
                      keypoints, // Use current frame's keypoints
                    });
                  } else {
                    setPoseData({ keypoints });
                  }
                }
              }
            });
          } else {
            // ✅ Always update keypoints even when not calling depth API
            if (lastValidDepthRef.current) {
              // Merge current keypoints with last valid depth data
              setPoseData({
                ...lastValidDepthRef.current,
                keypoints, // Use current frame's keypoints
              });
            } else {
              setPoseData({ keypoints });
            }
          }
        } else {
          // ✅ Keep updating even with insufficient keypoints
          // This prevents the AR scene from disappearing
          if (keypoints.length > 0) {
            if (lastValidDepthRef.current) {
              setPoseData({
                ...lastValidDepthRef.current,
                keypoints, // Use whatever keypoints we have
              });
            } else {
              setPoseData({ keypoints });
            }
          } else if (
            lastValidDepthRef.current &&
            lastValidDepthRef.current.keypoints.length >= MIN_VALID_KEYPOINTS
          ) {
            // Keep showing the last valid pose data
            setPoseData(lastValidDepthRef.current);
          }
        }
      } else {
        // ✅ No landmarks detected, but still keep showing last valid data
        if (
          lastValidDepthRef.current &&
          lastValidDepthRef.current.keypoints.length >= MIN_VALID_KEYPOINTS
        ) {
          setPoseData(lastValidDepthRef.current);
        }
      }

      if (isMeasuringRef.current) requestAnimationFrame(render);
    };
    render();
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black overflow-hidden">
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
        className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg text-sm font-medium border border-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
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
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-400 border-t-transparent mb-4 mx-auto"></div>
            <p className="text-white text-lg">Loading camera...</p>
          </div>
        </div>
      )}

      {/* ✅ AR Scene always renders - moved outside conditional */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <ARScene
          pose={poseData ?? { keypoints: [] }}
          selectedGarment={selectedGarment}
        />
      </div>

      {/* ✅ Sizing overlay - shows independently of AR scene */}
      {poseData?.scale_factor && (
        <div
          className="absolute bottom-6 left-1/2 transform -translate-x-1/2 
                     bg-white text-black px-5 py-3 rounded-lg shadow-lg 
                     text-base font-medium z-30 backdrop-blur-md"
        >
          Estimated Size: {mapScaleToSize(poseData.scale_factor)} | Depth:{" "}
          {poseData.average_depth_cm?.toFixed(1)} cm
        </div>
      )}
    </div>
  );
};

export default Camera;
