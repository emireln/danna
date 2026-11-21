// The three characters of the live talk: Pip (a small robot), Bloop (a soft green creature) and Luna (a stylised person).
// They are built from simple shapes, so they appear at once and need no image or model files. The pose from rig.ts moves
// them. This file is loaded only when the talk opens, so three.js is not part of the start-up of the app.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Pose } from './rig';

export type CharacterKind = 'pip' | 'bloop' | 'luna';

export interface CharacterScene {
  render: (pose: Pose) => void;
  dispose: () => void;
}

interface Figure {
  root: THREE.Group;
  apply: (pose: Pose) => void;
}

const SKIN = 0xf2c7a5;
const HAIR = 0x3b2a4f;
const SWEATER = 0x5c7cfa;
const ROBOT_BLUE = 0x7fb3ff;
const ROBOT_SHELL = 0xdfe9ff;
const ROBOT_SCREEN = 0x0b1733;
const ROBOT_EYES = 0x4fd6ff;
const ROBOT_MOUTH = 0xff8fb1;
const ROBOT_BULB = 0xffd166;
const BLOOP_GREEN = 0x7be0a4;
const BLOOP_SPOT = 0xc9f5d9;
const INK = 0x1d2a3a;
const WHITE = 0xffffff;

function matte(color: number, roughness = 0.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function glowing(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.3 });
}

function part(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  return object;
}

function blinkScale(blink: number): number {
  return Math.max(0.08, 1 - blink * 0.92);
}

function buildPip(): Figure {
  const root = new THREE.Group();
  const torso = part(new RoundedBoxGeometry(1, 0.9, 0.7, 6, 0.2), matte(ROBOT_BLUE, 0.35), 0, -1.55, 0);
  const head = new THREE.Group();
  head.position.y = 0.35;
  const eyeMaterial = glowing(ROBOT_EYES);
  const mouthMaterial = glowing(ROBOT_MOUTH);
  const bulbMaterial = glowing(ROBOT_BULB);
  const eyeLeft = part(new THREE.SphereGeometry(0.16, 24, 16), eyeMaterial, -0.32, 0.14, 0.66);
  const eyeRight = part(new THREE.SphereGeometry(0.16, 24, 16), eyeMaterial, 0.32, 0.14, 0.66);
  const mouth = part(new RoundedBoxGeometry(0.46, 0.12, 0.05, 4, 0.05), mouthMaterial, 0, -0.27, 0.66);
  const bulb = part(new THREE.SphereGeometry(0.11, 16, 12), bulbMaterial, 0, 1.1, 0);
  head.add(
    part(new RoundedBoxGeometry(1.7, 1.35, 1.2, 8, 0.35), matte(ROBOT_SHELL, 0.3)),
    part(new RoundedBoxGeometry(1.36, 0.95, 0.1, 6, 0.2), matte(ROBOT_SCREEN, 0.6), 0, 0.02, 0.58),
    eyeLeft,
    eyeRight,
    mouth,
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), matte(0xcfd8e8), 0, 0.875, 0),
    bulb,
  );
  // The arms turn from their shoulders, so a wave lifts the hand.
  const armMaterial = matte(ROBOT_BLUE, 0.35);
  const armGeometry = new RoundedBoxGeometry(0.2, 0.7, 0.2, 3, 0.08);
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.66, -1.2, 0);
  rightShoulder.add(part(armGeometry, armMaterial, 0, -0.3, 0));
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.66, -1.2, 0);
  leftShoulder.add(part(armGeometry, armMaterial, 0, -0.3, 0));
  root.add(torso, head, rightShoulder, leftShoulder);

  return {
    root,
    apply(pose) {
      head.rotation.set(pose.pitch, pose.yaw, pose.roll);
      head.position.y = 0.35 + pose.bob * 0.06;
      torso.position.y = -1.55 + pose.bob * 0.06;
      eyeLeft.scale.y = blinkScale(pose.blink);
      eyeRight.scale.y = blinkScale(pose.blink);
      eyeLeft.position.set(-0.32 + pose.gazeX * 0.06, 0.14 + pose.gazeY * 0.05, 0.66);
      eyeRight.position.set(0.32 + pose.gazeX * 0.06, 0.14 + pose.gazeY * 0.05, 0.66);
      mouth.scale.set(1 + pose.wide * 0.7 - pose.round * 0.45, 0.35 + pose.open * 2.6 + pose.round * 0.2, 1);
      eyeMaterial.emissiveIntensity = 0.5 + pose.glow * 0.9;
      mouthMaterial.emissiveIntensity = 0.4 + pose.open * 1.2;
      bulbMaterial.emissiveIntensity = 0.4 + pose.glow * 1.4;
      rightShoulder.rotation.z = -pose.wave * 2.2;
      leftShoulder.rotation.z = pose.wave * 0.2;
    },
  };
}

function buildBloop(): Figure {
  const root = new THREE.Group();
  const head = new THREE.Group();
  // A soft, uneven surface, so the creature looks alive: every point moves a little along its own direction.
  const geometry = new THREE.SphereGeometry(1, 48, 32);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i += 1) {
    const x = points.getX(i);
    const y = points.getY(i);
    const z = points.getZ(i);
    const bump = 1 + 0.05 * Math.sin(3 * x + 1.3) * Math.cos(2.5 * y) + 0.03 * Math.sin(4 * z);
    points.setXYZ(i, x * bump * 1.05, y * bump * 0.95, z * bump);
  }
  geometry.computeVertexNormals();
  head.add(part(geometry, matte(BLOOP_GREEN, 0.55)));
  const eyes = [-0.36, 0.36].map((x) => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.3, 0.84);
    eye.add(part(new THREE.SphereGeometry(0.34, 24, 16), matte(WHITE, 0.2)));
    eye.add(part(new THREE.SphereGeometry(0.17, 16, 12), matte(INK, 0.3), 0, -0.02, 0.2));
    head.add(eye);
    return eye;
  });
  for (const [x, y, z] of [
    [0.5, 0.45, 0.8],
    [-0.55, -0.4, 0.7],
  ]) {
    head.add(part(new THREE.SphereGeometry(0.14, 16, 12), matte(BLOOP_SPOT, 0.5), x, y, z));
  }
  const mouth = part(new THREE.SphereGeometry(0.22, 24, 16), matte(0x3b1d2e, 0.4), 0, -0.3, 0.92);
  head.add(mouth);
  // Two short arms, which wave when the creature is thinking.
  const armGeometry = new THREE.CapsuleGeometry(0.13, 0.5, 4, 12);
  const armMaterial = matte(BLOOP_GREEN, 0.55);
  const rightArm = new THREE.Group();
  rightArm.position.set(1.0, -0.1, 0.1);
  rightArm.add(part(armGeometry, armMaterial, 0.22, -0.2, 0));
  const leftArm = new THREE.Group();
  leftArm.position.set(-1.0, -0.1, 0.1);
  leftArm.add(part(armGeometry, armMaterial, -0.22, -0.2, 0));
  root.add(head, rightArm, leftArm);

  return {
    root,
    apply(pose) {
      head.rotation.set(pose.pitch, pose.yaw, pose.roll);
      root.position.y = pose.bob * 0.08;
      for (const eye of eyes) {
        eye.scale.y = blinkScale(pose.blink);
        const pupil = eye.children[1];
        pupil.position.set(pose.gazeX * 0.1, -0.02 + pose.gazeY * 0.1, 0.2);
      }
      mouth.scale.set(0.9 + pose.wide * 0.6 - pose.round * 0.3, 0.2 + pose.open * 1.6, 0.5);
      rightArm.rotation.z = -0.5 - pose.wave * 1.2;
      leftArm.rotation.z = 0.5 + pose.wave * 0.3;
    },
  };
}

function buildLuna(): Figure {
  const root = new THREE.Group();
  const torso = part(new THREE.CapsuleGeometry(0.42, 0.7, 6, 14), matte(SWEATER, 0.7), 0, -1.45, 0);
  const head = new THREE.Group();
  head.position.y = 0.4;
  const face = part(new THREE.SphereGeometry(0.8, 40, 28), matte(SKIN, 0.6));
  face.scale.set(0.92, 1.02, 0.95);
  const hair = part(new THREE.SphereGeometry(0.86, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), matte(HAIR, 0.5), 0, 0.12, -0.02);
  const ponytail = part(new THREE.CapsuleGeometry(0.2, 0.8, 6, 12), matte(HAIR, 0.5), 0, 0.05, -0.75);
  ponytail.rotation.x = 0.6;
  head.add(face, hair, ponytail);
  const eyes = [-0.28, 0.28].map((x) => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.08, 0.72);
    const iris = part(new THREE.SphereGeometry(0.075, 16, 12), matte(INK, 0.3));
    iris.scale.set(0.9, 1.25, 0.5);
    eye.add(iris, part(new THREE.SphereGeometry(0.026, 8, 6), matte(WHITE, 0.1), 0.02, 0.03, 0.04));
    head.add(eye);
    return eye;
  });
  const brows = [-0.28, 0.28].map((x) => {
    const brow = part(new RoundedBoxGeometry(0.24, 0.04, 0.05, 2, 0.02), matte(HAIR, 0.5), x, 0.27, 0.76);
    brow.rotation.z = x < 0 ? 0.12 : -0.12;
    head.add(brow);
    return brow;
  });
  const mouth = part(new THREE.SphereGeometry(0.12, 24, 16), matte(0x9c3d4f, 0.4), 0, -0.3, 0.7);
  head.add(mouth);
  const cheekMaterial = new THREE.MeshStandardMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.55, roughness: 0.8 });
  for (const x of [-0.44, 0.44]) head.add(part(new THREE.SphereGeometry(0.13, 16, 12), cheekMaterial, x, -0.12, 0.62));
  root.add(torso, part(new THREE.CylinderGeometry(0.2, 0.23, 0.45, 16), matte(SKIN, 0.6), 0, -0.6, 0), head);

  return {
    root,
    apply(pose) {
      head.rotation.set(pose.pitch, pose.yaw, pose.roll);
      torso.position.y = -1.45 + pose.bob * 0.05;
      for (const eye of eyes) {
        eye.scale.y = blinkScale(pose.blink);
        eye.children[0].position.set(pose.gazeX * 0.04, pose.gazeY * 0.03, 0);
      }
      brows.forEach((brow) => {
        brow.position.y = 0.27 + pose.lift * 0.07;
      });
      mouth.scale.set(1 + pose.wide * 0.8 - pose.round * 0.5, 0.15 + pose.open * 0.9, 0.6);
    },
  };
}

const BUILDERS: Record<CharacterKind, () => Figure> = { pip: buildPip, bloop: buildBloop, luna: buildLuna };

/** Draws one character in `host`. The canvas fills the host and is transparent, so the card behind it shows through. */
export function createCharacterScene(host: HTMLElement, kind: CharacterKind): CharacterScene {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.2, 8.4);
  camera.lookAt(0, -0.25, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4660, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.5, 4, 6);
  scene.add(key);
  const figure = BUILDERS[kind]();
  scene.add(figure.root);

  const resize = (): void => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    render(pose) {
      figure.apply(pose);
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
