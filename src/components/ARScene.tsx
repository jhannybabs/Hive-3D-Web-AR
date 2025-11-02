// src/components/ARScene.tsx
import React, { useMemo, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import RenderModel from "./RenderModel";
import { GARMENT_MODELS } from "../lib/utils/garmentSwitcher.util";

type Keypoint = {
  name: string;
  x: number;
  y: number;
  z: number;
  score: number;
};
type PoseData = { keypoints: Keypoint[] };
type Props = { pose: PoseData | null; selectedGarment: string };

export default function ARScene({ pose, selectedGarment }: Props) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const { left, right, chest } = useMemo(() => {
    if (!pose?.keypoints) return { left: null, right: null, chest: null };
    const left = pose.keypoints[11];
    const right = pose.keypoints[12];
    if (!left || !right || left.score < 0.3 || right.score < 0.3) {
      return { left, right, chest: null };
    }
    const chest = {
      x: (left.x + right.x) / 2,
      y: (left.y + right.y) / 2 + 40,
      z: (left.z + right.z) / 2,
      score: (left.score + right.score) / 2,
      left,
      right,
    };
    return { left, right, chest };
  }, [pose]);

  if (!chest) return null;

  const modelPath = GARMENT_MODELS[selectedGarment];
  const shoulderWidth = Math.abs((left?.x ?? 0) - (right?.x ?? 0));

  const isMobile = dimensions.width <= 768;
  const isSmallMobile = dimensions.width <= 480;

  const baseScaleFactor = isSmallMobile ? 0.5 : isMobile ? 0.55 : 0.6;
  const scale = Math.min(
    Math.max(shoulderWidth / (dimensions.width * baseScaleFactor), 0.25),
    1.5
  );

  const fov = isSmallMobile ? 65 : isMobile ? 60 : 55;
  const cameraZ = isSmallMobile ? 4 : isMobile ? 3.5 : 3;

  return (
    <Canvas
      camera={{
        position: [0, 0, cameraZ],
        fov: fov,
        near: 0.1,
        far: 1000,
      }}
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[0, 2, 5]} intensity={1.5} />
      <directionalLight position={[0, -2, -5]} intensity={0.5} />
      <Environment preset="city" />

      <RenderModel
        modelPath={modelPath}
        attachTo={chest}
        scale={scale}
        screenSize={dimensions}
      />
    </Canvas>
  );
}
