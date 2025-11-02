// src/components/RenderModel.tsx
import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GARMENT_MODELS } from "../lib/utils/garmentSwitcher.util";

type PoseKeypoint = { x: number; y: number; z: number; score: number };
type ChestAttach = PoseKeypoint & { left?: PoseKeypoint; right?: PoseKeypoint };

type Props = {
  modelPath: string;
  attachTo?: ChestAttach;
  scale: number;
  backFacing?: boolean;
  screenSize?: { width: number; height: number };
};

export default function RenderModel({
  modelPath,
  attachTo,
  scale,
  backFacing,
}: Props) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  const SCALE_MULTIPLIER = 1.55;

  const smoothPos = useRef(new THREE.Vector3());
  const smoothRot = useRef(new THREE.Euler());

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.clear();
      const model = scene.clone();

      model.scale.set(
        scale * SCALE_MULTIPLIER,
        scale * SCALE_MULTIPLIER,
        scale * SCALE_MULTIPLIER
      );
      model.position.set(0.3, -0.2, 0);
      model.rotation.set(0, -Math.PI / 2, 0);

      groupRef.current.add(model);
    }
  }, [scene, scale]);

  useFrame(() => {
    if (!groupRef.current) return;
    if (!attachTo || backFacing) return;

    const ndcX = (attachTo.x / size.width) * 2 - 1;
    const ndcY = -(attachTo.y / size.height) * 2 + 1;
    const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);

    const worldPoint = ndc.clone().unproject(camera);
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const dir = worldPoint.sub(camPos).normalize();

    const depthMultiplier = -2.0;
    const baseDepth = 1.6;
    const depth = baseDepth + attachTo.z * depthMultiplier;

    const targetPos = camPos.clone().add(dir.multiplyScalar(depth));
    targetPos.x *= -1;

    if (smoothPos.current.distanceTo(targetPos) > 0.005) {
      smoothPos.current.lerp(targetPos, 0.2);
    }
    groupRef.current.position.copy(smoothPos.current);

    let yaw = 0;
    let facingBack = false;
    if (attachTo.left && attachTo.right) {
      yaw = (attachTo.right.z - attachTo.left.z) * 1.2;
      facingBack = attachTo.left.x > attachTo.right.x;
    }

    const targetRot = new THREE.Euler(
      0,
      facingBack ? yaw - Math.PI / 2 : yaw + Math.PI / 2,
      0
    );

    smoothRot.current.x = THREE.MathUtils.lerp(
      smoothRot.current.x,
      targetRot.x,
      0.15
    );
    smoothRot.current.y = THREE.MathUtils.lerp(
      smoothRot.current.y,
      targetRot.y,
      0.15
    );
    smoothRot.current.z = THREE.MathUtils.lerp(
      smoothRot.current.z,
      targetRot.z,
      0.15
    );

    groupRef.current.rotation.copy(smoothRot.current);

    const finalScale = scale * SCALE_MULTIPLIER * (facingBack ? 1 : 1.7);
    groupRef.current.scale.set(finalScale, finalScale, finalScale);
  });

  return <group ref={groupRef} />;
}

Object.values(GARMENT_MODELS).forEach((path) => useGLTF.preload(path));
