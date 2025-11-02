// src/workers/pose.worker.ts
declare function importScripts(...urls: string[]): void;

let landmarker: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, videoFrame, fuseUrl } = event.data;

  if (type === "INIT") {
    // Load Mediapipe Vision bundle
    importScripts(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs"
    );

    // @ts-ignore
    const { FilesetResolver, PoseLandmarker } = self;

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );

    // @ts-ignore
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });

    self.postMessage({ type: "READY" });
  }

  if (type === "DETECT" && landmarker) {
    // Run Mediapipe pose detection
    // @ts-ignore
    const results = landmarker.detectForVideo(videoFrame, performance.now());

    if (!results?.landmarks?.length) return;

    const raw = results.landmarks[0];
    const keypoints = raw.map((kp: any, idx: number) => ({
      name: String(idx),
      x: kp.x,
      y: kp.y,
      z: kp.z,
      score: kp.visibility ?? 1,
    }));

    // ✅ Fuse keypoints with depth server
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const response = await fetch(fuseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keypoints }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const fused = await response.json();
        self.postMessage({ type: "POSE", data: fused });
      } else {
        self.postMessage({ type: "POSE", data: { keypoints } });
      }
    } catch (err) {
      console.warn("⚠️ Fuse server error, using raw keypoints:", err);
      self.postMessage({ type: "POSE", data: { keypoints } });
    }
  }
};
