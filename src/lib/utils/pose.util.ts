// pose.util.ts
import { MIN_CONFIDENCE } from "../constants/pose.constant";

export type Keypoint = {
  name: string;
  x: number;
  y: number;
  z: number;
  score: number;
};

export const filterValidKeypoints = (
  keypoints: Keypoint[],
  threshold?: number
): Keypoint[] => {
  const isMobile = window.innerWidth <= 768;
  // Lower threshold on mobile for better detection
  const adaptiveThreshold = threshold ?? (isMobile ? 0.4 : MIN_CONFIDENCE);

  return keypoints.filter((kp) => kp.score >= adaptiveThreshold);
};

export const smoothKeypoints = (
  prev: Keypoint[] | null,
  current: Keypoint[],
  alpha?: number
): Keypoint[] => {
  if (!prev) return current;

  const isMobile = window.innerWidth <= 768;
  const isSmallMobile = window.innerWidth <= 480;

  const adaptiveAlpha = alpha ?? (isSmallMobile ? 0.5 : isMobile ? 0.55 : 0.6);

  return current.map((kp, i) => {
    const prevKp = prev[i];
    if (!prevKp) return kp;

    return {
      ...kp,
      x: adaptiveAlpha * kp.x + (1 - adaptiveAlpha) * prevKp.x,
      y: adaptiveAlpha * kp.y + (1 - adaptiveAlpha) * prevKp.y,
      z: adaptiveAlpha * kp.z + (1 - adaptiveAlpha) * prevKp.z,
    };
  });
};

export const normalizeLandmarks = (
  raw: any[],
  width: number,
  height: number
): Keypoint[] =>
  raw.map((kp, idx) => ({
    name: String(idx),
    x: kp.x * width,
    y: kp.y * height,
    z: kp.z,
    score: kp.visibility ?? 1,
  }));

export const calculateShoulderWidth = (
  leftShoulder?: Keypoint,
  rightShoulder?: Keypoint
): number => {
  if (!leftShoulder || !rightShoulder) return 0;
  if (leftShoulder.score < 0.3 || rightShoulder.score < 0.3) return 0;

  return Math.abs(leftShoulder.x - rightShoulder.x);
};

export const getChestPosition = (
  leftShoulder?: Keypoint,
  rightShoulder?: Keypoint
): Keypoint | null => {
  if (!leftShoulder || !rightShoulder) return null;
  if (leftShoulder.score < 0.3 || rightShoulder.score < 0.3) return null;

  const isMobile = window.innerWidth <= 768;
  const isSmallMobile = window.innerWidth <= 480;

  const verticalOffset = isSmallMobile ? 35 : isMobile ? 40 : 45;

  return {
    name: "chest",
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2 + verticalOffset,
    z: (leftShoulder.z + rightShoulder.z) / 2,
    score: (leftShoulder.score + rightShoulder.score) / 2,
  };
};

export const isBackFacing = (
  leftShoulder?: Keypoint,
  rightShoulder?: Keypoint,
  nose?: Keypoint
): boolean => {
  if (!leftShoulder || !rightShoulder || !nose) return false;

  const shoulderAvgScore = (leftShoulder.score + rightShoulder.score) / 2;
  return nose.score < 0.3 && shoulderAvgScore > 0.5;
};

export const calculateBodyRotation = (
  leftShoulder?: Keypoint,
  rightShoulder?: Keypoint
): { roll: number; yaw: number } => {
  if (!leftShoulder || !rightShoulder) {
    return { roll: 0, yaw: 0 };
  }

  const roll = Math.atan2(
    rightShoulder.y - leftShoulder.y,
    rightShoulder.x - leftShoulder.x
  );

  const isMobile = window.innerWidth <= 768;
  const yawMultiplier = isMobile ? 1.0 : 1.2;
  const yaw = (leftShoulder.z - rightShoulder.z) * yawMultiplier;

  return { roll, yaw };
};

export const validatePoseQuality = (
  keypoints: Keypoint[]
): {
  isValid: boolean;
  confidence: number;
  message?: string;
} => {
  const validKeypoints = filterValidKeypoints(keypoints);
  const confidence = validKeypoints.length / keypoints.length;

  if (validKeypoints.length < 10) {
    return {
      isValid: false,
      confidence,
      message: "Not enough keypoints detected. Please adjust your position.",
    };
  }

  const leftShoulder = keypoints[11];
  const rightShoulder = keypoints[12];

  if (
    !leftShoulder ||
    !rightShoulder ||
    leftShoulder.score < 0.3 ||
    rightShoulder.score < 0.3
  ) {
    return {
      isValid: false,
      confidence,
      message: "Shoulders not detected clearly. Please face the camera.",
    };
  }

  return {
    isValid: true,
    confidence,
  };
};

export const applyKalmanFilter = (
  measurements: Keypoint[],
  estimates: Keypoint[] | null,
  processNoise = 0.01,
  measurementNoise = 0.1
): Keypoint[] => {
  if (!estimates) return measurements;

  return measurements.map((kp, i) => {
    const estimate = estimates[i];
    if (!estimate) return kp;

    const K = processNoise / (processNoise + measurementNoise);

    return {
      ...kp,
      x: estimate.x + K * (kp.x - estimate.x),
      y: estimate.y + K * (kp.y - estimate.y),
      z: estimate.z + K * (kp.z - estimate.z),
    };
  });
};

export const getResponsiveScale = (
  shoulderWidth: number,
  screenWidth: number = window.innerWidth
): number => {
  const isMobile = screenWidth <= 768;
  const isSmallMobile = screenWidth <= 480;

  const baseScaleFactor = isSmallMobile ? 0.5 : isMobile ? 0.55 : 0.6;

  return Math.min(
    Math.max(shoulderWidth / (screenWidth * baseScaleFactor), 0.25),
    1.5
  );
};
